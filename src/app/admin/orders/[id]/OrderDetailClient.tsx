'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Save, CreditCard, Link2, RotateCcw, Copy, Check, Loader2, ExternalLink, Calendar, RefreshCcw, Clock, ArrowRight, MessageSquare, AlertCircle, ShieldCheck, Search, Upload, Eye, X, FileText, Phone } from 'lucide-react'
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

type Tab = 'breakdown' | 'information' | 'notes' | 'history' | 'process'

interface OrderItem { id: string; item_type: string; amount: number }
interface OrderNote { id: string; message: string; category?: string; created_at: string; user?: { full_name: string; avatar_url?: string } }
interface Appointment { id: string; scheduled_at: string; status: string; solicitor_id: string | null; notes: string | null; solicitor?: { full_name: string } | null; reschedule_history: any[] }
interface User { id: string; full_name: string; role?: string; calendly_link?: string }

interface Props {
  order: Record<string, any>
  relatedOrders: Record<string, unknown>[]
  userRole?: string
  currentUserName?: string
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
  'Map / Land Search',
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
  'Map / Land Search': 41.00,
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
export default function OrderDetailClient({ order: initialOrder, relatedOrders, userRole, currentUserName }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [order, setOrder] = useState(initialOrder)
  const [activeTab, setActiveTab] = useState<Tab>('breakdown')
  const [items, setItems] = useState<OrderItem[]>((order.items as OrderItem[]) ?? [])
  const [newNote, setNewNote] = useState('')
  const [notes, setNotes] = useState<OrderNote[]>((order.notes as OrderNote[]) ?? [])
  const [dialing, setDialing] = useState(false)

  async function handleDial(num: string) {
    if (!num || num === '—') return
    setDialing(true)
    const toastId = toast.loading(`Initiating Sipgate call to ${num}...`)
    try {
      const res = await fetch('/api/sipgate/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callee: num }),
      })
      if (res.ok) {
        toast.success('Call initiated! Pick up your handset or softphone.', { id: toastId })
      } else {
        const err = await res.json()
        toast.error(`Sipgate call failed: ${err.error || 'Unknown error'}`, { id: toastId })
      }
    } catch (e: any) {
      toast.error(`Error: ${e.message}`, { id: toastId })
    } finally {
      setDialing(false)
    }
  }
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
  const [editingItems, setEditingItems] = useState(false)
  
