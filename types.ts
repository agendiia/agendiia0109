import type { ReactNode } from 'react';

export enum AppointmentStatus {
  Scheduled = 'Agendado',
  Confirmed = 'Confirmado',
  Finished = 'Finalizado',
  Canceled = 'Cancelado',
  Problem = 'Problema',
}

export enum ClientCategory {
  VIP = 'VIP',
  Fiel = 'Fiel',
  AtRisk = 'Em Risco',
  New = 'Novo',
}

export enum AppointmentPaymentStatus {
  Pago = 'Pago',
  Pendente = 'Pendente',
  Atrasado = 'Atrasado',
}

export interface Appointment {
  id: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  service: string;
  dateTime: Date;
  duration: number; // in minutes
  status: AppointmentStatus;
  modality: 'Online' | 'Presencial';
  price: number;
  paymentStatus?: AppointmentPaymentStatus;
  // If this appointment was created as part of a package purchase / usage
  packageId?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string;
  category: ClientCategory;
  totalSpent: number;
  avgTicket: number;
  totalAppointments: number;
  lastVisit: Date;
  birthDate?: string; // YYYY-MM-DD
  notes?: string;
  tags?: string[];
}

export interface Service {
  id: string;
  name: string;
  description: string;
  duration: number; // in minutes
  price: number;
  modality: 'Online' | 'Presencial';
  isActive: boolean;
  paymentPolicy?: string;
}

export interface Package {
    id: string;
    name: string;
    description: string;
    serviceIds: string[];
    price: number;
    validityDays: number;
    isActive: boolean;
    timesSold: number;
  // NEW discount fields (optional for backward compatibility)
  discountType?: 'percent' | 'amount'; // percent = percentage discount over sum of services; amount = fixed currency amount
  discountValue?: number; // percentage (0-100) or currency value depending on discountType
  basePrice?: number; // sum of individual service prices at time of creation (snapshot)
  sessionsCount?: number; // number of sessions/consultations included in the package
}

export enum ExpenseCategory {
  Marketing = 'Marketing',
  Material = 'Material',
  Aluguel = 'Aluguel',
  Transporte = 'Transporte',
  Taxas = 'Taxas',
  Outros = 'Outros',
}

export interface Expense {
  id: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  date: Date;
}

// Types for Action Center
export enum TaskPriority {
    High = 'Alta',
    Medium = 'Média',
    Low = 'Baixa',
}

export enum TaskSource {
    Manual = 'Manual',
    IA = 'IA',
}

export interface Task {
    id: string;
    title: string;
    isCompleted: boolean;
    priority: TaskPriority;
    source: TaskSource;
    dueDate?: Date;
}


// Types for Calendar/Availability
export enum CalendarEventType {
  Available = 'available',
  Booked = 'booked',
  Blocked = 'blocked',
  ExtraAvailability = 'extra', // For one-off availability outside normal hours
}

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  start: Date;
  end: Date;
  serviceId?: string; // For 'available' or 'extra' slots
  appointmentId?: string; // For 'booked' slots
  isAllDay?: boolean;
}


