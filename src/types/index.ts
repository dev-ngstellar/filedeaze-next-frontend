import type { PaginationMeta } from '@/components/ui/Pagination';

// ─── Auth ────────────────────────────────────────────────────────────────────
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantCode?: string;
  tenantId?: string;
  tenantStatus?: TenantStatus;
  trialEndsAt?: string | null;
  phone?: string;
  photo?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  ticketId?: string;
  role?: string;
  read: boolean;
  createdAt: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// ─── API Response ─────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface ApiError {
  success: false;
  statusCode: number;
  message: string;
  timestamp: string;
  path: string;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Tenant / Plan ────────────────────────────────────────────────────────────
export type TenantStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'PAYMENT_PENDING' | 'SUSPENDED';
export type PlanName = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

export interface Plan {
  id: string;
  name: PlanName;
  price: number;
  managerLimit: number;
  technicianLimit: number;
  ticketLimit: number;
  customerLimit: number;
  storageLimitGb: number;
  durationDays?: number | null;
  isTrial?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED' | 'QUEUED';
export type ComputedSubStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'TRIAL' | 'SUSPENDED' | 'CANCELLED';

export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  plan?: Plan;
  startDate: string;
  endDate: string;
  status: SubscriptionStatus;
  notes?: string | null;
  paymentMethod?: string | null;
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionWithMeta extends Subscription {
  tenant: { id: string; companyName: string; tenantCode: string; status: string; logoUrl?: string | null };
  plan: Plan;
  amount: number;
  daysLeft: number;
  computedStatus: ComputedSubStatus;
}

export interface SubscriptionDetail extends SubscriptionWithMeta {
  tenant: Tenant;
  billings: Billing[];
  subscriptionHistory: Array<Subscription & { plan: Plan }>;
}

export interface SubscriptionDashboard {
  activeSubscriptions: number;
  trialSubscriptions: number;
  expiringSoon: number;
  expiredSubscriptions: number;
  monthlyRevenue: number;
  annualRevenue: number;
  pendingRenewals: number;
}

export interface SubscriptionListResponse {
  subscriptions: SubscriptionWithMeta[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  meta?: PaginationMeta;
}

export interface Tenant {
  id: string;
  companyName: string;
  tenantCode: string;
  email: string;
  phone: string;
  address: string;
  adminName: string;
  adminEmail: string;
  status: TenantStatus;
  trialEndsAt?: string | null;
  selectedPlanId?: string | null;
  selectedPlan?: Plan | null;
  plan?: Plan;
  subscription?: Subscription;
  planName?: string | null;
  durationDays?: number | null;
  daysRemaining?: number | null;
  subscriptionStatus?: SubscriptionStatus | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CreateTenantDto {
  companyName: string;
  tenantCode: string;
  email: string;
  phone: string;
  address: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  plan?: PlanName;
}

export interface TenantBranding {
  id?: string;
  companyName: string;
  tenantCode?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  status?: TenantStatus;
  trialDaysLeft?: number | null;
}

// ─── Billing / Activity ───────────────────────────────────────────────────────
export interface Billing {
  id: string;
  tenantId: string;
  subscriptionId: string;
  tenant?: { id: string; companyName: string; tenantCode: string; email?: string; phone?: string; address?: string };
  subscription?: { id: string; plan?: Plan; startDate?: string; endDate?: string; status?: string };
  amount: number;
  status: 'PAID' | 'PENDING' | 'FAILED';
  paidAt?: string;
  invoiceUrl?: string;
  createdAt: string;
}

export interface PaymentStats {
  totalRevenue: number;
  totalPending: number;
  totalFailed: number;
  paidCount: number;
  pendingCount: number;
  failedCount: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  renewalsThisMonth: number;
}

export interface TenantInfo {
  companyName: string;
  tenantCode: string;
  logoUrl: string | null;
  status?: TenantStatus;
  trialDaysLeft?: number | null;
}

export interface PlatformUpi {
  upiId: string | null;
  upiAccountName: string | null;
  upiQrImageUrl: string | null;
}

export interface MySubscription {
  subscription: (Subscription & { plan: Plan }) | null;
  pendingBill: Billing | null;
  billingHistory: Billing[];
  paymentInfo: PlatformUpi;
}

export interface BillingReport {
  billings: Billing[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: { totalPaid: number; totalPending: number };
  meta?: PaginationMeta;
}

export interface ActivityLog {
  id: string;
  userId: string;
  user?: User;
  entity: string;
  action: string;
  module?: string;
  ipAddress?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

// ─── Super Admin Reports ──────────────────────────────────────────────────────
export interface SuperAdminRevenueReport {
  total: number;
  byPlan: Partial<Record<PlanName, number>>;
  byTenant: Array<{ tenantId: string; tenantName: string; amount: number }>;
  payments: Array<{
    id: string;
    tenantName: string;
    planName: string;
    amount: number;
    status: string;
    paidAt?: string;
    createdAt: string;
  }>;
}

// ─── People ───────────────────────────────────────────────────────────────────
export interface Manager {
  id: string;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
}

export interface Technician {
  id: string;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
  rating?: number;
  photo?: string;
  location?: { lat: number; lng: number };
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  portalEnabled?: boolean;
  createdAt: string;
}

// ─── Skill ────────────────────────────────────────────────────────────────────
export interface Skill {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TechnicianSkill {
  skillId: string;
  skill: Skill;
  experienceLevel: string;
  certificationNumber?: string;
  certificationExpiryDate?: string;
}

export interface SubCategorySkill {
  id: string;
  subCategoryId: string;
  skillId: string;
  skill: Skill;
  createdAt: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────
export interface ServiceCategory {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface ServiceCharge {
  subCategoryId: string;
  serviceCharge: number;
  inspectionCharge: number;
  emergencyCharge: number;
}

export interface ServiceSubCategory {
  id: string;
  categoryId: string;
  category?: ServiceCategory;
  name: string;
  isActive: boolean;
  serviceCharges?: ServiceCharge;
  createdAt: string;
}

// ─── Customer Assets / AMC ────────────────────────────────────────────────────
export interface CustomerAsset {
  id: string;
  customerId: string;
  customer?: { id: string; name: string; phone: string };
  categoryId?: string;
  category?: { id: string; name: string };
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string;
  installationAddress?: string;
  notes?: string;
  isActive: boolean;
  ticketCount?: number;
  hasActiveAmc?: boolean;
  amcStatus?: AmcStatusSummary | null;
  images?: CustomerAssetImage[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAssetImage {
  id: string;
  imageUrl: string;
  uploadedBy: string;
  createdAt: string;
}

export interface AmcPlan {
  id: string;
  name: string;
  description?: string;
  categoryId?: string;
  category?: { id: string; name: string };
  durationMonths: number;
  visitCount: number;
  visitIntervalMonths: number;
  price: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AmcSubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'RENEWED' | 'CANCELLED';
export type AmcVisitStatus = 'SCHEDULED' | 'COMPLETED' | 'MISSED' | 'CANCELLED';

export interface AmcVisit {
  id: string;
  amcSubscriptionId: string;
  ticketId: string;
  ticket?: { id: string; ticketNumber: string; status: TicketStatus; technicianId?: string };
  visitNumber: number;
  scheduledDate: string;
  status: AmcVisitStatus;
  completedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface AmcSubscription {
  id: string;
  customerAssetId: string;
  customerAsset?: { id: string; name: string; brand?: string; model?: string; serialNumber?: string };
  planId: string;
  plan?: { id: string; name: string; durationMonths: number; visitCount: number; price: number };
  customerId: string;
  customer?: { id: string; name: string; phone: string };
  startDate: string;
  endDate: string;
  totalVisits: number;
  remainingVisits?: number;
  status: AmcSubscriptionStatus;
  renewedFromId?: string;
  cancelledAt?: string;
  cancelReason?: string;
  visits?: AmcVisit[];
  createdAt: string;
  updatedAt: string;
}

export interface AmcStatusSummary {
  subscriptionId: string;
  planName: string;
  status: AmcSubscriptionStatus;
  startDate: string;
  endDate: string;
  totalVisits: number;
  remainingVisits: number;
}

// ─── Spare Parts ──────────────────────────────────────────────────────────────
export interface SparePart {
  id: string;
  subCategoryId: string;
  partName: string;
  partNumber?: string;
  description?: string;
  unitPrice: number;
  unitOfMeasure: string;
  currentStock?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SparePartCoverageType = 'WARRANTY' | 'OUT_OF_WARRANTY';

export interface TicketSparePartUsage {
  id: string;
  sparePartId: string;
  sparePart?: { partName: string; unitOfMeasure: string };
  quantity: number;
  unitPrice: number;
  calculatedAmount: number;
  coverageType?: SparePartCoverageType | null;
}

// ─── Ticket ───────────────────────────────────────────────────────────────────
export type TicketStatus =
  | 'NEW_TICKET' | 'ASSIGNED' | 'ACCEPTED' | 'TRAVELLING'
  | 'REACHED_LOCATION' | 'IN_PROGRESS' | 'PENDING'
  | 'COMPLETED' | 'INVOICE_GENERATED' | 'TICKET_CLOSED' | 'CANCELLED';

export interface StatusLog {
  id: string;
  status: TicketStatus;
  notes?: string;
  changedAt: string;
  updatedBy?: User;
}

export interface TicketImage {
  id: string;
  type: 'BEFORE' | 'AFTER' | 'RAISED' | 'SIGNATURE';
  imageUrl: string;
  createdAt: string;
}

export type AssignmentHistoryStatus = 'ASSIGNED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'COMPLETED';

export interface AssignmentHistoryEntry {
  id: string;
  technician: { name: string };
  assigner?: { name: string };
  assignedAt: string;
  acceptedAt?: string;
  rejectedAt?: string;
  expiredAt?: string;
  completedAt?: string;
  status: AssignmentHistoryStatus;
  reason?: string;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  status: TicketStatus;
  description?: string;
  serviceAddress?: string;
  pendingReason?: string;
  pendingNotes?: string;
  customer: Customer;
  technician?: Technician;
  subCategory?: ServiceSubCategory;
  customerAsset?: CustomerAsset;
  amcStatus?: AmcStatusSummary | null;
  isAmcCovered?: boolean;
  spareParts?: TicketSparePartUsage[];
  scheduledAt?: string;
  /** Immutable snapshot of what the customer originally asked for — set once at creation, never
   * changed by assign/reassign. Null if the customer didn't request a specific time, or on
   * tickets created before this field existed. */
  requestedScheduleAt?: string | null;
  workStartedAt?: string;
  workEndedAt?: string;
  serviceDurationMinutes?: number | null;
  notes?: string;
  statusLogs: StatusLog[];
  assignmentCount?: number;
  assignmentHistory?: AssignmentHistoryEntry[];
  images?: TicketImage[];
  payment?: Payment;
  invoice?: Invoice;
  paymentSummary?: PaymentSummary | null;
  feedback?: Feedback;
  createdAt: string;
  updatedAt: string;
}

// ─── Payment / Invoice ────────────────────────────────────────────────────────
export type PaymentStatus = 'PENDING' | 'COLLECTED' | 'VERIFIED' | 'FAILED';
export type PaymentMethod = 'CASH' | 'UPI' | 'UPI_QR' | 'RAZORPAY' | 'CARD' | 'NET_BANKING' | 'WALLET' | 'ONLINE';
export type BillingType = 'WARRANTY' | 'NON_WARRANTY' | 'PARTIAL_WARRANTY';

export interface Payment {
  id: string;
  ticketId: string;
  ticket?: Ticket;
  amount: number;
  billingType?: BillingType;
  serviceCharge?: number;
  labourCharge?: number;
  sparePartsAmount?: number;
  serviceChargeWaived?: boolean;
  labourChargeWaived?: boolean;
  sparePartsWaived?: boolean;
  additionalCharge?: number;
  discount?: number;
  status: PaymentStatus;
  method?: PaymentMethod;
  collectedAt?: string;
  verifiedAt?: string;
  createdAt: string;
  invoice?: { gstPercent: number; gstAmount: number; total: number } | null;
}

export interface Invoice {
  id: string;
  ticketId: string;
  ticket?: Ticket;
  invoiceNumber: string;
  billingType?: BillingType;
  serviceCharge?: number;
  labourCharge?: number;
  sparePartsAmount?: number;
  additionalCharge?: number;
  discount?: number;
  subtotal: number;
  gstPercent?: number;
  gstAmount?: number;
  total: number;
  pdfUrl?: string;
  createdAt: string;
}

/** GST breakdown for a ticket's payment, derived from its persisted Invoice — the single
 * source of truth for billing display. Never recompute GST from these values on the client. */
export interface PaymentSummary {
  invoiceId: string;
  invoiceNumber: string;
  subtotal: number;
  gstEnabled: boolean;
  gstPercent: number;
  gstAmount: number;
  grandTotal: number;
}

// ─── Feedback / Attendance ────────────────────────────────────────────────────
export interface Feedback {
  id: string;
  ticketId: string;
  customer?: Customer;
  technician?: Technician;
  rating: number;
  review?: string;
  createdAt: string;
}

export interface Attendance {
  id: string;
  technician: Technician;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  checkInLat?: number;
  checkInLng?: number;
}

// ─── Dashboards ───────────────────────────────────────────────────────────────
export interface SuperAdminDashboard {
  totalTenants: number;
  activeTenants: number;
  expiredTenants: number;
  suspendedTenants: number;
  totalRevenue: number;
  activeUsers: number;
}

export interface PlanUsageEntry {
  current: number;
  limit: number | string;
}

export interface PlanUsage {
  plan: string;
  usage: {
    managers: PlanUsageEntry;
    technicians: PlanUsageEntry;
    tickets: PlanUsageEntry;
    customers?: PlanUsageEntry;
    storage: PlanUsageEntry;
  };
}

export interface AdminDashboard {
  totalTickets: number;
  newTicketsToday: number;
  openTickets: number;
  unassignedTickets: number;
  totalTechnicians: number;
  availableTechnicians: number;
  totalCustomers: number;
  newCustomersThisWeek: number;
  monthlyRevenue: number;
  revenueTrendPercent: number;
  revenueToday: number;
  pendingPaymentsAmount: number;
  pendingPaymentsCount: number;
  planUsage: PlanUsage | null;
  subscription: {
    tenantStatus: TenantStatus | null;
    isTrial: boolean;
    trialDaysLeft: number | null;
    trialEndsAt: string | null;
    currentPlan: { name: string } | null;
  } | null;
}

export interface ManagerDashboard {
  totalTickets: number;
  newTickets: number;
  assignedTickets: number;
  inProgressTickets: number;
  pendingTickets: number;
  completedTickets: number;
  totalTechnicians: number;
  pendingPayments: number;
  planUsage: PlanUsage | null;
  expiredAssignments: number;
  completedToday: number;
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export interface CompanySettings {
  id: string;
  companyName: string;
  email: string;
  phone: string;
  address: string;
  logoUrl?: string;
  contactPerson?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface TenantSettings {
  id: string;
  gstEnabled: boolean;
  gstPercent?: number;
  invoicePrefix?: string;
  invoiceNumberFormat?: string;
  upiId?: string;
  upiAccountName?: string;
  upiQrImageUrl?: string;
}

export interface AppSettings {
  id: string;
  taxPercentage: number;
  shippingCharge: number;
  handlingCharge: number;
  shippingEnabled: boolean;
  handlingEnabled: boolean;
  dailyDiscount: number;
  weeklyDiscount: number;
  monthlyDiscount: number;
  dailyDiscountEnabled: boolean;
  weeklyDiscountEnabled: boolean;
  monthlyDiscountEnabled: boolean;
}

// ─── Reports ──────────────────────────────────────────────────────────────────
export interface RevenueReport {
  payments: Array<{
    id: string;
    ticketNumber: string;
    amount: number;
    method: PaymentMethod;
    date: string;
    customer: string;
  }>;
  total: number;
  byMethod: Partial<Record<PaymentMethod, number>>;
}

export interface TicketReport {
  byStatus: Partial<Record<TicketStatus, number>>;
}

export interface TechnicianReportRow {
  id: string;
  name: string;
  totalTickets: number;
  attendanceDays: number;
  rating: number;
  acceptanceRate: number;
  averageResponseMinutes: number | null;
}

export interface AuditLog {
  id: string;
  userId: string;
  user?: User;
  entity: string;
  action: string;
  changes?: Record<string, unknown>;
  createdAt: string;
}
