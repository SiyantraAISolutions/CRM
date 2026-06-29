'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Save, CreditCard, Link2, RotateCcw, Copy, Check, Loader2, ExternalLink, Calendar, RefreshCcw, Clock, ArrowRight, MessageSquare, AlertCircle, ShieldCheck, Search, Upload, Eye, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDateTime, timeAgo, cn } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import { toast } from 'sonner'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { CheckSquare } from 'lucide-react'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// Helper to generate deterministic 7-digit IDs from UUID
function getNumericId(uuid: string, salt: number = 0) {
  let hash = 0
  const str = uuid + salt
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash % 9000000) + 1000000
}

// Helper to format date as HH:MM DD/MM/YYYY
function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

type Tab = 'breakdown' | 'information' | 'notes' | 'history'

interface OrderItem { id: string; item_type: string; amount: number }
interface OrderNote { id: string; message: string; category?: string; created_at: string; user?: { full_name: string; avatar_url?: string } }
interface Appointment { id: string; scheduled_at: string; status: string; solicitor_id: string | null; notes: string | null; solicitor?: { full_name: string } | null; reschedule_history: any[] }
interface User { id: string; full_name: string; role?: string; calendly_link?: string }

interface Props {
  order: Record<string, any>
  relatedOrders: Record<string, unknown>[]
  userRole?: string
}

const ITEM_TYPES = [
  'Deed Search [Application]', 'Deed Search [Extra]', 'Property Alert',
  'Application Pack', 'Conveyancing Pack', 'Document Fee',
  'Search & Processing Fee', 'HMLR Fee', 'Fast Track Fee',
  'Printed Copy Fee', 'SMS Updates Fee',
  'ADV1 Adverse Possession',
  'AP1 Name Change',
  'AS1 Assent of Whole',
  'COG1 Changing Register Details',
  'COG1 Changing Registered Owners Address',
  'DJP Death of Joint Proprietor',
  'FR1 First Registration',
  'Map Search / Deed Search',
  'Property Ownership',
  'RX3 Remove Restriction',
  'SEV Joint Tenants to Tenants in Common',
  'Title Plan',
  'Title Register',
  'TP1 Transfer of Part',
  'TR1 Add/Remove Proprietor',
  'Deed Search',
  'Map / Land Search (no address)',
  'Property Ownership (Register + Plan)',
  'Property Alert Service',
  'Transfer of Equity',
  'Name Change on Deeds',
  'Death of a Joint Proprietor',
  'Transfer of Equity (Wills / Probate)',
  'Tenants in Common',
  'First Registration',
  'Additional Services',
]

const DEFAULT_PRICES: Record<string, number> = {
  'Title Register': 36.00,
  'Title Plan': 36.00,
  'Deed Search': 45.00,
  'Map / Land Search (no address)': 41.00,
  'Property Ownership (Register + Plan)': 60.00,
  'Property Alert Service': 45.00,
  'Transfer of Equity': 450.00,
  'Name Change on Deeds': 150.00,
  'Death of a Joint Proprietor': 400.00,
  'Transfer of Equity (Wills / Probate)': 450.00,
  'Tenants in Common': 350.00,
  'First Registration': 600.00,
  'Fast Track Fee': 10.00,
  'Printed Copy Fee': 7.50,
  'SMS Updates Fee': 4.00,
  'Deed Search [Application]': 45.00,
  'Deed Search [Extra]': 45.00,
  'Property Alert': 45.00,
  'ADV1 Adverse Possession': 450.00,
  'AP1 Name Change': 150.00,
  'AS1 Assent of Whole': 450.00,
  'COG1 Changing Register Details': 150.00,
  'COG1 Changing Registered Owners Address': 150.00,
  'DJP Death of Joint Proprietor': 400.00,
  'FR1 First Registration': 600.00,
  'Map Search / Deed Search': 41.00,
  'Property Ownership': 60.00,
  'RX3 Remove Restriction': 350.00,
  'SEV Joint Tenants to Tenants in Common': 350.00,
  'TP1 Transfer of Part': 450.00,
  'TR1 Add/Remove Proprietor': 450.00,
}