  // Deferral State
  const [showDeferModal, setShowDeferModal] = useState(false)
  const [deferDate, setDeferDate] = useState('')
  const [deferReason, setDeferReason] = useState('')

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadType, setUploadType] = useState('File Upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

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

  const [uploadingAttachment, setUploadingAttachment] = useState(false)

  const handleUploadAttachment = async (file: File, submissionTitle?: string, submissionType?: string) => {
    setUploadingAttachment(true)
    try {
      const fileExt = file.name.split('.').pop()
      const randomString = Math.random().toString(36).substring(2)
      const filePath = `attachments/${order.id}/${randomString}_${file.name}`
      
      const { data, error: uploadError } = await supabase.storage
        .from('order-documents')
        .upload(filePath, file)

      if (uploadError) {
        toast.error('Failed to upload file to storage')
        console.error(uploadError)
        setUploadingAttachment(false)
        return
      }

      const currentAttachments = submissionReqs.attachments || []
      const newAttachments = [...currentAttachments, {
        name: file.name,
        url: filePath,
        uploaded_at: new Date().toISOString(),
        submission_title: submissionTitle || file.name,
        submission_type: submissionType || 'File Upload',
        uploaded_by: currentName || 'Admin'
      }]
      const newReqs = { ...submissionReqs, attachments: newAttachments }

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          submission_requirements: newReqs
        })
        .eq('id', order.id)

      if (updateError) {
        toast.error('Failed to update order in database')
        console.error(updateError)
      } else {
        setSubmissionReqs(newReqs)
        toast.success('Attachment uploaded successfully!')
        await addTimelineNote(
          `Uploaded attachment: ${submissionTitle || file.name} (${submissionType || 'File Upload'}) by ${currentName || 'Admin'}`, 
          'Upload'
        )
      }
    } catch (err) {
      console.error(err)
      toast.error('An error occurred during upload')
    } finally {
      setUploadingAttachment(false)
    }
  }

  const handleDeleteAttachment = async (attToDelete: any) => {
    if (!window.confirm(`Are you sure you want to remove the attachment "${attToDelete.name}"?`)) return

    try {
      await supabase.storage.from('order-documents').remove([attToDelete.url])

      const currentAttachments = submissionReqs.attachments || []
      const newAttachments = currentAttachments.filter((att: any) => att.url !== attToDelete.url)
      const newReqs = { ...submissionReqs, attachments: newAttachments }

      const { error } = await supabase
        .from('orders')
        .update({
          submission_requirements: newReqs
        })
        .eq('id', order.id)

      if (error) {
        toast.error('Failed to remove attachment from database')
        console.error(error)
      } else {
        setSubmissionReqs(newReqs)
        toast.success('Attachment removed!')
        await addTimelineNote(`Removed attachment: ${attToDelete.name}`, 'Delete')
      }
    } catch (err) {
      console.error(err)
      toast.error('An error occurred while removing attachment')
    }
  }

  const handleViewAttachment = async (url: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('order-documents')
        .createSignedUrl(url, 3600)

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

  // Fetch current user role and name
  const [currentRole, setCurrentRole] = useState(userRole || '')
  const [currentName, setCurrentName] = useState(currentUserName || '')

  // VAT Modal state
  const [showVatModal, setShowVatModal] = useState(false)

  // Email Template States
  const [emailTemplates, setEmailTemplates] = useState<{ id: string; name: string; subject: string; body: string }[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [copiedSubject, setCopiedSubject] = useState(false)
  const [copiedBody, setCopiedBody] = useState(false)
  
  useEffect(() => {
    if (!userRole || !currentUserName) {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          supabase.from('users').select('role, full_name').eq('id', data.user.id).single()
            .then(({ data: profile }) => {
              if (!userRole) setCurrentRole(profile?.role ?? '')
              if (!currentUserName) setCurrentName(profile?.full_name ?? '')
            })
        }
      })
    }
  }, [supabase, userRole, currentUserName])

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
    { id: 'process', label: 'Process' },
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
  async function updateMonitorStage(newStage: string) {
    setSaving(true)
    let correspondingStatus = order.status
    if (newStage === 'awaiting') {
      correspondingStatus = 'paid'
    } else if (newStage === 'in_progress') {
      correspondingStatus = 'processing'
    } else if (newStage === 'submitted') {
      correspondingStatus = 'processing'
    } else if (newStage === 'completed') {
      correspondingStatus = 'completed'
    }

    const { error } = await supabase
      .from('orders')
      .update({
        monitor_stage: newStage,
        status: correspondingStatus
      })
      .eq('id', order.id)

    if (error) {
      toast.error(`Failed to update application status: ${error.message}`)
      setSaving(false)
      return
    }

    setMonitorStage(newStage)
    setOrder(prev => ({ ...prev, monitor_stage: newStage, status: correspondingStatus }))
    
    // Log timeline note
    await addTimelineNote(`Application process status changed to: ${newStage.toUpperCase().replace('_', ' ')}`, 'Status Change')
    
    // Auto-select template
    let templateName = ''
    if (newStage === 'awaiting') templateName = 'Purchase Confirmation'
    else if (newStage === 'in_progress') templateName = 'Application Received & Processing'
    else if (newStage === 'submitted') templateName = 'Application Received'
    else if (newStage === 'completed') templateName = 'Application Completed'

    if (templateName) {
      const matched = emailTemplates.find(t => t.name.toLowerCase().includes(templateName.toLowerCase()))
      if (matched) {
        setSelectedTemplateId(matched.id)
      }
    }

    toast.success(`Application status updated to ${newStage.toUpperCase().replace('_', ' ')}`)
    setSaving(false)
  }

  useEffect(() => {
    if (emailTemplates.length > 0 && monitorStage && !selectedTemplateId) {
      let templateName = ''
      if (monitorStage === 'awaiting') templateName = 'Purchase Confirmation'
      else if (monitorStage === 'in_progress') templateName = 'Application Received & Processing'
      else if (monitorStage === 'submitted') templateName = 'Application Received'
      else if (monitorStage === 'completed') templateName = 'Application Completed'

      if (templateName) {
        const matched = emailTemplates.find(t => t.name.toLowerCase().includes(templateName.toLowerCase()))
        if (matched) {
          setSelectedTemplateId(matched.id)
        }
      }
    }
  }, [emailTemplates, monitorStage, selectedTemplateId])

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
      setPaymentClientSecret(data.client_secret)
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
      {order.deferred_until && new Date(order.deferred_until).getTime() > new Date().getTime() && (
        <div className="mx-10 mt-6 p-4 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-indigo-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-indigo-900">Application Currently Deferred</h4>
              <p className="text-xs text-indigo-700/90 font-medium mt-0.5">
                Deferred until <strong className="text-indigo-950">{formatDateTime(order.deferred_until)}</strong>. 
                {order.deferred_reason && <span> Reason: <span className="italic">"{order.deferred_reason}"</span></span>}
              </p>
            </div>
          </div>
          <button
            onClick={handleResume}
            disabled={saving}
            className="bg-white hover:bg-indigo-100/50 text-indigo-700 text-xs font-bold px-4 py-2 rounded-lg border border-indigo-200 shadow-sm transition-all cursor-pointer"
          >
            {saving ? 'Resuming...' : 'Resume Processing'}
          </button>
        </div>
      )}

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
            {isAdminOrDirector && (
              <div className="flex justify-end mb-4">
                {!editingInfo ? (
                  <button
                    onClick={() => setEditingInfo(true)}
                    className="bg-[#0B1B3A] hover:bg-[#132c57] text-white text-[14px] font-medium px-6 py-2 rounded-md transition-colors flex items-center gap-2"
                  >
                    Edit Details
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={saveCustomerData}
                      disabled={saving}
                      className="bg-[#28a745] hover:bg-[#218838] text-white text-[14px] font-medium px-6 py-2 rounded-md transition-colors flex items-center gap-2"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingInfo(false)
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
                      }}
                      className="bg-slate-500 hover:bg-slate-600 text-white text-[14px] font-medium px-6 py-2 rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}

            {!editingInfo ? (
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
                      <td className="py-4 px-5 text-slate-700 align-top break-words flex items-center gap-2">
                        <span>{row.value}</span>
                        {row.label === 'Phone' && row.value && row.value !== '—' && (
                          <button
                            onClick={() => handleDial(String(row.value))}
                            disabled={dialing}
                            title="Call via Sipgate"
                            className="p-1 rounded text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50 transition-colors"
                          >
                            <Phone className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="grid grid-cols-2 gap-6 max-w-4xl">
                <div>
                  <label className="block text-[14px] text-slate-600 mb-1">First Name</label>
                  <input
                    type="text"
                    value={customerData.first_name}
                    onChange={e => setCustomerData({ ...customerData, first_name: e.target.value })}
                    className="w-full h-11 px-3 bg-white border border-slate-300 rounded-md focus:border-blue-500 focus:outline-none mb-4 text-[15px] text-slate-800 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[14px] text-slate-600 mb-1">Middle Name</label>
                  <input
                    type="text"
                    value={customerData.middle_name}
                    onChange={e => setCustomerData({ ...customerData, middle_name: e.target.value })}
                    className="w-full h-11 px-3 bg-white border border-slate-300 rounded-md focus:border-blue-500 focus:outline-none mb-4 text-[15px] text-slate-800 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[14px] text-slate-600 mb-1">Surname</label>
                  <input
                    type="text"
                    value={customerData.last_name}
                    onChange={e => setCustomerData({ ...customerData, last_name: e.target.value })}
                    className="w-full h-11 px-3 bg-white border border-slate-300 rounded-md focus:border-blue-500 focus:outline-none mb-4 text-[15px] text-slate-800 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[14px] text-slate-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={customerData.email}
                    onChange={e => setCustomerData({ ...customerData, email: e.target.value })}
                    className="w-full h-11 px-3 bg-white border border-slate-300 rounded-md focus:border-blue-500 focus:outline-none mb-4 text-[15px] text-slate-800 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[14px] text-slate-600 mb-1">Phone</label>
                  <input
                    type="text"
                    value={customerData.phone}
                    onChange={e => setCustomerData({ ...customerData, phone: e.target.value })}
                    className="w-full h-11 px-3 bg-white border border-slate-300 rounded-md focus:border-blue-500 focus:outline-none mb-4 text-[15px] text-slate-800 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[14px] text-slate-600 mb-1">Address Line 1</label>
                  <input
                    type="text"
                    value={customerData.address_line1}
                    onChange={e => setCustomerData({ ...customerData, address_line1: e.target.value })}
                    className="w-full h-11 px-3 bg-white border border-slate-300 rounded-md focus:border-blue-500 focus:outline-none mb-4 text-[15px] text-slate-800 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[14px] text-slate-600 mb-1">Address Line 2</label>
                  <input
                    type="text"
                    value={customerData.address_line2}
                    onChange={e => setCustomerData({ ...customerData, address_line2: e.target.value })}
                    className="w-full h-11 px-3 bg-white border border-slate-300 rounded-md focus:border-blue-500 focus:outline-none mb-4 text-[15px] text-slate-800 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[14px] text-slate-600 mb-1">City</label>
                  <input
                    type="text"
                    value={customerData.city}
                    onChange={e => setCustomerData({ ...customerData, city: e.target.value })}
                    className="w-full h-11 px-3 bg-white border border-slate-300 rounded-md focus:border-blue-500 focus:outline-none mb-4 text-[15px] text-slate-800 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[14px] text-slate-600 mb-1">County</label>
                  <input
                    type="text"
                    value={customerData.county}
                    onChange={e => setCustomerData({ ...customerData, county: e.target.value })}
                    className="w-full h-11 px-3 bg-white border border-slate-300 rounded-md focus:border-blue-500 focus:outline-none mb-4 text-[15px] text-slate-800 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[14px] text-slate-600 mb-1">Postcode</label>
                  <input
                    type="text"
                    value={customerData.postcode}
                    onChange={e => setCustomerData({ ...customerData, postcode: e.target.value })}
                    className="w-full h-11 px-3 bg-white border border-slate-300 rounded-md focus:border-blue-500 focus:outline-none mb-4 text-[15px] text-slate-800 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[14px] text-slate-600 mb-1">Title Number</label>
                  <input
                    type="text"
                    value={customerData.title_number}
                    onChange={e => setCustomerData({ ...customerData, title_number: e.target.value })}
                    className="w-full h-11 px-3 bg-white border border-slate-300 rounded-md focus:border-blue-500 focus:outline-none mb-4 text-[15px] text-slate-800 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[14px] text-slate-600 mb-1">Tenure</label>
                  <input
                    type="text"
                    value={customerData.tenure}
                    onChange={e => setCustomerData({ ...customerData, tenure: e.target.value })}
                    className="w-full h-11 px-3 bg-white border border-slate-300 rounded-md focus:border-blue-500 focus:outline-none mb-4 text-[15px] text-slate-800 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[14px] text-slate-600 mb-1">Property Value</label>
                  <input
                    type="text"
                    value={customerData.property_value}
                    onChange={e => setCustomerData({ ...customerData, property_value: e.target.value })}
                    className="w-full h-11 px-3 bg-white border border-slate-300 rounded-md focus:border-blue-500 focus:outline-none mb-4 text-[15px] text-slate-800 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[14px] text-slate-600 mb-1">HMLR Fee</label>
                  <input
                    type="text"
                    value={customerData.hmlr_fee}
                    onChange={e => setCustomerData({ ...customerData, hmlr_fee: e.target.value })}
                    className="w-full h-11 px-3 bg-white border border-slate-300 rounded-md focus:border-blue-500 focus:outline-none mb-4 text-[15px] text-slate-800 shadow-sm"
                  />
                </div>
              </div>
            )}
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
                disabled={!isAdminOrDirector}
                value={paymentVerifiedBy}
                onChange={e => setPaymentVerifiedBy(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-slate-300 rounded-md focus:border-blue-500 focus:outline-none mb-4 text-[15px] text-slate-800 shadow-sm disabled:bg-slate-50 disabled:text-slate-500"
              />
              {isAdminOrDirector && (
                <div className="flex gap-3">
                  <button
                    onClick={savePaymentVerifiedBy}
                    className="bg-[#0B1B3A] hover:bg-[#132c57] text-white text-[14px] font-medium px-6 py-2.5 rounded-md transition-colors"
                  >
                    Save
                  </button>
                </div>
              )}
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
              {isAdminOrDirector && (
                <div className="flex justify-end mb-4 gap-2">
                  {!editingItems ? (
                    <button
                      onClick={() => setEditingItems(true)}
                      className="bg-[#0B1B3A] hover:bg-[#132c57] text-white text-[14px] font-medium px-6 py-2 rounded-md transition-colors"
                    >
                      Edit Items
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={addItem}
                        className="bg-[#28a745] hover:bg-[#218838] text-white text-[14px] font-medium px-6 py-2 rounded-md transition-colors"
                      >
                        Add Item
                      </button>
                      <button
                        onClick={async () => {
                          await saveItems()
                          setEditingItems(false)
                        }}
                        disabled={saving}
                        className="bg-[#0B1B3A] hover:bg-[#132c57] text-white text-[14px] font-medium px-6 py-2 rounded-md transition-colors disabled:opacity-50"
                      >
                        Save Line Items
                      </button>
                      <button
                        onClick={() => {
                          setItems((order.items as OrderItem[]) ?? [])
                          setEditingItems(false)
                        }}
                        className="bg-slate-500 hover:bg-slate-600 text-white text-[14px] font-medium px-6 py-2 rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              )}

              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[14px] font-bold text-slate-800">
                    <th className="pb-4 px-2">Item ID</th>
                    <th className="pb-4 px-2">Item</th>
                    <th className="pb-4 px-2">Status</th>
                    <th className="pb-4 px-2">Date/Time</th>
                    <th className="pb-4 px-2 text-right">Amount</th>
                    {editingItems && <th className="pb-4 px-2 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="text-[14px] text-slate-700">
                  {editingItems ? (
                    items.map((item, idx) => {
                      const itemId = String(item.id).slice(-6).toUpperCase()
                      return (
                        <tr key={item.id} className="border-b border-slate-100">
                          <td className="py-5 px-2 font-medium">{itemId}</td>
                          <td className="py-5 px-2">
                            <select
                              value={item.item_type}
                              onChange={e => updateItem(item.id, 'item_type', e.target.value)}
                              className="form-input py-1 text-xs w-64 bg-white border border-slate-300 rounded"
                            >
                              {ITEM_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-5 px-2">Incomplete</td>
                          <td className="py-5 px-2">{formatDate(order.created_at)}</td>
                          <td className="py-5 px-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={item.amount}
                              onChange={e => updateItem(item.id, 'amount', e.target.value)}
                              className="form-input py-1 text-xs w-24 text-right bg-white border border-slate-300 rounded"
                            />
                          </td>
                          <td className="py-5 px-2 text-right">
                            <button
                              onClick={() => removeItem(item.id)}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    items.map((item, idx) => {
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
                    })
                  )}
                  {!editingItems && items.length === 0 && (
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

            {/* Stripe Elements Payment Form */}
            {showPaymentForm && paymentClientSecret && (
              <div className="panel p-6 bg-white border border-slate-200 rounded-md shadow-sm mt-8 max-w-xl">
                <div className="section-heading flex items-center gap-2 mb-4">
                  <CreditCard className="h-4 w-4" />
                  Secure Card Payment
                </div>
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret: paymentClientSecret,
                    appearance: {
                      theme: 'stripe',
                      variables: { colorPrimary: '#16243B', borderRadius: '8px' },
                    },
                  }}
                >
                  <StripePaymentForm
                    orderId={order.id}
                    amount={total}
                    onSuccess={() => {
                      setShowPaymentForm(false)
                      setPaymentClientSecret(null)
                      setOrder(prev => ({ ...prev, status: 'paid' }))
                      router.refresh()
                    }}
                    onCancel={() => {
                      setShowPaymentForm(false)
                      setPaymentClientSecret(null)
                    }}
                  />
                </Elements>
              </div>
            )}

            {/* Status Actions */}
            {isAdminOrDirector && (
              <div className="flex flex-wrap items-center gap-3 mt-16">
                {status !== 'paid' && !showPaymentForm && (
                  <button
                    onClick={startTakePayment}
                    className="bg-[#28a745] hover:bg-[#218838] text-white text-[15px] font-medium px-8 py-3 rounded-md transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <CreditCard className="h-4 w-4" />
                    Take Payment
                  </button>
                )}
                {(status !== 'abandoned' && status !== 'dead') && (
                  <button
                    onClick={() => setOrderStatus('abandoned')}
                    className="bg-[#dc3545] hover:bg-[#c82333] text-white text-[15px] font-medium px-8 py-3 rounded-md transition-colors cursor-pointer"
                  >
                    Mark Dead
                  </button>
                )}
                {(status === 'abandoned' || status === 'dead') && (
                  <button
                    onClick={() => setOrderStatus('processing')}
                    className="bg-[#28a745] hover:bg-[#218838] text-white text-[15px] font-medium px-8 py-3 rounded-md transition-colors cursor-pointer"
                  >
                    Restore Application
                  </button>
                )}
                {status !== 'paid' && currentRole !== 'admin' && (
                  <button
                    onClick={() => setOrderStatus('no_answer')}
                    className="bg-[#ffc107] hover:bg-[#e0a800] text-[#212529] text-[15px] font-medium px-8 py-3 rounded-md transition-colors cursor-pointer"
                  >
                    No Answer / Non-UK Phone Number
                  </button>
                )}
              </div>
            )}
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

        {/* PROCESS TAB */}
        {activeTab === 'process' && (
          <div className="p-10 w-full max-w-4xl bg-white min-h-full">
            <h2 className="text-[18px] font-bold text-[#0B1B3A] mb-6">Application Process Control</h2>
            
            {/* Status Selection Buttons */}
            <div className="mb-10">
              <label className="block text-[14px] font-bold text-slate-700 mb-3">Change Application Status</label>
              <div className="flex flex-wrap gap-3">
                {[
                  { value: 'awaiting', label: 'Awaiting' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'submitted', label: 'Submitted' },
                  { value: 'completed', label: 'Completed' }
                ].map(stage => {
                  const isActiveStage = monitorStage === stage.value
                  return (
                    <button
                      key={stage.value}
                      disabled={saving}
                      onClick={() => updateMonitorStage(stage.value)}
                      className={cn(
                        "px-6 py-3 rounded-lg text-sm font-semibold tracking-wide border transition-all flex items-center gap-2",
                        isActiveStage
                          ? "bg-[#0B1B3A] border-[#0B1B3A] text-white shadow-md scale-105"
                          : "bg-white border-slate-300 text-slate-700 hover:border-[#0B1B3A] hover:text-[#0B1B3A]"
                      )}
                    >
                      {saving && isActiveStage && <Loader2 className="h-4 w-4 animate-spin" />}
                      {stage.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Deferral Control */}
            {order.deferred_until && new Date(order.deferred_until).getTime() > new Date().getTime() ? (
              <div className="mb-10 p-5 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-indigo-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-indigo-900">Application Currently Deferred</h4>
                    <p className="text-xs text-indigo-700/90 mt-1">
                      Deferred until <strong>{formatDateTime(order.deferred_until)}</strong>. 
                      {order.deferred_reason && <span> Reason: <span className="italic">"{order.deferred_reason}"</span></span>}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleResume}
                  disabled={saving}
                  className="bg-white hover:bg-indigo-100/50 text-indigo-700 text-xs font-bold px-4 py-2 rounded-lg border border-indigo-200 shadow-sm transition-all cursor-pointer"
                >
                  Resume Processing
                </button>
              </div>
            ) : (
              <div className="mb-10">
                <label className="block text-[14px] font-bold text-slate-700 mb-3">Defer Application</label>
                <button
                  disabled={saving}
                  onClick={() => {
                    const defaultDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                    setDeferDate(defaultDate)
                    setDeferReason('Awaiting documents')
                    setShowDeferModal(true)
                  }}
                  className="px-6 py-3 rounded-lg text-sm font-semibold tracking-wide border bg-white border-indigo-300 text-indigo-700 hover:bg-indigo-50 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Calendar className="h-4 w-4" />
                  Defer Application...
                </button>
              </div>
            )}

            {/* Related Email Template Section */}
            <div className="border-t border-slate-200 pt-8">
              <h3 className="text-[16px] font-bold text-[#0B1B3A] mb-4">Related Email Template Preview</h3>
              
              <div className="mb-4">
                <label className="block text-[13px] font-semibold text-slate-600 mb-2">Select Email Template</label>
                <select
                  value={selectedTemplateId}
                  onChange={e => setSelectedTemplateId(e.target.value)}
                  className="w-full max-w-[400px] h-10 px-3 bg-white border border-slate-300 rounded-md focus:border-blue-500 focus:outline-none text-[14px]"
                >
                  <option value="">Select a template...</option>
                  {emailTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Template Content Preview */}
              {selectedTemplateId ? (
                (() => {
                  const selectedTemplate = emailTemplates.find(t => t.id === selectedTemplateId)
                  if (!selectedTemplate) return null
                  const renderedSubject = renderTemplate(selectedTemplate.subject)
                  const renderedBody = renderTemplate(selectedTemplate.body)

                  return (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mt-6 space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-[12px] font-extrabold text-slate-500 uppercase tracking-wider">Subject</label>
                          <button
                            onClick={async () => {
                              await navigator.clipboard.writeText(renderedSubject)
                              setCopiedSubject(true)
                              toast.success('Subject copied!')
                              setTimeout(() => setCopiedSubject(false), 2000)
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                          >
                            {copiedSubject ? 'Copied!' : 'Copy Subject'}
                          </button>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 font-semibold shadow-sm">
                          {renderedSubject}
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-[12px] font-extrabold text-slate-500 uppercase tracking-wider">Email Body</label>
                          <button
                            onClick={async () => {
                              await navigator.clipboard.writeText(renderedBody)
                              setCopiedBody(true)
                              toast.success('Email body copied!')
                              setTimeout(() => setCopiedBody(false), 2000)
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                          >
                            {copiedBody ? 'Copied!' : 'Copy Body'}
                          </button>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-lg p-5 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed shadow-sm font-medium">
                          {renderedBody}
                        </div>
                      </div>
                    </div>
                  )
                })()
              ) : (
                <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-semibold">
                  No template selected. Update the application status to automatically load the template.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Order Attachments Section */}
        <div className="mx-10 my-8 border-t border-slate-200 pt-8 max-w-4xl">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-[16px] font-bold text-[#0B1B3A]">Order Attachments</h3>
              <p className="text-xs text-slate-500 mt-0.5">Documents, images, and other supporting files.</p>
            </div>
            {isAdminOrDirector && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="bg-[#0B1B3A] hover:bg-[#132c57] text-white text-[13px] font-medium px-4 py-2 rounded-md transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Upload className="h-4 w-4" />
                  Upload Attachment
                </button>
              </div>
            )}
          </div>

          {/* Attachments List */}
          <div className="space-y-3">
            {(submissionReqs.attachments || []).map((att: any, idx: number) => {
              const displayTitle = att.submission_title || att.name
              const displayType = att.submission_type || 'File Upload'
              const displayAuthor = att.uploaded_by || 'Admin'

              return (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 mt-0.5">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                      <button
                        onClick={() => handleViewAttachment(att.url)}
                        className="hover:text-blue-600 transition-colors font-bold text-slate-800 text-sm text-left leading-snug"
                      >
                        {displayTitle}
                      </button>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500 font-medium">
                        <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold uppercase text-[9px] tracking-wider">
                          {displayType}
                        </span>
                        <span>•</span>
                        <span>Uploaded by <span className="font-semibold text-slate-700">{displayAuthor}</span></span>
                        <span>•</span>
                        <span>{new Date(att.uploaded_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="text-slate-400 italic max-w-[150px] truncate" title={att.name}>{att.name}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleViewAttachment(att.url)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
                      title="View file"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {isAdminOrDirector && (
                      <button
                        onClick={() => handleDeleteAttachment(att)}
                        className="p-1.5 rounded-lg border border-red-100 bg-red-50 hover:bg-red-100 text-red-500 transition-colors"
                        title="Delete attachment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            {(!submissionReqs.attachments || submissionReqs.attachments.length === 0) && (
              <div className="text-center py-8 bg-slate-50/50 border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs font-semibold">
                No attachments uploaded yet.
              </div>
            )}
          </div>
        </div>

        {/* Submit Paper Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 text-left">
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </span>
                  <h2 className="text-xl font-bold text-slate-800">Submit Paper</h2>
                </div>
                <button 
                  onClick={() => {
                    setShowUploadModal(false)
                    setSelectedFile(null)
                    setUploadTitle('')
                    setUploadType('File Upload')
                  }} 
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <form onSubmit={async (e) => {
                e.preventDefault()
                if (!uploadTitle.trim()) {
                  toast.error('You must include a title for this submission.')
                  return
                }
                if (!selectedFile) {
                  toast.error('Please select a file to submit.')
                  return
                }
                await handleUploadAttachment(selectedFile, uploadTitle, uploadType)
                setShowUploadModal(false)
                setSelectedFile(null)
                setUploadTitle('')
                setUploadType('File Upload')
              }} className="p-6 space-y-6">
                
                {/* Submission Type */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                    Submission Type
                    <span className="text-blue-500 cursor-help" title="Select the category of the document you are uploading">❓</span>
                  </label>
                  <select 
                    value={uploadType} 
                    onChange={(e) => setUploadType(e.target.value)}
                    className="w-full md:w-64 text-sm p-2.5 rounded-xl border border-slate-200 bg-white font-medium focus:border-purple-400 focus:ring-1 focus:ring-purple-100 outline-none"
                  >
                    <option value="File Upload">File Upload</option>
                    <option value="Supporting Document">Supporting Document</option>
                    <option value="ID Verification">ID Verification</option>
                    <option value="Signed Form">Signed Form</option>
                    <option value="Proof of Address">Proof of Address</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Submission Title */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mt-2.5">
                    Submission Title
                    <span className="text-red-500" title="Required">*</span>
                    <span className="text-blue-500 cursor-help" title="Give a descriptive name to the uploaded paper">❓</span>
                  </label>
                  <div className="flex-1 w-full md:max-w-xs">
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Signed TR1 Form"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      className="w-full text-sm p-2.5 rounded-xl border border-slate-200 font-medium focus:border-purple-400 focus:ring-1 focus:ring-purple-100 outline-none text-slate-800 bg-white" 
                    />
                    {!uploadTitle.trim() && (
                      <span className="text-xs text-rose-500 mt-1 block">- You must include a title for this paper</span>
                    )}
                  </div>
                </div>

                {/* Author / Uploaded By */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                    Uploaded By
                  </label>
                  <input 
                    type="text" 
                    readOnly 
                    value={currentName || 'Admin'} 
                    className="w-full md:w-64 text-sm p-2.5 rounded-xl border border-slate-100 bg-slate-50 text-slate-500 font-medium cursor-not-allowed outline-none"
                  />
                </div>

                {/* File to Submit */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mt-2.5">
                    File to Submit
                    <span className="text-blue-500 cursor-help" title="Select the file to upload">❓</span>
                  </label>
                  
                  <div className="flex-1 w-full md:max-w-xs border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                    {/* Header/Banner inside file box */}
                    <div className="bg-slate-100/80 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-400" /> Files
                      </span>
                      <label htmlFor="modal-file-picker" className="p-1 rounded bg-[#E9B127] text-white hover:bg-[#d8a11e] transition-colors cursor-pointer">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                      </label>
                      <input 
                        id="modal-file-picker" 
                        type="file" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) setSelectedFile(file)
                        }}
                      />
                    </div>

                    {/* Inner content */}
                    <div className="p-4 flex flex-col items-center justify-center min-h-[140px] text-center">
                      {selectedFile ? (
                        <div className="space-y-2">
                          <div className="w-12 h-12 rounded bg-blue-50 text-blue-500 flex items-center justify-center mx-auto">
                            <FileText className="w-6 h-6" />
                          </div>
                          <p className="text-xs font-semibold text-slate-700 max-w-[200px] truncate">{selectedFile.name}</p>
                          <button type="button" onClick={() => setSelectedFile(null)} className="text-[10px] text-red-500 hover:underline">Remove</button>
                        </div>
                      ) : (
                        <label htmlFor="modal-file-picker" className="cursor-pointer group flex flex-col items-center">
                          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center group-hover:bg-slate-200 transition-colors mb-2">
                            <Upload className="w-5 h-5" />
                          </div>
                          <p className="text-xs font-semibold text-slate-500 group-hover:text-slate-700 transition-colors">Click to upload file</p>
                          <p className="text-[10px] text-slate-400 mt-1">Accepted file types: All file types</p>
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer actions inside form */}
                <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                    <span className="text-red-500">*</span> Required
                  </div>
                  <div className="flex gap-2 w-full md:w-auto justify-end">
                    <button 
                      type="button" 
                      onClick={() => {
                        setShowUploadModal(false)
                        setSelectedFile(null)
                        setUploadTitle('')
                        setUploadType('File Upload')
                      }} 
                      className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={uploadingAttachment}
                      className="bg-[#0B1B3A] hover:bg-[#132c57] text-white text-xs font-bold px-6 py-2.5 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {uploadingAttachment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      Add Submission
                    </button>
                  </div>
                </div>
              </form>
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

      {/* Deferral Modal */}
      {showDeferModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 text-left">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                <h2 className="text-xl font-bold text-slate-800">Defer Application</h2>
              </div>
              <button 
                onClick={() => {
                  setShowDeferModal(false)
                  setDeferDate('')
                  setDeferReason('')
                }} 
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Review Date</label>
                <input
                  type="date"
                  required
                  value={deferDate}
                  onChange={e => setDeferDate(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-slate-300 rounded-md focus:border-indigo-500 focus:outline-none text-[15px] text-slate-800 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Reason for Deferral</label>
                <input
                  type="text"
                  required
                  value={deferReason}
                  onChange={e => setDeferReason(e.target.value)}
                  placeholder="e.g. Awaiting documents"
                  className="w-full h-11 px-3 bg-white border border-slate-300 rounded-md focus:border-indigo-500 focus:outline-none text-[15px] text-slate-800 shadow-sm"
                />
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeferModal(false)
                    setDeferDate('')
                    setDeferReason('')
                  }}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDefer}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Defer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
