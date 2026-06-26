'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Save, CreditCard, Link2, RotateCcw, Copy, Check, Loader2, ExternalLink, Calendar, RefreshCcw, Clock, ArrowRight, MessageSquare, AlertCircle, ShieldCheck, Search, Upload, Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDateTime, timeAgo, cn } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import { toast } from 'sonner'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { CheckSquare } from 'lucide-react'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type Tab = 'information' | 'process' | 'appointments' | 'related' | 'notes'

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
  const [activeTab, setActiveTab] = useState<Tab>('information')
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
      const { data: aData } = await supabase.from('appointments').select('*, solicitor:users(full_name)').eq('order_id', order.id).order('scheduled_at', { ascending: true })
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

  const total = items.reduce((sum, item) => sum + Number(item.amount), 0)

  const canRefund = currentRole === 'director' && status === 'paid' && !!stripePaymentId

  const tabs: { id: Tab; label: React.ReactNode; count?: number; isHighlighted?: boolean }[] = [
    { id: 'information', label: 'Information' },
    { id: 'process', label: 'Process', count: items.length },
    { id: 'appointments', label: <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> ID Verification</span>, count: appointments.length, isHighlighted: true },
    { id: 'related', label: 'Related Orders', count: relatedOrders.length },
    { id: 'notes', label: 'Timeline', count: notes.length },
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
      }).eq('id', reschedulingId).select('*, solicitor:users(full_name)').single()
      
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
      }).select('*, solicitor:users(full_name)').single()

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
    await supabase.from('orders').update({ status: newStatus }).eq('id', order.id)
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Order heading */}
      <div className="border-b px-5 py-3 bg-surface-gray-1">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-bold text-ink-gray-9">ORDER #{shortId}</h1>
          <span className="text-sm text-ink-gray-4">{formatDateTime(order.created_at as string)}</span>
          <div className="ml-2">{status ? <Badge
            label={status.replace('_', ' ')}
            variant={
              status === 'paid' ? 'green' :
              status === 'dead' ? 'red' :
              (status === 'lead' || status === 'no_answer') ? 'orange' :
              status === 'processing' ? 'blue' :
              'gray'
            }
          /> : null}</div>
        </div>
        <div className="text-sm text-ink-gray-5 mt-0.5">
          {brand?.name} · {formType?.name}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b px-5">
        <div className="flex gap-7 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? (tab.isHighlighted ? 'border-purple-600 text-purple-700' : 'border-ink-gray-9 text-ink-gray-9')
                  : (tab.isHighlighted ? 'border-transparent text-purple-500 hover:text-purple-600 hover:border-purple-200' : 'border-transparent text-ink-gray-5 hover:text-ink-gray-7')
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="rounded-full bg-surface-gray-2 px-1.5 py-0.5 text-xs text-ink-gray-5">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-5">
        
        {/* INFORMATION TAB */}
        {activeTab === 'information' && (
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Customer & Order Details</h2>
              {isAdminOrDirector && !editingInfo && (
                <button onClick={() => setEditingInfo(true)} className="text-xs font-bold bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg border border-purple-200">
                  Edit Details
                </button>
              )}
            </div>
            
            <table className="w-full text-sm">
              <tbody>
                <tr className="bg-row-stripe/30">
                  <td className="py-2.5 px-3 font-medium text-ink-gray-5 w-48">Stripe Payment ID</td>
                  <td className="py-2.5 px-3 text-ink-gray-9">
                    {stripePaymentId ? (
                      <a href={`https://dashboard.stripe.com/payments/${stripePaymentId}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-accent-blue hover:underline inline-flex items-center gap-1">
                        {stripePaymentId} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : '—'}
                  </td>
                </tr>
                {infoFields.map((f, i) => {
                  const val = customerData[f.key as keyof typeof customerData];
                  // In non-edit mode, don't show empty fields unless editing
                  if (!editingInfo && !val) return null;
                  
                  return (
                    <tr key={f.key} className={cn(i % 2 === 0 ? 'bg-white' : 'bg-row-stripe/30')}>
                      <td className="py-2.5 px-3 font-medium text-ink-gray-5 w-48 align-middle">{f.label}</td>
                      <td className="py-2.5 px-3 text-ink-gray-9">
                        {editingInfo ? (
                          <input 
                            type="text"
                            className="form-input text-xs w-full py-1.5"
                            value={String(val)}
                            onChange={e => setCustomerData(prev => ({ ...prev, [f.key]: e.target.value }))}
                          />
                        ) : (
                          val
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            
            {editingInfo && (
              <div className="mt-4 flex justify-end gap-3">
                <button onClick={() => {
                  // Reset form
                  setCustomerData({
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
                  setEditingInfo(false)
                }} className="btn-outline">Cancel</button>
                <button onClick={saveCustomerData} disabled={saving} className="btn-solid gap-2">
                  <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* PROCESS TAB */}
        {activeTab === 'process' && (
          <div className="max-w-2xl space-y-5">
            {/* Line items */}
            <div className="panel">
              <div className="section-heading">Line Items</div>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    {isAdminOrDirector ? (
                      <select className="form-input flex-1" value={item.item_type} onChange={e => updateItem(item.id, 'item_type', e.target.value)}>
                        {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : (
                      <div className="form-input flex-1 bg-slate-50 text-slate-500 cursor-not-allowed">{item.item_type}</div>
                    )}
                    
                    <div className="relative w-32">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-gray-4 text-sm">£</span>
                      <input
                        type="number" step="0.01" className="form-input pl-7 w-full"
                        value={item.amount}
                        disabled={!isAdminOrDirector}
                        onChange={e => updateItem(item.id, 'amount', e.target.value)}
                      />
                    </div>
                    {isAdminOrDirector && (
                      <button onClick={() => removeItem(item.id)} className="text-danger-red hover:text-red-700 p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                {isAdminOrDirector && (
                  <button onClick={addItem} className="btn-primary gap-1">
                    <Plus className="h-4 w-4" /> Add Item
                  </button>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <span className="font-semibold text-ink-gray-7">Total</span>
                <span className="text-xl font-bold text-ink-gray-9">{formatCurrency(total)}</span>
              </div>
              {isAdminOrDirector && (
                <div className="mt-3 flex justify-end">
                  <button onClick={saveItems} disabled={saving} className="btn-solid gap-1">
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Items'}
                  </button>
                </div>
              )}
            </div>

            {/* Submission Checklist & Monitor Stage */}
            <div className="panel border-indigo-100 bg-indigo-50/30">
              <div className="section-heading flex items-center gap-2 text-indigo-800">
                <CheckSquare className="h-4 w-4" /> Title Deed Submission Checklist
              </div>
              
              <div className="grid gap-4 md:grid-cols-2 mt-4">
                {/* Requirements Toggles */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Required Documents</label>
                  <div className="space-y-2">
                    {[
                      { key: 'id_verified', label: 'ID Verification Completed' },
                      { key: 'form_signed', label: 'Application Form Signed' },
                      { key: 'docs_uploaded', label: 'Supporting Docs Uploaded' }
                    ].map(req => (
                      <div key={req.key} className="flex flex-col gap-2 bg-white p-3 rounded border shadow-sm hover:border-indigo-200 transition-colors">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            disabled={!isAdminOrDirector}
                            checked={!!submissionReqs[req.key]}
                            onChange={async (e) => {
                              const newReqs = { ...submissionReqs, [req.key]: e.target.checked }
                              setSubmissionReqs(newReqs)
                              await supabase.from('orders').update({ submission_requirements: newReqs }).eq('id', order.id)
                              toast.success('Checklist updated')
                              
                              // Log timeline note
                              await addTimelineNote(`Marked "${req.label}" as ${e.target.checked ? 'Complete' : 'Incomplete'}`, 'Checklist')
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                          />
                          <span className={cn("text-sm font-medium", submissionReqs[req.key] ? "text-indigo-900" : "text-slate-600")}>
                            {req.label}
                          </span>
                        </label>

                        {/* Extra inline actions for docs_uploaded */}
                        {req.key === 'docs_uploaded' && (
                          <div className="pl-6 pt-1 border-t border-slate-100 mt-1 flex flex-col gap-2">
                            {uploadingDoc ? (
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Loader2 className="h-3 w-3 animate-spin" /> Uploading file...
                              </div>
                            ) : documentUrl ? (
                              <div className="flex items-center justify-between gap-2 bg-slate-50 p-1.5 rounded border border-slate-100 text-xs">
                                <span className="truncate max-w-[150px] font-mono text-slate-600" title={documentUrl}>
                                  {documentUrl.split('/').pop()}
                                </span>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <button 
                                    type="button" 
                                    onClick={handleViewDoc}
                                    className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors"
                                    title="View proof"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </button>
                                  {isAdminOrDirector && (
                                    <button 
                                      type="button" 
                                      onClick={handleDeleteDoc}
                                      className="p-1 hover:bg-red-50 rounded text-danger-red transition-colors"
                                      title="Delete proof"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <label className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer hover:underline">
                                  <Upload className="h-3 w-3" />
                                  <span>Upload Document</span>
                                  <input 
                                    type="file" 
                                    disabled={!isAdminOrDirector}
                                    className="hidden" 
                                    onChange={(e) => {
                                      const file = e.target.files?.[0]
                                      if (file) handleUploadDoc(file)
                                    }} 
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stage Dropdown */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monitor Stage</label>
                  <div className="bg-white p-3 rounded border shadow-sm">
                    <select
                      className="form-input w-full font-medium"
                      value={monitorStage}
                      disabled={!isAdminOrDirector}
                      onChange={async e => {
                        const newStage = e.target.value
                        setMonitorStage(newStage)
                        await supabase.from('orders').update({ monitor_stage: newStage }).eq('id', order.id)
                        toast.success('Monitor stage updated')
                        
                        await addTimelineNote(`Moved application stage to: ${newStage.replace('_', ' ').toUpperCase()}`, 'Stage Change')
                      }}
                    >
                      <option value="awaiting">Awaiting Information</option>
                      <option value="in_progress">In Progress</option>
                      <option value="submitted">Submitted</option>
                      <option value="completed">Completed</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-2">
                      Updating this stage will instantly move the application on the <a href="/admin/monitor" className="text-indigo-600 hover:underline">Title Deed Monitor</a> board.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Deferral Panel */}
            {isAdminOrDirector && (
              <div className="panel border-indigo-100">
                <div className="section-heading flex items-center gap-2 text-indigo-700">
                  <Clock className="h-4 w-4" /> Defer Application
                </div>
                
                {(order as any).deferred_until ? (
                  <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <p className="text-sm text-indigo-900 mb-2">
                      <strong>Currently Deferred.</strong> Will resume processing on <span className="font-bold">{formatDateTime((order as any).deferred_until)}</span>
                    </p>
                    <p className="text-xs text-indigo-700 bg-white/60 p-2 rounded border border-indigo-100 mb-3">
                      <strong>Reason:</strong> {(order as any).deferred_reason}
                    </p>
                    <button onClick={handleResume} disabled={saving} className="btn-outline gap-1 border-indigo-300 text-indigo-700 hover:bg-indigo-100">
                      <RefreshCcw className="h-4 w-4" /> {saving ? 'Resuming...' : 'Resume Processing Early'}
                    </button>
                  </div>
                ) : (
                  <div className="mt-3">
                    <p className="text-xs text-ink-gray-5 mb-3">
                      Place this application on hold if you are waiting for customer clarification or missing documents.
                    </p>
                    {showDeferModal ? (
                      <div className="space-y-3 bg-slate-50 border border-slate-200 p-4 rounded-lg">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Review Date</label>
                          <input type="datetime-local" className="form-input w-full" value={deferDate} onChange={e => setDeferDate(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Reason / Notes</label>
                          <textarea className="form-input w-full min-h-[80px]" placeholder="Waiting for ID documents..." value={deferReason} onChange={e => setDeferReason(e.target.value)}></textarea>
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                          <button onClick={() => setShowDeferModal(false)} className="btn-outline">Cancel</button>
                          <button onClick={handleDefer} disabled={saving || !deferDate} className="btn-solid bg-indigo-600 hover:bg-indigo-700 text-white">
                            {saving ? 'Deferring...' : 'Confirm Deferral'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowDeferModal(true)} className="btn-outline gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                        <Clock className="h-4 w-4" /> Defer Application
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}


            {/* STRIPE PAYMENT ACTIONS */}
            {status !== 'paid' && status !== 'dead' && (
              <div className="panel">
                <div className="section-heading flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Actions
                </div>

                {showPaymentForm && paymentClientSecret ? (
                  <div className="mt-3">
                    <Elements stripe={stripePromise} options={{ clientSecret: paymentClientSecret, appearance: { theme: 'stripe' } }}>
                      <StripePaymentForm
                        orderId={order.id as string}
                        amount={total || Number(order.amount_total)}
                        onSuccess={() => { setShowPaymentForm(false); setPaymentClientSecret(null) }}
                        onCancel={() => { setShowPaymentForm(false); setPaymentClientSecret(null) }}
                      />
                    </Elements>
                  </div>
                ) : (
                  <div className="space-y-2 mt-3">
                    <button onClick={sendPaymentLink} disabled={generatingLink} className="btn-primary w-full py-3 text-base font-semibold gap-2">
                      {generatingLink ? <Loader2 className="h-5 w-5 animate-spin" /> : copiedLink ? <Check className="h-5 w-5" /> : <Link2 className="h-5 w-5" />}
                      {generatingLink ? 'Generating...' : copiedLink ? 'Link Copied!' : 'Send Payment Link'}
                    </button>
                    <button onClick={startTakePayment} className="btn-success w-full py-3 text-base font-semibold gap-2">
                      <CreditCard className="h-5 w-5" /> Take Payment on Call
                    </button>
                  </div>
                )}
              </div>
            )}

            {status === 'paid' && stripePaymentId && (
              <div className="panel">
                <div className="section-heading flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Payment Information
                </div>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-gray-5">Stripe Payment ID</span>
                    <a href={`https://dashboard.stripe.com/payments/${stripePaymentId}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-accent-blue hover:underline inline-flex items-center gap-1">
                      {stripePaymentId} <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-gray-5">Amount Paid</span>
                    <span className="font-semibold text-success-green">{formatCurrency(Number(order.amount_total))}</span>
                  </div>
                </div>
              </div>
            )}

            {canRefund && (
              <div className="panel border-red-200">
                <div className="section-heading flex items-center gap-2 text-danger-red">
                  <RotateCcw className="h-4 w-4" /> Stripe Refund
                </div>
                {showRefundModal ? (
                  <div className="mt-3 space-y-3">
                    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                      <strong>⚠️ Warning:</strong> This will process a real refund on your Stripe account.
                    </div>
                    <div>
                      <label className="form-label">Refund Amount (leave blank for full refund)</label>
                      <div className="relative w-48">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-gray-4 text-sm">£</span>
                        <input type="number" step="0.01" className="form-input pl-7 w-full" placeholder={String(order.amount_total)} value={refundAmount} onChange={e => setRefundAmount(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="form-label">Reason</label>
                      <select className="form-input w-64" value={refundReason} onChange={e => setRefundReason(e.target.value)}>
                        <option value="requested_by_customer">Requested by Customer</option>
                        <option value="duplicate">Duplicate</option>
                        <option value="fraudulent">Fraudulent</option>
                      </select>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={processRefund} disabled={processingRefund} className="btn-danger gap-2">
                        {processingRefund ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                        {processingRefund ? 'Processing...' : 'Confirm Refund'}
                      </button>
                      <button onClick={() => setShowRefundModal(false)} className="btn-outline">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowRefundModal(true)} className="btn-danger w-full py-3 text-base font-semibold gap-2 mt-3">
                    <RotateCcw className="h-5 w-5" /> Issue Stripe Refund
                  </button>
                )}
              </div>
            )}

            {/* ─── CRM REFUND SYSTEM ─────────────────────────────────── */}
            <div className="panel border-purple-200">
              <div className="flex items-center justify-between">
                <div className="section-heading flex items-center gap-2 text-purple-800">
                  <RotateCcw className="h-4 w-4" /> Refund System
                </div>
                <button
                  onClick={() => {
                    setShowRegisterRefund(true)
                    setRegisterRefundAmount(String(order.amount_total || ''))
                    setRegisterRefundReason('')
                  }}
                  className="text-xs font-bold bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors inline-flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Register Refund
                </button>
              </div>

              {/* Register refund form */}
              {showRegisterRefund && (
                <div className="mt-4 bg-purple-50/50 border border-purple-200 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-bold text-purple-900">Register New Refund</h4>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Refund Amount</label>
                    <div className="relative w-48">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-gray-4 text-sm">£</span>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input pl-7 w-full"
                        placeholder={String(order.amount_total)}
                        value={registerRefundAmount}
                        onChange={e => setRegisterRefundAmount(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Reason</label>
                    <textarea
                      className="form-input w-full resize-none text-sm"
                      rows={2}
                      placeholder="Describe the reason for this refund..."
                      value={registerRefundReason}
                      onChange={e => setRegisterRefundReason(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <button onClick={() => setShowRegisterRefund(false)} className="btn-outline text-xs">Cancel</button>
                    <button
                      onClick={registerRefund}
                      disabled={submittingRefund || !registerRefundAmount}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-md text-xs font-bold transition-colors inline-flex items-center gap-1"
                    >
                      {submittingRefund ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                      {submittingRefund ? 'Registering...' : 'Register Refund'}
                    </button>
                  </div>
                </div>
              )}

              {/* Linked refunds list */}
              {linkedRefunds.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {linkedRefunds.map(refund => {
                    const cfg = REFUND_STATUS_CONFIG[refund.status] || { label: refund.status, variant: 'gray' as const }
                    const nextStatus = REFUND_NEXT_STATUS[refund.status]
                    const isUpdating = updatingRefundId === refund.id
                    return (
                      <div key={refund.id} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                        <div className="flex items-center justify-between p-3 bg-slate-50/60 border-b border-slate-100">
                          <div className="flex items-center gap-3">
                            <Badge label={cfg.label.toUpperCase()} variant={cfg.variant} />
                            <span className="text-sm font-bold text-danger-red">
                              {formatCurrency(Number(refund.refund_amount))}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full',
                              refund.manager_approval
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            )}>
                              {refund.manager_approval ? <ShieldCheck className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                              {refund.manager_approval ? 'Director Approved' : 'Approval Pending'}
                            </span>
                          </div>
                        </div>
                        {refund.reason && (
                          <div className="px-3 py-2 text-sm text-slate-600 border-b border-slate-100">
                            <strong className="text-slate-700">Reason:</strong> {refund.reason}
                          </div>
                        )}
                        <div className="px-3 py-2 flex items-center justify-between">
                          <div className="text-[11px] text-ink-gray-4">
                            Registered by {refund.created_by_user?.full_name || '—'} · {timeAgo(refund.created_at)}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isAdminOrDirector && nextStatus && (
                              <button
                                onClick={() => updateLinkedRefundStatus(refund.id, nextStatus)}
                                disabled={isUpdating}
                                className="text-[11px] font-bold px-2 py-1 border rounded-md bg-white hover:bg-purple-50 text-purple-700 border-purple-200 transition-colors inline-flex items-center gap-1"
                              >
                                {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
                                {REFUND_STATUS_CONFIG[nextStatus]?.label || nextStatus}
                              </button>
                            )}
                            {isAdminOrDirector && refund.status !== 'rejected' && refund.status !== 'paid' && (
                              <button
                                onClick={() => updateLinkedRefundStatus(refund.id, 'rejected')}
                                disabled={isUpdating}
                                className="text-[11px] font-bold px-2 py-1 border border-red-200 rounded-md bg-red-50 hover:bg-red-100 text-red-700 transition-colors"
                              >
                                Reject
                              </button>
                            )}
                            {currentRole === 'director' && refund.status !== 'paid' && (
                              <button
                                onClick={() => toggleLinkedRefundApproval(refund.id, refund.manager_approval)}
                                disabled={isUpdating}
                                className={cn(
                                  "text-[11px] font-bold px-2 py-1 border rounded-md transition-colors inline-flex items-center gap-1",
                                  refund.manager_approval
                                    ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                                )}
                              >
                                <ShieldCheck className="h-3 w-3" />
                                {refund.manager_approval ? 'Revoke' : 'Approve'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : !showRegisterRefund && (
                <div className="mt-4 text-center py-6 bg-slate-50 border border-slate-100 rounded-lg">
                  <RotateCcw className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No refunds registered for this order</p>
                </div>
              )}
            </div>

            {/* Email Templates Panel */}
            <div className="panel border-slate-200">
              <div className="section-heading flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-slate-500" />
                Email Templates
              </div>
              <p className="text-xs text-ink-gray-5 mb-3">
                Select a standard template to preview and copy communications for this order.
              </p>
              
              <div className="space-y-3">
                <select
                  className="form-input w-full"
                  value={selectedTemplateId}
                  onChange={e => {
                    setSelectedTemplateId(e.target.value)
                    setCopiedSubject(false)
                    setCopiedBody(false)
                  }}
                >
                  <option value="">Select a template...</option>
                  {emailTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>

                {selectedTemplateId && (() => {
                  const t = emailTemplates.find(tem => tem.id === selectedTemplateId)
                  if (!t) return null
                  const renderedSubject = renderTemplate(t.subject)
                  const renderedBody = renderTemplate(t.body)
                  
                  return (
                    <div className="space-y-4 border-t pt-3 mt-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Subject Line</label>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(renderedSubject)
                              setCopiedSubject(true)
                              toast.success('Subject copied!')
                              setTimeout(() => setCopiedSubject(false), 2000)
                            }}
                            className="text-[10px] font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded transition-colors"
                          >
                            <Copy className="h-3 w-3" />
                            {copiedSubject ? 'Copied!' : 'Copy Subject'}
                          </button>
                        </div>
                        <input
                          type="text"
                          readOnly
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-800 outline-none"
                          value={renderedSubject}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Email Body</label>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(renderedBody)
                              setCopiedBody(true)
                              toast.success('Email body copied!')
                              setTimeout(() => setCopiedBody(false), 2000)
                            }}
                            className="text-[10px] font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded transition-colors"
                          >
                            <Copy className="h-3 w-3" />
                            {copiedBody ? 'Copied!' : 'Copy Body'}
                          </button>
                        </div>
                        <textarea
                          readOnly
                          rows={10}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-medium text-slate-700 leading-relaxed outline-none resize-y"
                          value={renderedBody}
                        />
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>

            <div className="space-y-2">
              {status !== 'dead' && (
                <button onClick={() => setOrderStatus('dead')} className="btn-danger w-full py-3 text-base font-semibold">
                  Dead
                </button>
              )}
              {status !== 'paid' && (
                <button onClick={() => setOrderStatus('no_answer')} className="btn-warning w-full py-3 text-base font-semibold">
                  No Answer / Non-UK Phone Number
                </button>
              )}
            </div>
          </div>
        )}

        {/* APPOINTMENTS TAB */}
        {activeTab === 'appointments' && (
          <div className="max-w-2xl space-y-6">
            <div className="flex justify-between items-center bg-purple-50 p-4 rounded-xl border border-purple-100">
              <div>
                <h2 className="font-bold text-slate-800 text-sm">ID Verification Bookings</h2>
                <p className="text-xs text-slate-500 mt-1">Status: {status === 'paid' ? <strong className="text-emerald-600">PAID</strong> : <strong className="text-amber-600">UNPAID</strong>} (Time slots usually require payment)</p>
              </div>
              <button 
                onClick={() => {
                  setShowAppointmentForm(true)
                  setReschedulingId(null)
                  setAppointmentDate('')
                  setAppointmentTime('')
                  setAppointmentNotes('')
                  setAppointmentSolicitor('')
                }} 
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
              >
                + Book Appointment
              </button>
            </div>
            
            {showAppointmentForm && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="font-bold text-slate-800 text-sm mb-4 border-b pb-2">
                  {reschedulingId ? 'Reschedule Appointment' : 'New Appointment'}
                </h3>
                
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Assign Solicitor (Optional)</label>
                  <select className="form-input w-full text-sm text-slate-800" value={appointmentSolicitor} onChange={e => setAppointmentSolicitor(e.target.value)}>
                    <option value="">-- Unassigned --</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({s.role?.toUpperCase()}){s.calendly_link ? ' - Calendly Linked' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {(() => {
                  const selectedStaffSolicitor = staff.find(s => s.id === appointmentSolicitor);
                  return selectedStaffSolicitor?.calendly_link ? (
                    <div className="space-y-4 mb-4">
                      <div className="border border-purple-100 rounded-xl p-3 bg-purple-50/30">
                        <div className="text-xs font-bold text-purple-900 mb-2 flex items-center justify-between">
                          <span>Calendly Availability for {selectedStaffSolicitor.full_name}</span>
                          <a href={selectedStaffSolicitor.calendly_link} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline inline-flex items-center gap-0.5">
                            Open in new tab ↗
                          </a>
                        </div>
                        <div className="bg-white border border-purple-100 rounded-lg overflow-hidden h-[360px]">
                          <iframe
                            src={selectedStaffSolicitor.calendly_link}
                            width="100%"
                            height="100%"
                            className="border-0 w-full h-full"
                          />
                        </div>
                      </div>

                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs">
                        <p className="font-semibold mb-1">📅 Booking via Calendly:</p>
                        <p className="text-slate-600 leading-relaxed">Once you schedule using the Calendly widget above, the appointment is automatically synced. You do not need to fill out the manual date/time inputs below. Just click <strong>"Done (Booked via Calendly)"</strong>.</p>
                      </div>

                      <div className="border-t border-dashed border-slate-200 pt-3 mt-3">
                        <div className="text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wider">Or schedule manually (override):</div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                            <input type="date" className="form-input w-full text-sm" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Time</label>
                            <input type="time" className="form-input w-full text-sm" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                        <input type="date" className="form-input w-full text-sm" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Time</label>
                        <input type="time" className="form-input w-full text-sm" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)} />
                      </div>
                    </div>
                  );
                })()}

                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                  <textarea className="form-input w-full text-sm resize-none" rows={2} value={appointmentNotes} onChange={e => setAppointmentNotes(e.target.value)}></textarea>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowAppointmentForm(false)} className="btn-outline text-xs py-1.5">Cancel</button>
                  {(() => {
                    const selectedStaffSolicitor = staff.find(s => s.id === appointmentSolicitor);
                    return selectedStaffSolicitor?.calendly_link ? (
                      <>
                        <button 
                          onClick={async () => {
                            toast.success('Done! The booking will sync automatically via webhook in a few seconds.')
                            setShowAppointmentForm(false)
                            setTimeout(async () => {
                              const { data: aData } = await supabase.from('appointments').select('*, solicitor:users(full_name)').eq('order_id', order.id).order('scheduled_at', { ascending: true })
                              if (aData) setAppointments(aData)
                            }, 2000)
                          }} 
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-md text-xs font-bold transition-colors"
                        >
                          Done (Booked via Calendly)
                        </button>
                        {appointmentDate && appointmentTime && (
                          <button onClick={handleSaveAppointment} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-md text-xs font-bold">
                            {saving ? 'Saving...' : 'Save Manual Booking'}
                          </button>
                        )}
                      </>
                    ) : (
                      <button onClick={handleSaveAppointment} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-md text-xs font-bold">
                        {saving ? 'Saving...' : 'Save Booking'}
                      </button>
                    );
                  })()}
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              {appointments.length === 0 && !showAppointmentForm && (
                <div className="text-center p-8 bg-slate-50 border border-slate-100 rounded-xl">
                  <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-500">No appointments scheduled</p>
                </div>
              )}
              {appointments.map(appt => (
                <div key={appt.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                  <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-purple-600" />
                      <div>
                        <div className="font-bold text-slate-800">{formatDateTime(appt.scheduled_at)}</div>
                        <div className="text-xs font-medium text-slate-500 mt-0.5">Solicitor: {appt.solicitor?.full_name || 'Unassigned'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        label={appt.status.toUpperCase()} 
                        variant={appt.status === 'completed' ? 'green' : appt.status === 'rescheduled' ? 'orange' : appt.status === 'cancelled' ? 'red' : 'blue'} 
                      />
                    </div>
                  </div>
                  
                  {appt.notes && (
                    <div className="p-4 border-b border-slate-100 text-sm text-slate-600 bg-white">
                      <strong>Notes:</strong> {appt.notes}
                    </div>
                  )}
                  
                  {appt.reschedule_history && appt.reschedule_history.length > 0 && (
                    <div className="p-4 border-b border-slate-100 bg-amber-50/30">
                      <p className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1.5"><RefreshCcw className="h-3 w-3" /> Reschedule History</p>
                      <ul className="space-y-1">
                        {appt.reschedule_history.map((h, i) => (
                          <li key={i} className="text-[11px] text-amber-700 font-medium">
                            • Was scheduled for {formatDateTime(h.old_scheduled_at)} (Moved on {new Date(h.rescheduled_at).toLocaleDateString('en-GB')})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="p-3 bg-slate-50 flex gap-2 justify-end">
                    {appt.status !== 'completed' && appt.status !== 'cancelled' && (
                      <>
                        <button 
                          onClick={() => {
                            const d = new Date(appt.scheduled_at)
                            setAppointmentDate(d.toISOString().split('T')[0])
                            setAppointmentTime(d.toTimeString().substring(0, 5))
                            setAppointmentSolicitor(appt.solicitor_id || '')
                            setAppointmentNotes(appt.notes || '')
                            setReschedulingId(appt.id)
                            setShowAppointmentForm(true)
                          }}
                          className="text-[11px] font-bold px-3 py-1.5 border border-slate-200 rounded-md bg-white hover:bg-slate-100 text-slate-700"
                        >
                          Reschedule
                        </button>
                        <button onClick={() => updateAppointmentStatus(appt.id, 'completed')} className="text-[11px] font-bold px-3 py-1.5 border border-emerald-200 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700">
                          Mark Completed
                        </button>
                        <button onClick={() => updateAppointmentStatus(appt.id, 'cancelled')} className="text-[11px] font-bold px-3 py-1.5 border border-red-200 rounded-md bg-red-50 hover:bg-red-100 text-red-700">
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RELATED ORDERS TAB */}
        {activeTab === 'related' && (
          <div className="max-w-2xl">
            {relatedOrders.length === 0 ? (
              <p className="text-sm text-ink-gray-4 py-4">No related orders found</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th><th>Form Type</th><th>Amount</th><th>Status</th><th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {relatedOrders.map((r) => (
                    <tr key={r.id as string} className="cursor-pointer hover:bg-surface-gray-1"
                      onClick={() => router.push(`/admin/orders/${r.id}`)}>
                      <td className="font-mono text-xs">#{String(r.id).slice(-6).toUpperCase()}</td>
                      <td>{(r.form_type as { name: string } | null)?.name}</td>
                      <td>{formatCurrency(Number(r.amount_total))}</td>
                      <td><Badge label={String(r.status)} variant={r.status === 'paid' ? 'green' : 'gray'} /></td>
                      <td className="text-xs">{formatDateTime(r.created_at as string)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* NOTES / TIMELINE TAB */}
        {activeTab === 'notes' && (
          <div className="max-w-2xl space-y-4">
            <div className="panel">
              <textarea
                className="form-input w-full resize-none"
                rows={3}
                placeholder="Add a note..."
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
              />
              <div className="mt-2 flex justify-end">
                <button onClick={submitNote} className="btn-primary">Add Note</button>
              </div>
            </div>

            <div className="space-y-0">
              {notes.map((note, i) => (
                <div key={note.id} className="activity-item">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      'mt-1 h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-medium',
                      'bg-surface-gray-2 text-ink-gray-5'
                    )}>
                      <Avatar label={note.user?.full_name ?? '?'} size="sm" image={note.user?.avatar_url} />
                    </div>
                    {i < notes.length - 1 && <div className="mt-1 w-px flex-1 bg-outline-gray-2" />}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-ink-gray-9">{note.user?.full_name ?? 'System'}</span>
                      {note.category && (
                        <span className="text-xs font-medium text-ink-gray-4">{note.category}</span>
                      )}
                      <span className="ml-auto text-xs text-ink-gray-4">{timeAgo(note.created_at)}</span>
                    </div>
                    <p className="mt-1 text-sm text-ink-gray-7">{note.message}</p>
                  </div>
                </div>
              ))}
              {notes.length === 0 && (
                <p className="text-sm text-ink-gray-4 py-4 text-center">No notes yet</p>
              )}
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
    </div>
  )
}
