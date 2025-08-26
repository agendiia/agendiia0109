"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRateLimiter = exports.userRateLimiter = exports.globalRateLimiter = exports.RateLimiter = void 0;
exports.rateLimit = rateLimit;
exports.applyRateLimit = applyRateLimit;
exports.checkPlanLimits = checkPlanLimits;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
class RateLimiter {
    constructor(windowMs = 60000, maxRequests = 100) {
        this.limits = new Map();
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
        // Clean up old entries every 5 minutes
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
    async checkLimit(userId, endpoint) {
        const key = `${userId}:${endpoint}`;
        const now = new Date();
        const windowStart = new Date(now.getTime() - this.windowMs);
        // Get current rate limit info
        let rateLimit = this.limits.get(key);
        if (!rateLimit || rateLimit.window < windowStart) {
            // New window or no previous data
            rateLimit = {
                userId,
                count: 1,
                window: now,
                lastRequest: now
            };
            this.limits.set(key, rateLimit);
            return;
        }
        // Check if we're within the same window
        if (rateLimit.window >= windowStart) {
            if (rateLimit.count >= this.maxRequests) {
                // Rate limit exceeded
                await this.logViolation(userId, endpoint, rateLimit.count);
                throw new https_1.HttpsError('resource-exhausted', `Rate limit exceeded. Maximum ${this.maxRequests} requests per ${this.windowMs / 1000} seconds.`);
            }
            // Increment count
            rateLimit.count++;
            rateLimit.lastRequest = now;
        }
        else {
            // New window
            rateLimit.count = 1;
            rateLimit.window = now;
            rateLimit.lastRequest = now;
        }
        this.limits.set(key, rateLimit);
    }
    async logViolation(userId, endpoint, requestCount) {
        try {
            await admin.firestore().collection('resourceViolations').add({
                userId,
                type: 'rateLimit',
                severity: 'High',
                message: `Rate limit exceeded for ${endpoint}. ${requestCount} requests in window.`,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                resolved: false,
                action: 'throttle',
                metadata: {
                    endpoint,
                    requestCount,
                    limit: this.maxRequests,
                    windowMs: this.windowMs
                }
            });
        }
        catch (error) {
            console.error('Failed to log rate limit violation:', error);
        }
    }
    cleanup() {
        const cutoff = new Date(Date.now() - this.windowMs * 2);
        for (const [key, rateLimit] of this.limits.entries()) {
            if (rateLimit.lastRequest < cutoff) {
                this.limits.delete(key);
            }
        }
    }
    getStats() {
        const now = new Date();
        const windowStart = new Date(now.getTime() - this.windowMs);
        let activeWindows = 0;
        for (const rateLimit of this.limits.values()) {
            if (rateLimit.window >= windowStart) {
                activeWindows++;
            }
        }
        return {
            totalKeys: this.limits.size,
            activeWindows
        };
    }
}
exports.RateLimiter = RateLimiter;
// Global rate limiter instances
exports.globalRateLimiter = new RateLimiter(60000, 100); // 100 requests per minute globally
exports.userRateLimiter = new RateLimiter(60000, 50); // 50 requests per minute per user
exports.adminRateLimiter = new RateLimiter(60000, 200); // 200 requests per minute for admin functions
// Rate limit decorator
function rateLimit(limiter, endpoint) {
    return function (target, propertyName, descriptor) {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            const request = args[0]; // First argument should be the request object
            const userId = request.auth?.uid;
            if (userId) {
                await limiter.checkLimit(userId, endpoint);
            }
            return method.apply(this, args);
        };
        return descriptor;
    };
}
// Middleware function for manual rate limiting
async function applyRateLimit(userId, endpoint, limiter = exports.userRateLimiter) {
    if (!userId) {
        throw new https_1.HttpsError('unauthenticated', 'User ID required for rate limiting');
    }
    await limiter.checkLimit(userId, endpoint);
}
// Check user's plan-specific limits
async function checkPlanLimits(userId, resourceType) {
    try {
        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new https_1.HttpsError('not-found', 'User not found');
        }
        const userData = userDoc.data();
        const plan = userData?.plan || 'Trial';
        // Get plan limits (these would typically come from a configuration)
        const planLimits = {
            'Trial': { apiCalls: 1000, storage: 100, bandwidth: 1 },
            'Profissional': { apiCalls: 10000, storage: 1000, bandwidth: 10 },
            'Enterprise': { apiCalls: -1, storage: -1, bandwidth: -1 } // Unlimited
        };
        const limits = planLimits[plan] || planLimits['Trial'];
        const currentUsage = await getCurrentUsage(userId, resourceType);
        // Check specific resource limits
        const limit = limits[resourceType];
        if (limit !== -1 && currentUsage >= limit) {
            await logResourceViolation(userId, resourceType, currentUsage, limit);
            throw new https_1.HttpsError('resource-exhausted', `${resourceType} limit exceeded for plan ${plan}. Current usage: ${currentUsage}, Limit: ${limit}`);
        }
    }
    catch (error) {
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        console.error('Error checking plan limits:', error);
        // Don't block the request if we can't check limits
    }
}
async function getCurrentUsage(userId, resourceType) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    switch (resourceType) {
        case 'apiCalls':
            // This would typically come from usage tracking
            return 0; // Placeholder
        case 'storage':
            // Calculate user's storage usage
            return 0; // Placeholder
        case 'bandwidth':
            // Calculate user's bandwidth usage
            return 0; // Placeholder
        default:
            return 0;
    }
}
async function logResourceViolation(userId, resourceType, usage, limit) {
    try {
        await admin.firestore().collection('resourceViolations').add({
            userId,
            type: resourceType,
            severity: 'High',
            message: `${resourceType} limit exceeded. Usage: ${usage}, Limit: ${limit}`,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            resolved: false,
            action: 'throttle',
            metadata: {
                resourceType,
                usage,
                limit
            }
        });
    }
    catch (error) {
        console.error('Failed to log resource violation:', error);
    }
}