// ─── Stripe Elements Payment Form ────────────────────────────────────────
function StripePaymentForm({ orderId, amount, onSuccess, onCancel }: {
  orderId: string
  amount: number
  onSuccess: () => void
  onCancel: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setProcessing(true)
    setError(null)

    const { error: submitError } = await elements.submit()
    if (submitError) {
      setError(submitError.message ?? 'Validation error')
      setProcessing(false)
      return
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    })

    if (confirmError) {
      setError(confirmError.message ?? 'Payment failed')
      setProcessing(false)
      return
    }

    if (paymentIntent && paymentIntent.status === 'succeeded') {
      const res = await fetch('/api/stripe/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_intent_id: paymentIntent.id,
          order_id: orderId,
        }),
      })

      if (res.ok) {
        toast.success(`Payment of ${formatCurrency(amount)} processed successfully!`)
        onSuccess()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to record payment')
      }
    }
    setProcessing(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="btn-outline" disabled={processing}>
          Cancel
        </button>
        <button type="submit" disabled={!stripe || processing} className="btn-success gap-2">
          {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {processing ? 'Processing...' : `Pay ${formatCurrency(amount)}`}
        </button>
      </div>
    </form>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────
export default function OrderDetailClient({ order: initialOrder, relatedOrders, userRole }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [order, setOrder] = useState(initialOrder)
  const [activeTab, setActiveTab] = useState<Tab>('breakdown')
  const [items, setItems] = useState<OrderItem[]>((order.items as OrderItem[]) ?? [])
  const [newNote, setNewNote] = useState('')
  const [notes, setNotes] = useState<OrderNote[]>((order.notes as OrderNote[]) ?? [])
  const [saving, setSaving] = useState(false)
  
  // Appointments state
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [showAppointmentForm, setShowAppointmentForm] = useState(false)
  const [appointmentDate, setAppointmentDate] = useState('')
  const [appointmentTime, setAppointmentTime] = useState('')
  const [appointmentSolicitor, setAppointmentSolicitor] = useState('')
  const [appointmentNotes, setAppointmentNotes] = useState('')
  const [staff, setStaff] = useState<User[]>([])
  const [reschedulingId, setReschedulingId] = useState<string | null>(null)

  // Customer Data Editing State
  const [editingInfo, setEditingInfo] = useState(false)
  
  // Deferral State
  const [showDeferModal, setShowDeferModal] = useState(false)
  const [deferDate, setDeferDate] = useState('')
  const [deferReason, setDeferReason] = useState('')

  // Monitor Tracking State
  const [monitorStage, setMonitorStage] = useState((order as any).monitor_stage || 'awaiting')
  const [submissionReqs, setSubmissionReqs] = useState((order as any).submission_requirements || { id_verified: false, form_signed: false, docs_uploaded: false })
  const [documentUrl, setDocumentUrl] = useState(order.document_url || null)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [paymentVerifiedBy, setPaymentVerifiedBy] = useState((order as any).payment_verified_by || (order as any).submission_requirements?.payment_verified_by || '')

  async function savePaymentVerifiedBy() {
    const newReqs = { ...submissionReqs, payment_verified_by: paymentVerifiedBy }
    setSubmissionReqs(newReqs)
    
    const { error } = await supabase
      .from('orders')
      .update({ 
        payment_verified_by: paymentVerifiedBy,
        submission_requirements: newReqs
      } as any)
      .eq('id', order.id)

    if (error) {
      const { error: fallbackError } = await supabase
        .from('orders')
        .update({ 
          submission_requirements: newReqs
        })
        .eq('id', order.id)
      
      if (fallbackError) {
        toast.error('Failed to save payment verification')
      } else {
        toast.success('Payment verification saved!')
      }
    } else {
      toast.success('Payment verification saved!')
    }
  }

  const handleUploadDoc = async (file: File) => {
    setUploadingDoc(true)
    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `${order.id}/${Math.random().toString(36).substring(2)}.${fileExt}`
      
      const { data, error: uploadError } = await supabase.storage
        .from('order-documents')
        .upload(filePath, file)

      if (uploadError) {
        toast.error('Failed to upload file to storage')
        console.error(uploadError)
        setUploadingDoc(false)
        return
      }

      const newReqs = { ...submissionReqs, docs_uploaded: true }
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          document_url: filePath,
          submission_requirements: newReqs,
          status: 'Documents Uploaded'
        })
        .eq('id', order.id)

      if (updateError) {
        toast.error('Failed to update order in database')
        console.error(updateError)
      } else {
        setDocumentUrl(filePath)
        setSubmissionReqs(newReqs)
        toast.success('Document uploaded successfully!')
        
        // Log timeline note
        await addTimelineNote(`Uploaded document: ${file.name} (marked "Supporting Docs Uploaded" as Complete)`, 'Upload')
      }
    } catch (err) {
      console.error(err)
      toast.error('An error occurred during upload')
    } finally {
      setUploadingDoc(false)
    }
  }

  const handleDeleteDoc = async () => {
    if (!documentUrl) return
    if (!window.confirm('Are you sure you want to remove the uploaded document?')) return

    try {
      await supabase.storage.from('order-documents').remove([documentUrl])

      const newReqs = { ...submissionReqs, docs_uploaded: false }
      const { error } = await supabase
        .from('orders')
        .update({
          document_url: null,
          submission_requirements: newReqs,
          status: 'Incomplete'
        })
        .eq('id', order.id)

      if (error) {
        toast.error('Failed to remove document')
        console.error(error)
      } else {
        setDocumentUrl(null)
        setSubmissionReqs(newReqs)
        toast.success('Document removed!')

        // Log timeline note
        await addTimelineNote(`Removed uploaded document (marked "Supporting Docs Uploaded" as Incomplete)`, 'Delete')
      }
    } catch (err) {
      console.error(err)
      toast.error('An error occurred while removing document')
    }
  }

  const handleViewDoc = async () => {
    if (!documentUrl) return
    try {
      const { data, error } = await supabase.storage
        .from('order-documents')
        .createSignedUrl(documentUrl, 3600)

      if (error) {
        toast.error('Failed to view file')
        console.error(error)
      } else if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank')
      }
    } catch (err) {
      console.error(err)
      toast.error('An error occurred while opening file')
    }
  }

  const [customerData, setCustomerData] = useState({
    first_name: order.first_name || '',
    middle_name: order.middle_name || '',
    last_name: order.last_name || '',
    email: order.email || '',
    phone: order.phone || '',
    address_line1: order.address_line1 || '',
    address_line2: order.address_line2 || '',
    city: order.city || '',
    county: order.county || '',
    postcode: order.postcode || '',
    title_number: order.title_number || '',
    tenure: order.tenure || '',
    property_value: order.property_value || '',
    hmlr_fee: order.hmlr_fee || '',
    tenancy_type: order.tenancy_type || ''
  })

  // Stripe payment states
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('requested_by_customer')

  // CRM Refund Registration state
  const [linkedRefunds, setLinkedRefunds] = useState<{ id: string; status: string; reason?: string; refund_amount: number; manager_approval: boolean; created_at: string; created_by_user?: { full_name: string }; approved_by_user?: { full_name: string } }[]>([])
  const [showRegisterRefund, setShowRegisterRefund] = useState(false)
  const [registerRefundAmount, setRegisterRefundAmount] = useState('')
  const [registerRefundReason, setRegisterRefundReason] = useState('')
  const [submittingRefund, setSubmittingRefund] = useState(false)
  const [updatingRefundId, setUpdatingRefundId] = useState<string | null>(null)
  const [processingRefund, setProcessingRefund] = useState(false)

  // Fetch current user role
  const [currentRole, setCurrentRole] = useState(userRole || '')

  // VAT Modal state
  const [showVatModal, setShowVatModal] = useState(false)

  // Email Template States
  const [emailTemplates, setEmailTemplates] = useState<{ id: string; name: string; subject: string; body: string }[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [copiedSubject, setCopiedSubject] = useState(false)
  const [copiedBody, setCopiedBody] = useState(false)
  
  useEffect(() => {
    if (!userRole) {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          supabase.from('users').select('role').eq('id', data.user.id).single()
            .then(({ data: profile }) => setCurrentRole(profile?.role ?? ''))
        }
      })
    }
  }, [supabase, userRole])

  // Fetch appointments, staff and refunds
  useEffect(() => {
    async function fetchData() {
      const { data: aData } = await supabase.from('appointments').select('*, solicitor:solicitors(full_name)').eq('order_id', order.id).order('scheduled_at', { ascending: true })
      if (aData) setAppointments(aData)
      
      const { data: sData } = await supabase.from('users').select('id, full_name, role, calendly_link').in('role', ['admin', 'director', 'sales'])
      if (sData) setStaff(sData as any)

      // Fetch linked refunds
      const { data: rData } = await supabase
        .from('refunds')
        .select('*, created_by_user:users!refunds_created_by_fkey(full_name), approved_by_user:users!refunds_approved_by_fkey(full_name)')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false })
      if (rData) setLinkedRefunds(rData as any)

      // Fetch email templates
      const { data: tData } = await supabase.from('email_templates').select('*').order('name')
      if (tData) setEmailTemplates(tData)
    }
    fetchData()
  }, [supabase, order.id])

  const isAdminOrDirector = currentRole === 'admin' || currentRole === 'director'

  const shortId = String(order.id).slice(-6).toUpperCase()
  const brand = order.brand as { name: string; code: string } | null
  const formType = order.form_type as { name: string } | null
  const status = order.status as string | null
  const stripePaymentId = order.stripe_payment_intent_id as string | undefined

  function renderTemplate(text: string) {
    if (!text) return ''
    const customerName = `${order.first_name ?? ''} ${order.last_name ?? ''}`.trim() || 'Customer'
    const brandName = brand?.name || 'Land Registry Services'
    const orderNumber = shortId
    const serviceName = formType?.name || 'Property Transaction'
    
    return text
      .replace(/{{CustomerName}}/g, customerName)
      .replace(/{{customer_name}}/g, customerName)
      .replace(/{{BrandName}}/g, brandName)
      .replace(/{{brand_name}}/g, brandName)
      .replace(/{{OrderNumber}}/g, orderNumber)
      .replace(/{{order_number}}/g, orderNumber)
      .replace(/{{Service}}/g, serviceName)
      .replace(/{{service}}/g, serviceName)
  }

  const total = Number(order.amount_total) || items.reduce((sum, item) => sum + Number(item.amount), 0)

  const canRefund = currentRole === 'director' && status === 'paid' && !!stripePaymentId

  const manualNotes = notes.filter(n => !n.category || n.category === 'Manual Note')
  const historyLogs = notes

  const tabs: { id: Tab; label: string; count?: number; isHighlighted?: boolean }[] = [
    { id: 'breakdown', label: 'Breakdown' },
    { id: 'information', label: 'Information' },
    { id: 'notes', label: 'Notes', count: manualNotes.length },
    { id: 'history', label: 'Application History', count: historyLogs.length },
  ]

  // ─── Order Items ──────────────────────────────────────────────
  function addItem() {
    const defaultType = ITEM_TYPES[0]
    const defaultAmount = DEFAULT_PRICES[defaultType] ?? 0
    setItems(prev => [...prev, { id: crypto.randomUUID(), item_type: defaultType, amount: defaultAmount }])
  }
  function updateItem(id: string, field: 'item_type' | 'amount', value: string | number) {
    setItems(prev => prev.map(it => {
      if (it.id === id) {
        if (field === 'item_type') {
          const typeStr = String(value)
          const defaultAmount = DEFAULT_PRICES[typeStr] ?? 0
          return { ...it, item_type: typeStr, amount: defaultAmount }
        }
        if (field === 'amount') {
          return { ...it, amount: Number(value) }
        }
      }
      return it
    }))
  }
  function removeItem(id: string) {
    setItems(prev => prev.filter(it => it.id !== id))
  }
  async function saveItems() {
    setSaving(true)
    await supabase.from('order_items').delete().eq('order_id', order.id)
    if (items.length > 0) {
      await supabase.from('order_items').insert(
        items.map(it => ({ order_id: order.id, item_type: it.item_type, amount: Number(it.amount) }))
      )
    }
    await supabase.from('orders').update({ amount_total: total }).eq('id', order.id)
    setOrder({ ...order, amount_total: total })
    setSaving(false)
    toast.success('Line items saved')
  }

  // ─── Customer Data ────────────────────────────────────────────
  async function saveCustomerData() {
    setSaving(true)
    const { error } = await supabase.from('orders').update(customerData).eq('id', order.id)
    setSaving(false)
    if (error) {
      toast.error('Failed to update customer data')
    } else {
      setOrder({ ...order, ...customerData })
      setEditingInfo(false)
      toast.success('Customer details updated')
    }
  }

  // ─── Appointments ─────────────────────────────────────────────
  async function handleSaveAppointment() {
    if (!appointmentDate || !appointmentTime) {
      toast.error('Date and time are required')
      return
    }

    setSaving(true)
    const scheduledAt = new Date(`${appointmentDate}T${appointmentTime}:00`).toISOString()
    
    if (reschedulingId) {
      const current = appointments.find(a => a.id === reschedulingId)
      const historyEntry = {
        old_scheduled_at: current?.scheduled_at,
        old_solicitor_id: current?.solicitor_id,
        rescheduled_at: new Date().toISOString()
      }
      const newHistory = [...(current?.reschedule_history || []), historyEntry]
      
      const { data, error } = await supabase.from('appointments').update({
        scheduled_at: scheduledAt,
        solicitor_id: appointmentSolicitor || null,
        notes: appointmentNotes,
        status: 'rescheduled',
        reschedule_history: newHistory
      }).eq('id', reschedulingId).select('*, solicitor:solicitors(full_name)').single()
      
      if (!error && data) {
        setAppointments(prev => prev.map(a => a.id === reschedulingId ? data as Appointment : a))
        toast.success('Appointment rescheduled')
      }
    } else {
      const { data, error } = await supabase.from('appointments').insert({
        order_id: order.id,
        scheduled_at: scheduledAt,
        solicitor_id: appointmentSolicitor || null,
        status: 'scheduled',
        notes: appointmentNotes
      }).select('*, solicitor:solicitors(full_name)').single()

      if (!error && data) {
        setAppointments([...appointments, data as Appointment])
        toast.success('Appointment booked')
      }
    }
    
    setSaving(false)
    setShowAppointmentForm(false)
    setReschedulingId(null)
    setAppointmentDate('')
    setAppointmentTime('')
    setAppointmentNotes('')
    setAppointmentSolicitor('')
  }
  
  async function updateAppointmentStatus(id: string, status: string) {
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id)
    if (!error) {
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a))
      toast.success(`Appointment marked as ${status}`)
    }
  }

  // ─── Status & Notes ───────────────────────────────────────────
  async function setOrderStatus(newStatus: string) {
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', order.id)
    if (error) {
      toast.error(`Failed to update order status: ${error.message || 'Database error'}`)
      return
    }
    setOrder({ ...order, status: newStatus })
    await addTimelineNote(`Status changed to ${newStatus}`, 'Status Change')
    toast.success(`Order marked as ${newStatus}`)
  }

  async function handleDefer() {
    if (!deferDate) {
      toast.error('Please select a review date')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('orders').update({ 
      deferred_until: new Date(deferDate).toISOString(),
      deferred_reason: deferReason 
    }).eq('id', order.id)
    
    if (error) {
      toast.error('Failed to defer application')
    } else {
      setOrder({ ...order, deferred_until: new Date(deferDate).toISOString(), deferred_reason: deferReason } as any)
      await addTimelineNote(`Application deferred until ${formatDateTime(new Date(deferDate).toISOString())}. Reason: ${deferReason}`, 'System')
      toast.success('Application deferred successfully')
      setShowDeferModal(false)
      setDeferDate('')
      setDeferReason('')
    }
    setSaving(false)
  }

  async function handleResume() {
    setSaving(true)
    const { error } = await supabase.from('orders').update({ 
      deferred_until: null,
      deferred_reason: null 
    }).eq('id', order.id)
    
    if (error) {
      toast.error('Failed to resume processing')
    } else {
      setOrder({ ...order, deferred_until: null, deferred_reason: null } as any)
      await addTimelineNote(`Application processing resumed manually.`, 'System')
      toast.success('Processing resumed')
    }
    setSaving(false)
  }

  async function addTimelineNote(message: string, category?: string) {
    const { data: userData } = await supabase.auth.getUser()
    const { data: note } = await supabase
      .from('order_notes')
      .insert({ order_id: order.id, user_id: userData.user?.id, message, category })
      .select('*, user:users(id, full_name, avatar_url)')
      .single()
    if (note) setNotes(prev => [note as OrderNote, ...prev])
  }

  async function submitNote() {
    if (!newNote.trim()) return
    await addTimelineNote(newNote, 'Manual Note')
    setNewNote('')
  }

  // ─── Stripe: Send Payment Link ──────────────────────────
  async function sendPaymentLink() {
    setGeneratingLink(true)
    try {
      const res = await fetch('/api/stripe/payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          amount: total || order.amount_total,
          customer_email: order.email,
          description: `${formType?.name ?? 'Order'} — #${shortId}`,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      await navigator.clipboard.writeText(data.url)
      setCopiedLink(true)
      toast.success('Payment link copied to clipboard!')
      setTimeout(() => setCopiedLink(false), 3000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate payment link'
      toast.error(message)
    } finally {
      setGeneratingLink(false)
    }
  }

  // ─── Stripe: Take Payment on Call ───────────────────────
  async function startTakePayment() {
    try {
      const payAmount = total || Number(order.amount_total)
      const res = await fetch('/api/stripe/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          amount: payAmount,
          description: `${formType?.name ?? 'Order'} — #${shortId}`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPaymentClientSecret(data.clientSecret)
      setShowPaymentForm(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to initialize payment'
      toast.error(message)
    }
  }

  // ─── Stripe: Process Refund ─────────────────────────────
  async function processRefund() {
    if (!canRefund) return
    setProcessingRefund(true)
    try {
      const res = await fetch('/api/stripe/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          amount: refundAmount ? Number(refundAmount) : null,
          reason: refundReason,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success('Refund processed successfully!')
      setShowRefundModal(false)
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Refund failed'
      toast.error(message)
    } finally {
      setProcessingRefund(false)
    }
  }

  // ─── CRM Refund Registration ───────────────────────────
  const REFUND_STATUS_CONFIG: Record<string, { label: string; variant: 'orange' | 'blue' | 'green' | 'red' }> = {
    requested: { label: 'Requested', variant: 'orange' },
    under_review: { label: 'Under Review', variant: 'blue' },
    approved: { label: 'Approved', variant: 'green' },
    rejected: { label: 'Rejected', variant: 'red' },
    paid: { label: 'Paid', variant: 'green' },
  }

  const REFUND_NEXT_STATUS: Record<string, string | null> = {
    requested: 'under_review',
    under_review: 'approved',
    approved: 'paid',
    rejected: null,
    paid: null,
  }

  async function registerRefund() {
    if (!registerRefundAmount || Number(registerRefundAmount) <= 0) {
      toast.error('Please enter a valid refund amount')
      return
    }
    setSubmittingRefund(true)
    try {
      const res = await fetch('/api/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          reason: registerRefundReason,
          refund_amount: Number(registerRefundAmount),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setLinkedRefunds(prev => [{ ...data.refund, created_by_user: { full_name: 'You' } }, ...prev])
      await addTimelineNote(`🔄 Refund registered — £${Number(registerRefundAmount).toFixed(2)}${registerRefundReason ? ` — ${registerRefundReason}` : ''}`, 'Refund')
      toast.success('Refund registered successfully')
      setShowRegisterRefund(false)
      setRegisterRefundAmount('')
      setRegisterRefundReason('')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to register refund'
      toast.error(message)
    } finally {
      setSubmittingRefund(false)
    }
  }

  async function updateLinkedRefundStatus(refundId: string, newStatus: string) {
    setUpdatingRefundId(refundId)
    try {
      const res = await fetch('/api/refunds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refund_id: refundId, status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setLinkedRefunds(prev => prev.map(r => r.id === refundId ? { ...r, status: newStatus } : r))
      const label = REFUND_STATUS_CONFIG[newStatus]?.label || newStatus
      toast.success(`Refund status updated to ${label}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update'
      toast.error(message)
    } finally {
      setUpdatingRefundId(null)
    }
  }

  async function toggleLinkedRefundApproval(refundId: string, currentApproval: boolean) {
    setUpdatingRefundId(refundId)
    try {
      const res = await fetch('/api/refunds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refund_id: refundId, manager_approval: !currentApproval }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setLinkedRefunds(prev => prev.map(r => r.id === refundId ? { ...r, manager_approval: !currentApproval } : r))
      toast.success(!currentApproval ? 'Manager approval granted' : 'Manager approval revoked')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update'
      toast.error(message)
    } finally {
      setUpdatingRefundId(null)
    }
  }

  const infoFields = [
    { key: 'title', label: 'Title' },
    { key: 'first_name', label: 'First Name' },
    { key: 'middle_name', label: 'Middle Name' },
    { key: 'last_name', label: 'Surname' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'address_line1', label: 'Address Line 1' },
    { key: 'address_line2', label: 'Address Line 2' },
    { key: 'city', label: 'City' },
    { key: 'county', label: 'County' },
    { key: 'postcode', label: 'Postcode' },
    { key: 'title_number', label: 'Title Number' },
    { key: 'tenure', label: 'Tenure' },
    { key: 'property_value', label: 'Property Value' },
    { key: 'hmlr_fee', label: 'HMLR Fee' },
    { key: 'tenancy_type', label: 'Tenancy Type' },
  ]

  const inboundStr = order.is_inbound ? 'INBOUND ' : ''
  const brandName = brand?.name?.toUpperCase() || 'ONLINE LAND REGISTRY'
  const headingText = `ORDER #${shortId} - ${inboundStr}${brandName}`

  return (
    <div className="flex flex-col h-full overflow-auto bg-white font-sans">
      {/* Order heading */}
      <div className="px-10 pt-10 pb-4">
        <h1 className="text-[24px] font-bold text-[#0B1B3A] tracking-tight mb-2">{headingText}</h1>
        <div className="text-[14px] text-slate-500">{formatDate(order.created_at)}</div>
      </div>

      {/* Tabs */}
      <div className="px-10 border-b border-slate-100">
        <div className="flex gap-2">
          {tabs.map(tab => {
            const isSelected = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-6 py-3.5 text-[15px] transition-colors relative flex items-center gap-2",
                  isSelected
                    ? "text-[#0B1B3A] font-bold border-b-[3px] border-[#0B1B3A] bg-[#f8f9fa] -mb-[1px]"
                    : "text-slate-500 hover:text-[#0B1B3A] font-medium border-b-[3px] border-transparent"
                )}
                style={{
                  zIndex: isSelected ? 10 : 1
                }}
              >
                <span>{tab.label}</span>
                {(tab.id === 'notes' || tab.id === 'history') && tab.count !== undefined && (
                  <span className="px-2 py-0.5 rounded-[4px] bg-[#dc3545] text-white text-[12px] font-bold leading-none ml-1">
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-5">
        
        {/* INFORMATION TAB */}
        {activeTab === 'information' && (
          <div className="p-10 w-full">
            <table className="w-full text-left border-collapse text-[15px]">
              <tbody>
                {[
                  { label: 'No of properties', value: '1' },
                  { label: 'Properties', value: '0' },
                  { label: 'Property address', value: `${order.address_line1 || ''} ${order.address_line2 || ''} ${order.city || ''} ${order.postcode || ''}`.trim() || '—' },
                  { label: 'Country', value: order.county || 'England' },
                  { label: 'Title number', value: order.title_number || '—' },
                  { label: 'Tenure', value: order.tenure || '—' },
                  { label: 'Title', value: order.title || '—' },
                  { label: 'First name', value: order.first_name || '—' },
                  { label: 'Middle name', value: order.middle_name || '—' },
                  { label: 'Surname', value: order.last_name || '—' },
                  { label: 'Email', value: order.email || '—' },
                  { label: 'Phone', value: order.phone || '—' },
                  { label: 'Property Value', value: order.property_value || '—' },
                  { label: 'HMLR Fee', value: order.hmlr_fee || '—' },
                ].map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-[#f8f9fa]" : "bg-white"}>
                    <td className="py-4 px-5 font-semibold text-slate-700 w-[250px] align-top">{row.label}</td>
                    <td className="py-4 px-5 text-slate-700 align-top break-words">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* BREAKDOWN TAB */}
        {activeTab === 'breakdown' && (
          <div className="p-10 w-full">
            {/* Payment Verified By Section */}
            <div className="mb-8 w-full max-w-[800px]">
              <label className="block text-[14px] text-slate-600 mb-2">Payment Verified By</label>
              <input
                type="text"
                value={paymentVerifiedBy}
                onChange={e => setPaymentVerifiedBy(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-slate-300 rounded-md focus:border-blue-500 focus:outline-none mb-4 text-[15px] text-slate-800 shadow-sm"
              />
              <div className="flex gap-3">
                <button
                  onClick={savePaymentVerifiedBy}
                  className="bg-[#0B1B3A] hover:bg-[#132c57] text-white text-[14px] font-medium px-6 py-2.5 rounded-md transition-colors"
                >
                  Save
                </button>
              </div>
            </div>

            {/* VAT Buttons Row */}
            <div className="flex items-center gap-3 mb-12">
              <button
                onClick={() => toast.success('VAT Receipt sent successfully!')}
                className="bg-[#0B1B3A] hover:bg-[#132c57] text-white text-[14px] font-medium px-6 py-2.5 rounded-md transition-colors"
              >
                Send VAT Receipt
              </button>
              <button
                onClick={() => setShowVatModal(true)}
                className="bg-[#0B1B3A] hover:bg-[#132c57] text-white text-[14px] font-medium px-6 py-2.5 rounded-md transition-colors"
              >
                View VAT Receipt
              </button>
            </div>

            {/* Items Table */}
            <div className="w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[14px] font-bold text-slate-800">
                    <th className="pb-4 px-2">Item ID</th>
                    <th className="pb-4 px-2">Item</th>
                    <th className="pb-4 px-2">Status</th>
                    <th className="pb-4 px-2">Date/Time</th>
                    <th className="pb-4 px-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="text-[14px] text-slate-700">
                  {items.map((item, idx) => {
                    const itemId = String(item.id).slice(-6).toUpperCase()
                    const itemStatus = (idx === 0 && order.status === 'paid') ? 'Complete' : 'Incomplete'
                    return (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="py-5 px-2 font-medium">{itemId}</td>
                        <td className="py-5 px-2">{item.item_type}</td>
                        <td className="py-5 px-2">{itemStatus}</td>
                        <td className="py-5 px-2">{formatDate(order.created_at)}</td>
                        <td className="py-5 px-2 text-right font-medium">£{Number(item.amount).toFixed(2)}</td>
                      </tr>
                    )
                  })}
                  {items.length === 0 && (
                    <tr className="border-b border-slate-100">
                      <td className="py-5 px-2 font-medium">#{shortId}</td>
                      <td className="py-5 px-2">{formType?.name || 'Order Item'}</td>
                      <td className="py-5 px-2">{order.status === 'paid' ? 'Complete' : 'Incomplete'}</td>
                      <td className="py-5 px-2">{formatDate(order.created_at)}</td>
                      <td className="py-5 px-2 text-right font-medium">£{Number(order.amount_total || 0).toFixed(2)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="mt-8 flex justify-end">
                <div className="text-[18px] font-bold text-slate-900">
                  Total £{total.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Status Actions */}
            <div className="flex items-center gap-3 mt-16">
              {(status !== 'abandoned' && status !== 'dead') && (
                <button
                  onClick={() => setOrderStatus('abandoned')}
                  className="bg-[#dc3545] hover:bg-[#c82333] text-white text-[15px] font-medium px-8 py-3 rounded-md transition-colors"
                >
                  Mark Dead
                </button>
              )}
              {(status === 'abandoned' || status === 'dead') && (
                <button
                  onClick={() => setOrderStatus('processing')}
                  className="bg-[#28a745] hover:bg-[#218838] text-white text-[15px] font-medium px-8 py-3 rounded-md transition-colors"
                >
                  Restore Application
                </button>
              )}
              {status !== 'paid' && currentRole !== 'admin' && (
                <button
                  onClick={() => setOrderStatus('no_answer')}
                  className="bg-[#ffc107] hover:bg-[#e0a800] text-[#212529] text-[15px] font-medium px-8 py-3 rounded-md transition-colors"
                >
                  No Answer / Non-UK Phone Number
                </button>
              )}
            </div>
          </div>
        )}

        {/* NOTES TAB */}
        {activeTab === 'notes' && (
          <div className="p-10 w-full max-w-[1000px]">
            {/* Note Entry Area */}
            <div className="mb-10 bg-white border border-slate-300 rounded-md shadow-sm relative overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
              <textarea
                className="w-full min-h-[100px] p-5 bg-transparent border-none focus:ring-0 focus:outline-none text-[15px] text-slate-700 resize-none"
                placeholder="Enter your note here..."
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
              />
              <div className="absolute top-3 right-3">
                <button
                  onClick={submitNote}
                  disabled={!newNote.trim()}
                  className="bg-[#0B1B3A] hover:bg-[#132c57] text-white text-[13px] font-medium px-6 py-2 rounded-md transition-colors disabled:opacity-50 disabled:bg-slate-400"
                >
                  Save Note
                </button>
              </div>
            </div>

            {/* Notes List */}
            <div className="space-y-6">
              {manualNotes.map((note) => (
                <div key={note.id} className="border border-slate-200 bg-white text-[15px] rounded-md overflow-hidden">
                  {note.user?.full_name && (
                    <div className="px-5 py-3.5 border-b border-slate-100 text-slate-700 bg-white">
                      {note.user.full_name}
                    </div>
                  )}
                  <div className="px-5 py-5 text-slate-700 whitespace-pre-wrap bg-white">
                    {note.message}
                  </div>
                  <div className="px-5 py-3.5 bg-[#f8f9fa] text-slate-500 text-[14px] border-t border-slate-100">
                    {formatDate(note.created_at)}
                  </div>
                </div>
              ))}
              {manualNotes.length === 0 && (
                <div className="p-8 text-center text-slate-500 border border-slate-200 bg-[#f8f9fa] rounded-md">
                  No notes yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="p-10 w-full bg-[#f8f9fa] min-h-full">
            <div className="max-w-4xl">
              <div className="space-y-6">
                {historyLogs.map((log) => (
                  <div key={log.id} className="border border-slate-200 bg-white text-[15px] rounded-md overflow-hidden">
                    {log.user?.full_name && (
                      <div className="px-5 py-3.5 border-b border-slate-100 text-slate-700 bg-white font-medium">
                        {log.user.full_name} {log.category ? <span className="text-slate-400 font-normal ml-2">({log.category})</span> : ''}
                      </div>
                    )}
                    <div className="px-5 py-5 text-slate-700 whitespace-pre-wrap bg-white">
                      {log.message}
                    </div>
                    <div className="px-5 py-3.5 bg-[#f8f9fa] text-slate-500 text-[14px] border-t border-slate-100">
                      {formatDate(log.created_at)}
                    </div>
                  </div>
                ))}
                {historyLogs.length === 0 && (
                  <div className="p-8 text-center text-slate-500 border border-slate-200 bg-[#f8f9fa] rounded-md">
                    No history logs yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {copiedLink && (
        <div className="fixed bottom-6 right-6 bg-navy text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium animate-in slide-in-from-bottom-4">
          <Copy className="h-4 w-4" />
          Payment link copied to clipboard
        </div>
      )}

      {showVatModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white max-w-4xl w-full p-8 rounded shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start mb-6 print:hidden">
              <div>
                <h2 className="text-2xl font-bold text-black leading-none">Online Land Registry</h2>
                <div className="text-[15px] font-bold text-black mt-1">VAT Receipt</div>
              </div>
              <button onClick={() => setShowVatModal(false)} className="text-slate-500 hover:text-black">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="hidden print:block mb-6">
              <h2 className="text-2xl font-bold text-black leading-none">Online Land Registry</h2>
              <div className="text-[15px] font-bold text-black mt-1">VAT Receipt</div>
            </div>

            <table className="w-full border-collapse border border-slate-300 text-[14px]">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="py-2 px-3 border-r border-slate-300 text-center font-bold text-black">Item</th>
                  <th className="py-2 px-3 text-center font-bold text-black w-48">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-300">
                  <td className="py-2 px-3 border-r border-slate-300 text-black">Order #{shortId}</td>
                  <td className="py-2 px-3 text-black">£{((total || 0) / 1.2).toFixed(2)}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="py-2 px-3 border-r border-slate-300 text-right font-bold text-black">Sub Total</td>
                  <td className="py-2 px-3 text-black">£{((total || 0) / 1.2).toFixed(2)}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="py-2 px-3 border-r border-slate-300 text-right font-bold text-black">VAT</td>
                  <td className="py-2 px-3 text-black">£{((total || 0) - (total || 0) / 1.2).toFixed(2)}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="py-2 px-3 border-r border-slate-300 text-right font-bold text-black">Total</td>
                  <td className="py-2 px-3 text-black">£{(total || 0).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            <div className="mt-8 text-[12px] leading-tight text-black font-medium">
              <div>Swift Task Services Ltd</div>
              <div>Registered Office: 1 Limbrick, Blackburn, BB1 8AB</div>
              <div>Registered in England - Company Number 17125428</div>
            </div>

            <div className="mt-8 flex justify-end print:hidden">
              <button 
                onClick={() => window.print()}
                className="bg-[#0b2545] hover:bg-[#134074] text-white text-[14px] px-6 py-2 rounded-sm transition-colors"
              >
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
