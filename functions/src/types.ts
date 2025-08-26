// Resource Management and Limits Types
export interface ResourceQuotas {
  storage: {
    limit: number; // in MB
    used: number;
    unlimited: boolean;
  };
  bandwidth: {
    limit: number; // in GB per month
    used: number;
    unlimited: boolean;
  };
  apiCalls: {
    limit: number; // per month
    used: number;
    unlimited: boolean;
  };
  users: {
    limit: number;
    used: number;
    unlimited: boolean;
  };
  appointments: {
    limit: number; // per month
    used: number;
    unlimited: boolean;
  };
}

export interface PlanLimits {
  planName: string;
  quotas: ResourceQuotas;
  features: string[];
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
}

export interface ResourceUsage {
  userId: string;
  userEmail: string;
  plan: string;
  quotas: ResourceQuotas;
  lastUpdated: Date;
  status: 'Normal' | 'Warning' | 'OverLimit';
  violations: ResourceViolation[];
}

export interface ResourceViolation {
  id: string;
  userId: string;
  type: 'storage' | 'bandwidth' | 'apiCalls' | 'rateLimit';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  action?: 'throttle' | 'suspend' | 'notify';
}

export interface ExternalServiceUsage {
  firebase: {
    reads: number;
    writes: number;
    storage: number;
    functions: number;
    cost: number;
  };
  stripe: {
    transactions: number;
    webhooks: number;
    cost: number;
  };
  brevo: {
    emails: number;
    cost: number;
  };
  mercadoPago: {
    transactions: number;
    cost: number;
  };
}

export interface CostAlert {
  id: string;
  service: 'firebase' | 'stripe' | 'brevo' | 'mercadoPago' | 'total';
  threshold: number;
  currentAmount: number;
  alertType: 'daily' | 'weekly' | 'monthly';
  severity: 'Info' | 'Warning' | 'Critical';
  message: string;
  createdAt: Date;
  acknowledged: boolean;
}

export interface RateLimitConfig {
  enabled: boolean;
  global: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  perUser: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  whitelist: string[]; // User IDs or emails exempt from rate limiting
  blacklist: string[]; // User IDs or emails with stricter limits
}

export interface ResourceMonitoring {
  timestamp: Date;
  totalUsers: number;
  activeUsers: number;
  totalStorage: number;
  totalBandwidth: number;
  totalApiCalls: number;
  externalServices: ExternalServiceUsage;
  costBreakdown: Record<string, number>;
  projectedMonthlyCost: number;
}

// Platform analytics types
export interface PlatformMetrics {
  timestamp: Date;
  totalUsers: number;
  activeUsers: number;
  totalRevenue: number;
  totalAppointments: number;
  averageSessionDuration: number;
  conversionRate: number;
}

// Content Management Types
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  htmlContent: string;
  type: 'welcome' | 'booking_confirmation' | 'reminder' | 'marketing' | 'system' | 'custom';
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  category: string;
  previewImage?: string;
}

export interface LandingPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  htmlContent: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  isPublished: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  sections: LandingPageSection[];
  seoScore: number;
  analytics: {
    views: number;
    conversions: number;
    bounceRate: number;
  };
}

export interface LandingPageSection {
  id: string;
  type: 'hero' | 'features' | 'testimonials' | 'pricing' | 'cta' | 'content' | 'custom';
  title: string;
  content: string;
  settings: Record<string, any>;
  order: number;
  isVisible: boolean;
}

export interface WikiPage {
  id: string;
  title: string;
  content: string;
  htmlContent: string;
  category: string;
  tags: string[];
  isPublished: boolean;
  version: number;
  parentId?: string;
  children: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastEditedBy: string;
  viewCount: number;
  searchTerms: string[];
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  htmlContent: string;
  type: 'info' | 'warning' | 'success' | 'error' | 'maintenance' | 'feature';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  targetAudience: 'all' | 'admins' | 'users' | 'specific';
  targetUserIds?: string[];
  targetPlans?: string[];
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  isDismissible: boolean;
  showOnDashboard: boolean;
  showAsPopup: boolean;
  createdAt: Date;
  createdBy: string;
  viewCount: number;
  dismissedBy: string[];
}
