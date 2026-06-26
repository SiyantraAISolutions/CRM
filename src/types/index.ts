export type UserRole = 'director' | 'sales' | 'admin'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  avatar_url?: string
  current_status?: ActivityStatus
  status_started_at?: string
  sales_target?: number
  calendly_link?: string
}

export type ActivityStatus = 'available' | 'break' | 'lunch' | 'toilet' | 'training'

export interface ActivityLog {
  id: string
  user_id: string
  status: ActivityStatus
  started_at: string
  ended_at?: string
}

export interface Brand {
  id: string
  code: string
  name: string
  domain?: string
  enquiry_email?: string
  refund_email?: string
  bank_details?: string
}

export interface FormType {
  id: string
  code: string
  name: string
  brand_ids: string[]
  base_price: number
  fee_scale?: 'scale1' | 'scale2' | null
  wizard_schema?: WizardStep[]
  tc_template?: string
  upsells?: Upsell[]
}

export interface Upsell {
  id: string
  label: string
  options: { label: string; price: number; value: string }[]
}

export interface WizardStep {
  title: string
  fields: WizardField[]
}

export interface WizardField {
  name: string
  label: string
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date' | 'number' | 'currency'
  required?: boolean
  placeholder?: string
  options?: string[]
  helpText?: string
  readOnly?: boolean
}

export type OrderStatus = 'lead' | 'processing' | 'in_progress' | 'completed' | 'paid' | 'dead' | 'no_answer' | 'abandoned'
export type OrderPriority = 'standard' | 'fast_track'

export interface Order {
  id: string
  brand_id: string
  brand?: Brand
  form_type_id: string
  form_type?: FormType
  user_id: string
  user?: User
  title?: string
  first_name?: string
  middle_name?: string
  last_name?: string
  email?: string
  phone?: string
  address_line1?: string
  address_line2?: string
  city?: string
  county?: string
  postcode?: string
  title_number?: string
  tenure?: string
  property_value?: number
  hmlr_fee?: number
  is_mortgaged?: boolean
  tenancy_type?: string
  status: OrderStatus
  priority: OrderPriority
  amount_total: number
  is_inbound: boolean
  terms_accepted: boolean
  manual_payment?: boolean
  stripe_payment_intent_id?: string
  document_delivered?: boolean
  document_url?: string
  tracking_number?: string
  postage_provider?: string
  created_at: string
  updated_at: string
  items?: OrderItem[]
  notes?: OrderNote[]
}

export interface OrderItem {
  id: string
  order_id: string
  item_type: string
  amount: number
}

export interface OrderNote {
  id: string
  order_id: string
  user_id: string
  user?: User
  category?: string
  message: string
  created_at: string
}

// =============================================
// ENQUIRIES / LEADS
// =============================================
export type PipelineStage = 'new' | 'contacted' | 'quoted' | 'won' | 'lost'

export interface Enquiry {
  id: string
  brand_id?: string
  brand?: Brand
  customer_name?: string
  email?: string
  phone?: string
  message?: string
  source?: string
  assigned_to?: string
  assigned_user?: User
  pipeline_stage: PipelineStage
  notes?: string
  follow_up_at?: string
  converted_order_id?: string
  created_at: string
}

// =============================================
// PAYMENTS
// =============================================
export type PaymentMethod = 'stripe' | 'manual' | 'bank_transfer'
export type PaymentStatus = 'pending' | 'cleared' | 'refunded'

export interface Payment {
  id: string
  order_id: string
  order?: Order
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  processed_by?: string
  processed_by_user?: User
  processed_at?: string
  stripe_payment_intent_id?: string
  notes?: string
  created_at: string
}

// =============================================
// REFUNDS
// =============================================
export type RefundStatus = 'requested' | 'under_review' | 'approved' | 'rejected' | 'paid'

export interface Refund {
  id: string
  order_id: string
  order?: Order
  status: RefundStatus
  reason?: string
  refund_amount: number
  manager_approval: boolean
  approved_by?: string
  approved_by_user?: User
  created_by: string
  created_by_user?: User
  created_at: string
  updated_at: string
}

// =============================================
// TASKS
// =============================================
export type TaskStatus = 'open' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  title: string
  description?: string
  assigned_to: string
  assigned_user?: User
  created_by: string
  created_by_user?: User
  linked_order_id?: string
  linked_enquiry_id?: string
  due_at?: string
  status: TaskStatus
  priority: TaskPriority
  completed_at?: string
  completed_by?: string
  created_at: string
}

export interface TaskNote {
  id: string
  task_id: string
  user_id: string
  user?: User
  message: string
  created_at: string
}

// =============================================
// NOTIFICATIONS
// =============================================
export type NotificationType = 'order_assigned' | 'enquiry_assigned' | 'task_assigned' | 'follow_up_due' | 'payment_flagged' | 'document_delivered'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  linked_order_id?: string
  linked_enquiry_id?: string
  read_at?: string
  deliver_at?: string
  created_at: string
}

// =============================================
// TICKETS / HELP (existing, preserved)
// =============================================
export type TicketStatus = 'pending' | 'awaiting_internal' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high'

export interface Ticket {
  id: string
  number: number
  brand_id: string
  brand?: Brand
  department: string
  priority: TicketPriority
  name: string
  body: string
  status: TicketStatus
  user_id: string
  user?: User
  created_at: string
  updated_at: string
}

export type HelpRequestStatus = 'pending' | 'in_progress' | 'resolved'

export interface HelpRequest {
  id: string
  brand_id: string
  brand?: Brand
  customer_name?: string
  customer_email?: string
  subject: string
  body: string
  status: HelpRequestStatus
  created_at: string
}

export type KBSection = 'sales' | 'admin'

export interface KBArticle {
  id: string
  section: KBSection
  brand_id?: string
  title: string
  body: string
  sort_order: number
  created_at: string
  updated_at: string
}

// =============================================
// DASHBOARD STATS
// =============================================
export interface DirectorStats {
  revenue_month: number
  net_revenue_month: number
  pending_clearance: number
  profit_estimate: number
  order_count_month: number
  conversion_rate: number
}

export interface SalesDashboardStats {
  active_leads: number
  converted_today: number
  sales_total_month: number
  sales_target_month: number
}

export interface AdminDashboardStats {
  active_cases: number
  docs_pending_delivery: number
  tasks_due_today: number
}

export interface LeaderboardEntry {
  user_id: string
  full_name: string
  orders: number
}

export interface Business {
  id: string
  name: string
  domain?: string
  colour?: string
  logo_url?: string
  status: 'active' | 'inactive'
  created_at: string
}

export type BusinessFilter = string // 'all' or business UUID


export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}
