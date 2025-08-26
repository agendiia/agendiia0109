import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';

interface RateLimit {
  userId: string;
  count: number;
  window: Date;
  lastRequest: Date;
}

export class RateLimiter {
  private limits: Map<string, RateLimit> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // Clean up old entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  async checkLimit(userId: string, endpoint: string): Promise<void> {
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
        throw new HttpsError(
          'resource-exhausted',
          `Rate limit exceeded. Maximum ${this.maxRequests} requests per ${this.windowMs / 1000} seconds.`
        );
      }

      // Increment count
      rateLimit.count++;
      rateLimit.lastRequest = now;
    } else {
      // New window
      rateLimit.count = 1;
      rateLimit.window = now;
      rateLimit.lastRequest = now;
    }

    this.limits.set(key, rateLimit);
  }

  private async logViolation(userId: string, endpoint: string, requestCount: number): Promise<void> {
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
    } catch (error) {
      console.error('Failed to log rate limit violation:', error);
    }
  }

  private cleanup(): void {
    const cutoff = new Date(Date.now() - this.windowMs * 2);
    
    for (const [key, rateLimit] of this.limits.entries()) {
      if (rateLimit.lastRequest < cutoff) {
        this.limits.delete(key);
      }
    }
  }

  getStats(): { totalKeys: number; activeWindows: number } {
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

// Global rate limiter instances
export const globalRateLimiter = new RateLimiter(60000, 100); // 100 requests per minute globally
export const userRateLimiter = new RateLimiter(60000, 50); // 50 requests per minute per user
export const adminRateLimiter = new RateLimiter(60000, 200); // 200 requests per minute for admin functions

// Rate limit decorator
export function rateLimit(limiter: RateLimiter, endpoint: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
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
export async function applyRateLimit(
  userId: string, 
  endpoint: string, 
  limiter: RateLimiter = userRateLimiter
): Promise<void> {
  if (!userId) {
    throw new HttpsError('unauthenticated', 'User ID required for rate limiting');
  }
  
  await limiter.checkLimit(userId, endpoint);
}

// Check user's plan-specific limits
export async function checkPlanLimits(userId: string, resourceType: string): Promise<void> {
  try {
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'User not found');
    }

    const userData = userDoc.data();
    const plan = userData?.plan || 'Trial';
    
    // Get plan limits (these would typically come from a configuration)
    const planLimits = {
      'Trial': { apiCalls: 1000, storage: 100, bandwidth: 1 },
      'Profissional': { apiCalls: 10000, storage: 1000, bandwidth: 10 },
      'Enterprise': { apiCalls: -1, storage: -1, bandwidth: -1 } // Unlimited
    };

    const limits = planLimits[plan as keyof typeof planLimits] || planLimits['Trial'];
    const currentUsage = await getCurrentUsage(userId, resourceType);

    // Check specific resource limits
    const limit = limits[resourceType as keyof typeof limits];
    if (limit !== -1 && currentUsage >= limit) {
      await logResourceViolation(userId, resourceType, currentUsage, limit);
      throw new HttpsError(
        'resource-exhausted',
        `${resourceType} limit exceeded for plan ${plan}. Current usage: ${currentUsage}, Limit: ${limit}`
      );
    }
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error('Error checking plan limits:', error);
    // Don't block the request if we can't check limits
  }
}

async function getCurrentUsage(userId: string, resourceType: string): Promise<number> {
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

async function logResourceViolation(
  userId: string, 
  resourceType: string, 
  usage: number, 
  limit: number
): Promise<void> {
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
  } catch (error) {
    console.error('Failed to log resource violation:', error);
  }
}