export interface TimeInterval {
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

export interface WorkingDay {
    dayOfWeek: 'Domingo' | 'Segunda-feira' | 'Terça-feira' | 'Quarta-feira' | 'Quinta-feira' | 'Sexta-feira' | 'Sábado';
    enabled: boolean;
    intervals: TimeInterval[];
}

// Type for Profile
export interface Testimonial {
    id: string;
    clientName: string;
    text: string;
    date: Date;
    rating?: number; // Optional star rating (1-5)
    status: 'pending' | 'approved' | 'archived';
}

export interface Credential {
    id: string;
    title: string;
    institution: string;
    year: number;
}

export interface Address {
    street: string;
    city: string;
    state: string;
    zip: string;
}

export interface ProfessionalProfile {
    name: string;
    email: string;
    phone: string;
    registration: string;
    specialty: string;
    bio: string;
    // public URL slug (ex: "maria-silva"). Optional; if absent fallback to uid-based links.
    slug?: string;
    avatarUrl?: string;
    bannerUrl?: string;
    socialLinks?: {
        instagram?: string;
        linkedin?: string;
        facebook?: string;
        website?: string;
    };
    themeColor?: string;
    testimonials?: Testimonial[];
    cancellationPolicy?: string;
    credentials?: Credential[];
    address?: Address;
}

// Types for Payment Gateways
export enum PaymentGatewayStatus {
    Active = 'Ativo',
    Inactive = 'Inativo',
}

export interface PaymentGateway {
    id: string;
    name: string;
    status: PaymentGatewayStatus;
    description: string;
    config?: { [key: string]: any };
}

// Types for Subscription Management
export enum SubscriptionStatus {
    Active = 'Ativo',
    Trial = 'Trial',
    Inactive = 'Inativo',
    Canceled = 'Cancelado',
}

export interface SubscriptionPlan {
    id: string;
    name: string;
    price: number; // monthly
    features: string[];
    isAdvanced?: boolean;
    isArchived?: boolean; // New property for admin control
    limits?: {
        maxClients?: number;
        maxAppointmentsPerMonth?: number;
        storageMB?: number;
    };
    priceId?: string; // Stripe Price ID
}

export enum PaymentStatus {
    Paid = 'Pago',
    Pending = 'Pendente',
    Failed = 'Falhou',
}

export interface PaymentHistory {
    id: string;
    date: Date;
    description: string;
    amount: number;
    status: PaymentStatus;
    invoiceUrl?: string;
}

export interface UserSubscription {
    planId: string;
    status: SubscriptionStatus;
    nextRenewal: Date;
    paymentHistory: PaymentHistory[];
}

// Types for Advanced Reports
export interface ServicePerformance {
    serviceId: string;
    serviceName: string;
    appointments: number;
    revenue: number;
}

export interface PeakTimeData {
    period: 'Manhã' | 'Tarde' | 'Noite';
    appointments: number;
}

export interface TrendData {
    month: string;
    value: number; // Represents number of appointments or revenue
}

export interface ClientCohortData {
    cohort: string; // e.g., "Jan/24"
    clients: number;
    retention: (number | null)[]; // e.g., [100, 45, 30, ...] percentage for Month 0, 1, 2...
}

// Types for Help Center / Knowledge Base
export interface FAQItem {
    id: string;
    question: string;
    answer: string;
}

export interface KnowledgeBaseArticle {
    id: string;
    title: string;
    category: 'Primeiros Passos' | 'Agendamentos' | 'Financeiro' | 'Marketing';
    summary: string;
    content: string; // Could be markdown
    lastUpdated: Date;
}

export interface ArticleCategory {
    id: string;
    name: 'Primeiros Passos' | 'Agendamentos' | 'Financeiro' | 'Marketing';
    description: string;
    icon: ReactNode;
}


// Types for Help Center / Support Tickets
export enum TicketCategory {
    Duvida = 'Dúvida',
    ProblemaTecnico = 'Problema Técnico',
    Financeiro = 'Financeiro',
    Sugestao = 'Sugestão',
}

export enum TicketStatus {
    Aberto = 'Aberto',
    EmAndamento = 'Em Andamento',
    Fechado = 'Fechado',
}

export interface TicketResponse {
    id: string;
    author: 'Você' | 'Suporte Timevee';
    content: string;
    date: Date;
    avatarUrl: string;
}

export interface SupportTicket {
    id: string;
    subject: string;
    category: TicketCategory;
    priority: TaskPriority;
    status: TicketStatus;
    description: string;
    createdAt: Date;
    updatedAt: Date;
    responses: TicketResponse[];
}

// Types for Admin Panel
export enum UserStatus {
    Active = 'Ativo',
    Suspended = 'Suspenso',
}

export interface PlatformUser {
    id: string;
    name: string;
    email: string;
    phone?: string;
    plan: 'Profissional' | 'Avançado' | 'Trial';
    status: UserStatus;
    joinDate: Date;
    totalRevenue: number;
    emailVerified?: boolean;
    lastLoginAt?: Date;
    trialEndsAt?: Date;
    subscriptionStatus?: SubscriptionStatus; // from Stripe or other gateway
    currentPeriodEnd?: Date;
}

export interface Coupon {
    id: string;
    code: string;
    discountPercent: number;
    expiresAt: Date;
    isActive: boolean;
    timesUsed: number;
    maxUses?: number;
}

export interface PlatformTransaction {
    id: string;
    userId: string;
    userName: string;
    date: Date;
    amount: number;
    description: string;
    status: PaymentStatus;
    gateway: 'Pix' | 'MercadoPago' | 'System';
}

export enum LogLevel {
    Info = 'INFO',
    Warn = 'WARN',
    Error = 'ERROR',
    Critical = 'CRITICAL',
}

export interface ErrorLog {
    id: string;
    timestamp: Date;
    level: LogLevel;
    message: string;
    context?: object;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  user: string;
  action: string;
  details: string;
  ipAddress?: string;
}

// Analytics and Metrics Types
export interface PlatformMetrics {
  totalUsers: number;
  activeUsers: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalAppointments: number;
  conversionRate: number;
  churnRate: number;
  averageLifetimeValue: number;
  customerAcquisitionCost: number;
}

export interface RevenueMetrics {
  byPlan: Record<string, number>;
  byMonth: Array<{ month: string; revenue: number; users: number }>;
  recurring: number;
  oneTime: number;
  growth: number;
}

export interface UserGrowthMetrics {
  newUsers: Array<{ date: string; count: number }>;
  activeUsers: Array<{ date: string; count: number }>;
  churnedUsers: Array<{ date: string; count: number }>;
  trialToSubscription: number;
  retentionRate: number;
}

export interface UsageMetrics {
  featuresUsage: Record<string, number>;
  sessionDuration: number;
  engagementScore: number;
  popularFeatures: Array<{ feature: string; usage: number }>;
  timeDistribution: Record<string, number>;
}

export interface ConversionMetrics {
  trialToSubscription: number;
  freeToPaid: number;
  planUpgrades: number;
  cancellationRate: number;
  reactivationRate: number;
}

export interface AppointmentMetrics {
  totalBookings: number;
  averageBookingsPerUser: number;
  bookingTrends: Array<{ date: string; count: number }>;
  popularServices: Array<{ service: string; count: number }>;
  timeSlotDistribution: Record<string, number>;
  noShowRate: number;
}

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

// Content Management Types
export interface EmailVariable {
  name: string;
  description: string;
  defaultValue: string;
  required: boolean;
}

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

export interface WikiCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  order: number;
  parentId?: string;
  isVisible: boolean;
}

export interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  description: string;
  content: string;
  type: 'feature' | 'improvement' | 'bugfix' | 'breaking' | 'security';
  releaseDate: Date;
  isPublished: boolean;
  tags: string[];
  author: string;
  githubCommit?: string;
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
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

export interface ContentTemplate {
  id: string;
  name: string;
  type: 'email' | 'landing' | 'wiki' | 'announcement';
  category: string;
  content: string;
  variables: string[];
  previewImage: string;
  description: string;
  isPublic: boolean;
  usageCount: number;
  createdAt: Date;
  createdBy: string;
}

export interface ContentAnalytics {
  emailTemplates: {
    totalTemplates: number;
    activeTemplates: number;
    topPerforming: Array<{ id: string; name: string; openRate: number; clickRate: number; }>;
    categoryStats: Record<string, number>;
  };
  landingPages: {
    totalPages: number;
    publishedPages: number;
    totalViews: number;
    totalConversions: number;
    averageBounceRate: number;
    topPerforming: Array<{ id: string; title: string; views: number; conversions: number; }>;
  };
  wiki: {
    totalPages: number;
    publishedPages: number;
    totalViews: number;
    topViewed: Array<{ id: string; title: string; views: number; }>;
    categoryStats: Record<string, number>;
  };
  announcements: {
    totalAnnouncements: number;
    activeAnnouncements: number;
    totalViews: number;
    averageDismissalRate: number;
    typeStats: Record<string, number>;
  };
}export interface PlatformSettings {
    enableRegistrations: boolean;
    maintenanceMode: boolean;
    defaultPlan: 'Profissional' | 'Avançado';
    trialDays: number;
    publicBaseUrl?: string;
    bookingBaseDomain?: string;
}

export interface FeatureFlags {
    [key: string]: boolean;
}

// Types for Automations (Admin)
export interface BrevoSettings {
    apiKey: string;
    isConnected: boolean;
    senderEmail?: string;
    senderName?: string;
}

export type CommunicationType = 'Confirmação' | 'Lembrete' | 'Follow-up' | 'Pós-Atendimento' | 'Aniversário' | 'Personalizado';

export interface CommunicationLog {
    id: string;
    channel: 'Email' | 'WhatsApp';
    type: CommunicationType;
    subject?: string; // for email
    content: string;
    date: Date;
}