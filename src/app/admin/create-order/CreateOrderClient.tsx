'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, PhoneOff, ChevronRight, CreditCard, Link2, Loader2, Check, Copy, Trash2, Upload, Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency } from '@/lib/utils'
import { calculateHMLRFee, getScaleForFormType } from '@/lib/hmlr-fees'
import { toast } from 'sonner'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

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


type WizardStep = 'landing' | 'form-type' | 'wizard' | 'upsells' | 'review'

interface Brand { id: string; code: string; name: string; domain?: string }
interface FormType { id: string; code: string; name: string; brand_ids: string[]; base_price: number; fee_scale?: string; tc_template?: string; business_id?: string }

interface Props { brands: Brand[] }

interface UpsellSelections {
  faster_docs: boolean
  printed_copy: boolean
  sms_updates: boolean
}

const UPSELL_PRICES = {
  faster_docs: 10,
  printed_copy: 7.5,
  sms_updates: 4,
}

export default function CreateOrderClient({ brands }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<WizardStep>('landing')
  const [isInbound, setIsInbound] = useState<boolean | null>(null)
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [formTypes, setFormTypes] = useState<FormType[]>([])
  const [selectedFormType, setSelectedFormType] = useState<FormType | null>(null)
  const [wizardStep, setWizardStep] = useState(0)
  const [upsells, setUpsells] = useState<UpsellSelections>({ faster_docs: false, printed_copy: false, sms_updates: false })
  const [submitting, setSubmitting] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Form data
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [propertyValue, setPropertyValue] = useState('')
  const [hmlrFee, setHmlrFee] = useState(0)
  const [termsAccepted, setTermsAccepted] = useState(false)

  // Payment mode
  const [paymentMode, setPaymentMode] = useState<'link' | 'card' | null>(null)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null)
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)
  const [orderItems, setOrderItems] = useState<{ id: string; item_type: string; amount: number }[]>([])

  useEffect(() => {
    if (!selectedBrand) return
    supabase
      .from('form_types')
      .select('id, code, name, brand_ids, base_price, fee_scale, tc_template, business_id')
      .order('name')
      .then(({ data }) => {
        if (!data) {
          setFormTypes([])
          return
        }

        const orderOfServices = [
          { code: 'TITLE_REGISTER', name: 'Title Register' },
          { code: 'TITLE_PLAN', name: 'Title Plan' },
          { code: 'DEED_SEARCH', name: 'Deed Search', isStatic: true, fallbackCode: 'MAP_SEARCH' },
          { code: 'MAP_SEARCH', name: 'Map / Land Search (no address)' },
          { code: 'PROPERTY_OWNERSHIP', name: 'Property Ownership (Register + Plan)' },
          { code: 'PROPERTY_ALERT', name: 'Property Alert Service', isStatic: true, fallbackCode: 'PROPERTY_OWNERSHIP' },
          { code: 'TR1', name: 'Transfer of Equity' },
          { code: 'AP1', name: 'Name Change on Deeds' },
          { code: 'DJP', name: 'Death of a Joint Proprietor' },
          { code: 'AS1', name: 'Transfer of Equity (Wills / Probate)' },
          { code: 'SEV', name: 'Tenants in Common' },
          { code: 'FR1', name: 'First Registration' }
        ]

        const mappedServices: FormType[] = orderOfServices.map(item => {
          const targetCode = item.isStatic ? item.fallbackCode : item.code
          const dbItem = data.find(s => s.code === targetCode)
          return {
            id: dbItem?.id || '',
            code: item.code,
            name: item.name,
            brand_ids: dbItem?.brand_ids || [],
            base_price: dbItem?.base_price || 0,
            fee_scale: dbItem?.fee_scale,
            tc_template: dbItem?.tc_template,
            business_id: dbItem?.business_id
          }
        }).filter(item => item.id !== '')

        setFormTypes(mappedServices)
      })
  }, [selectedBrand, supabase])

  useEffect(() => {
    if (!selectedFormType || !propertyValue) { setHmlrFee(0); return }
    const scale = getScaleForFormType(selectedFormType.code)
    if (scale) {
      setHmlrFee(calculateHMLRFee(Number(propertyValue), scale))
    }
  }, [selectedFormType, propertyValue])

  const SERVICE_RETAIL_VALS: Record<string, number> = {
    TITLE_REGISTER: 36.00,
    TITLE_PLAN: 36.00,
    MAP_SEARCH: 41.00,
    PROPERTY_OWNERSHIP: 60.00,
    FR1: 600.00, // First Registration
    AP1: 150.00, // Name Change
    DJP: 400.00, // Death of Joint Proprietor
    TR1: 450.00, // Transfer of Equity
    TP1: 450.00, // Transfer of Part / Equity
    COG1: 150.00, // Name/Address change
    SEV: 350.00, // Severance / restriction
    RX3: 350.00, // Removal of a Restriction
    ADV1: 450.00, // Adverse Possession
    AS1: 450.00, // Assent of Whole / Wills & Probate
    DEED_SEARCH: 45.00,
    PROPERTY_ALERT: 45.00,
  }

  const basePrice = selectedFormType ? (SERVICE_RETAIL_VALS[selectedFormType.code] ?? selectedFormType.base_price) : 0
  const upsellTotal = (upsells.faster_docs ? UPSELL_PRICES.faster_docs : 0)
    + (upsells.printed_copy ? UPSELL_PRICES.printed_copy : 0)
    + (upsells.sms_updates ? UPSELL_PRICES.sms_updates : 0)
  const staticGrandTotal = basePrice + upsellTotal + hmlrFee
  const grandTotal = orderItems.length > 0 
    ? orderItems.reduce((sum, item) => sum + Number(item.amount), 0)
    : staticGrandTotal

  function setField(key: string, value: string) {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  async function createOrderInDB() {
    const { data: { user } } = await supabase.auth.getUser()

    const orderPayload = {
      brand_id: selectedBrand!.id,
      form_type_id: selectedFormType!.id,
      business_id: selectedFormType!.business_id,
      user_id: user?.id,
      is_inbound: isInbound,
      status: 'lead',
      priority: 'standard',
      amount_total: grandTotal,
      terms_accepted: termsAccepted,
      title: formData.title,
      first_name: formData.first_name,
      middle_name: formData.middle_name,
      last_name: formData.last_name,
      email: formData.email,
      phone: formData.phone,
      address_line1: formData.address_line1,
      address_line2: formData.address_line2,
      city: formData.city,
      county: formData.county,
      postcode: formData.postcode,
      title_number: formData.title_number,
      tenure: formData.tenure,
      property_value: propertyValue ? Number(propertyValue) : null,
      hmlr_fee: hmlrFee || null,
      tenancy_type: formData.tenancy_type,
      is_mortgaged: formData.is_mortgaged === 'yes',
    }

    const { data: newOrder, error } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select()
      .single()

    if (error || !newOrder) {
      toast.error('Failed to create order')
      return null
    }

    const lineItems = orderItems.map(item => ({
      order_id: newOrder.id,
      item_type: item.item_type,
      amount: Number(item.amount)
    }))
    await supabase.from('order_items').insert(lineItems)

    if (selectedFile) {
      try {
        const fileExt = selectedFile.name.split('.').pop()
        const filePath = `${newOrder.id}/${Math.random().toString(36).substring(2)}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('order-documents')
          .upload(filePath, selectedFile)

        if (uploadError) {
          toast.error('Failed to upload file to storage, but order was created')
          console.error(uploadError)
        } else {
          const newReqs = { docs_uploaded: true, id_verified: false, form_signed: false }
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              document_url: filePath,
              submission_requirements: newReqs,
              status: 'Documents Uploaded'
            })
            .eq('id', newOrder.id)

          if (updateError) {
            console.error(updateError)
          } else {
            newOrder.document_url = filePath
            newOrder.submission_requirements = newReqs
            newOrder.status = 'Documents Uploaded'
            
            await supabase.from('order_notes').insert({
              order_id: newOrder.id,
              user_id: user?.id,
              message: `Uploaded document during creation: ${selectedFile.name} (marked "Supporting Docs Uploaded" as Complete)`,
              category: 'Document Uploaded',
            })
          }
        }
      } catch (uploadErr) {
        console.error(uploadErr)
        toast.error('An error occurred during file upload')
      }
    }

    await supabase.from('order_notes').insert({
      order_id: newOrder.id,
      user_id: user?.id,
      message: `Order created via ${isInbound ? 'inbound' : 'outbound'} call`,
      category: 'Order Created',
    })

    return newOrder
  }

  // ─── Send Payment Link Flow ─────────────────────────────
  async function handleSendPaymentLink() {
    setSubmitting(true)
    setGeneratingLink(true)
    try {
      const newOrder = await createOrderInDB()
      if (!newOrder) { setSubmitting(false); setGeneratingLink(false); return }

      const res = await fetch('/api/stripe/payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: newOrder.id,
          amount: grandTotal,
          customer_email: formData.email,
          description: `${selectedFormType?.name} — ${selectedBrand?.name}`,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      await navigator.clipboard.writeText(data.url)
      setCopiedLink(true)
      toast.success('Order created & payment link copied to clipboard!')
      setTimeout(() => router.push(`/admin/orders/${newOrder.id}`), 2000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate payment link'
      toast.error(message)
      setSubmitting(false)
    } finally {
      setGeneratingLink(false)
    }
  }

  // ─── Take Payment Now Flow ──────────────────────────────
  async function handleTakePaymentNow() {
    setSubmitting(true)
    try {
      const newOrder = await createOrderInDB()
      if (!newOrder) { setSubmitting(false); return }
      setCreatedOrderId(newOrder.id)

      const res = await fetch('/api/stripe/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: newOrder.id,
          amount: grandTotal,
          description: `${selectedFormType?.name} — ${selectedBrand?.name}`,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setPaymentClientSecret(data.client_secret)
      setPaymentMode('card')
      setSubmitting(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to initialize payment'
      toast.error(message)
      setSubmitting(false)
    }
  }

  // STEP: LANDING
  if (step === 'landing') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-8 p-10">
        <h2 className="text-2xl font-bold text-ink-gray-9 uppercase tracking-wide">Create Order</h2>
        <div className="flex gap-4 w-full max-w-xl">
          <button
            onClick={() => { setIsInbound(true); }}
            className={cn(
              'flex-1 flex flex-col items-center gap-3 rounded-xl border-2 p-8 text-lg font-semibold transition-all',
              isInbound === true
                ? 'border-success-green bg-surface-green text-success-green shadow-md'
                : 'border-outline-gray-3 hover:border-success-green hover:bg-surface-green/50 text-ink-gray-7'
            )}
          >
            <Phone className="h-8 w-8" />
            This is an inbound call.
          </button>
          <button
            onClick={() => { setIsInbound(false); }}
            className={cn(
              'flex-1 flex flex-col items-center gap-3 rounded-xl border-2 p-8 text-lg font-semibold transition-all',
              isInbound === false
                ? 'border-warning-orange bg-surface-orange text-warning-orange shadow-md'
                : 'border-outline-gray-3 hover:border-warning-orange hover:bg-surface-orange/50 text-ink-gray-7'
            )}
          >
            <PhoneOff className="h-8 w-8" />
            This is not an inbound call.
          </button>
        </div>

        {isInbound !== null && (
          <div className="w-full max-w-xl">
            <label className="form-label text-sm">Select Phone Identifier</label>
            <select
              className="form-input"
              value={selectedBrand?.id ?? ''}
              onChange={e => {
                const b = brands.find(br => br.id === e.target.value)
                setSelectedBrand(b ?? null)
              }}
            >
              <option value="">Select Phone Identifier...</option>
              {brands.map(b => (
                <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
              ))}
            </select>
          </div>
        )}

        {selectedBrand && (
          <button
            onClick={() => setStep('form-type')}
            className="btn-primary px-8 py-2.5 text-base gap-2"
          >
            Continue <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }

  // STEP: FORM TYPE
  if (step === 'form-type') {
    return (
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-ink-gray-9 uppercase tracking-wide mb-2">
            Select Form Type
          </h2>
          <p className="text-sm text-ink-gray-4 mb-6">{selectedBrand?.code} — {selectedBrand?.name}</p>

          <div className="space-y-2">
            {formTypes.map(ft => (
              <div key={ft.code} className="flex items-center justify-between rounded-lg border bg-white p-4 hover:bg-surface-gray-1">
                <div>
                  <div className="font-medium text-ink-gray-9">{ft.name}</div>
                  <div className="text-sm text-ink-gray-4">{formatCurrency(SERVICE_RETAIL_VALS[ft.code] ?? ft.base_price)} + VAT</div>
                </div>
                <button
                  onClick={() => { setSelectedFormType(ft); setStep('wizard') }}
                  className="btn-primary"
                >
                  Create Order
                </button>
              </div>
            ))}
            {formTypes.length === 0 && (
              <p className="text-sm text-ink-gray-4 text-center py-8">No form types found for this brand</p>
            )}
          </div>

          <button onClick={() => setStep('landing')} className="btn-ghost mt-4">← Back</button>
        </div>
      </div>
    )
  }

  // STEP: WIZARD
  if (step === 'wizard') {
    const feeScale = selectedFormType ? getScaleForFormType(selectedFormType.code) : null

    return (
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-ink-gray-9 uppercase tracking-wide">
                Create Order — {selectedFormType?.name}
              </h2>
              <p className="text-sm text-ink-gray-4 mt-0.5">{selectedBrand?.name}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-ink-gray-9">{formatCurrency(grandTotal)}</div>
              <div className="text-xs text-ink-gray-4">Running Total</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs text-ink-gray-4 mb-1.5">
              <span>Step {wizardStep + 1} of 2</span>
              <span>{Math.round(((wizardStep + 1) / 2) * 100)}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${((wizardStep + 1) / 2) * 100}%` }} />
            </div>
          </div>

          {wizardStep === 1 && (
            <div className="space-y-5">
              {/* File Upload Panel */}
              <div className="panel">
                <h3 className="section-heading flex items-center gap-2">
                  <Upload className="h-5 w-5 text-indigo-600" /> Upload Supporting Documents / Files
                </h3>
                <p className="text-xs text-ink-gray-5 mb-4">
                  Upload any supporting documents, IDs, or signed forms required for this order. Files will be uploaded to secure storage upon order creation.
                </p>

                {selectedFile ? (
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                        <Upload className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-ink-gray-9 truncate max-w-[280px]" title={selectedFile.name}>
                          {selectedFile.name}
                        </div>
                        <div className="text-xs text-ink-gray-4">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="p-2 hover:bg-red-50 rounded-lg text-danger-red transition-colors flex-shrink-0"
                      title="Remove file"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-outline-gray-3 hover:border-indigo-500 rounded-xl p-8 cursor-pointer hover:bg-slate-50/50 transition-all text-center">
                    <Upload className="h-8 w-8 text-ink-gray-4 mb-2" />
                    <span className="text-sm font-semibold text-ink-gray-9">Click to select a file</span>
                    <span className="text-xs text-ink-gray-4 mt-0.5">PDF, Images (Max 10MB)</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) setSelectedFile(file)
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          {wizardStep === 0 && (
            <div className="space-y-5">
              {/* Personal Details */}
              <div className="panel">
                <h3 className="section-heading">Personal Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Title</label>
                    <select className="form-input" value={formData.title ?? ''} onChange={e => setField('title', e.target.value)}>
                      <option value="">Select Title</option>
                      {['Mr', 'Mrs', 'Miss', 'Ms', 'Dr', 'Prof'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div />
                  <div>
                    <label className="form-label">First Name *</label>
                    <input className="form-input" value={formData.first_name ?? ''} onChange={e => setField('first_name', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Middle Name <span className="text-ink-gray-4">(If applicable)</span></label>
                    <input className="form-input" value={formData.middle_name ?? ''} onChange={e => setField('middle_name', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className="form-label">Surname *</label>
                    <input className="form-input" value={formData.last_name ?? ''} onChange={e => setField('last_name', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Email Address *</label>
                    <input type="email" className="form-input" value={formData.email ?? ''} onChange={e => setField('email', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Confirm Email Address</label>
                    <input type="email" className="form-input" value={formData.email_confirm ?? ''} onChange={e => setField('email_confirm', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className="form-label">Phone Number *</label>
                    <input type="tel" className="form-input" value={formData.phone ?? ''} onChange={e => setField('phone', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="panel">
                <h3 className="section-heading">Postal / Property Address</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="form-label">Address Line 1</label>
                    <input className="form-input" value={formData.address_line1 ?? ''} onChange={e => setField('address_line1', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className="form-label">Address Line 2</label>
                    <input className="form-input" value={formData.address_line2 ?? ''} onChange={e => setField('address_line2', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">City</label>
                    <input className="form-input" value={formData.city ?? ''} onChange={e => setField('city', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">County</label>
                    <input className="form-input" value={formData.county ?? ''} onChange={e => setField('county', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Postcode</label>
                    <input className="form-input" value={formData.postcode ?? ''} onChange={e => setField('postcode', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Property (if Land Registry form) */}
              {feeScale && (
                <div className="panel">
                  <h3 className="section-heading">Property Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Title Number</label>
                      <input className="form-input" value={formData.title_number ?? ''} onChange={e => setField('title_number', e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">Tenure</label>
                      <select className="form-input" value={formData.tenure ?? ''} onChange={e => setField('tenure', e.target.value)}>
                        <option value="">Select...</option>
                        <option value="Freehold">Freehold</option>
                        <option value="Leasehold">Leasehold</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Tenancy</label>
                      <select className="form-input" value={formData.tenancy_type ?? ''} onChange={e => setField('tenancy_type', e.target.value)}>
                        <option value="">Select...</option>
                        <option value="Sole Owner">Sole Owner</option>
                        <option value="Joint Tenants">Joint Tenants</option>
                        <option value="Tenants in Common">Tenants in Common</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Is the property mortgaged?</label>
                      <div className="flex gap-4 mt-2">
                        {['yes', 'no'].map(v => (
                          <label key={v} className="flex items-center gap-2 cursor-pointer text-sm">
                            <input type="radio" name="mortgaged" value={v}
                              checked={formData.is_mortgaged === v}
                              onChange={e => setField('is_mortgaged', e.target.value)} />
                            {v.charAt(0).toUpperCase() + v.slice(1)}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="form-label">Property Value (£)</label>
                      <input type="number" className="form-input" value={propertyValue}
                        onChange={e => setPropertyValue(e.target.value)} placeholder="0.00" />
                    </div>
                    <div>
                      <label className="form-label">Land Registry Fee (Auto calculated)</label>
                      <div className="form-input bg-surface-gray-1 text-ink-gray-5 cursor-not-allowed">
                        {hmlrFee > 0 ? formatCurrency(hmlrFee) : '—'}
                      </div>
                      <p className="text-xs text-ink-gray-4 mt-1">
                        Fee is automatically calculated based on property value (Scale {feeScale})
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Nav */}
          <div className="flex justify-between mt-6">
            <button onClick={() => wizardStep > 0 ? setWizardStep(s => s - 1) : setStep('form-type')}
              className="btn-outline">← Previous</button>
            <button onClick={() => {
              if (wizardStep < 1) setWizardStep(s => s + 1)
              else setStep('upsells')
            }} className="btn-primary">Next →</button>
          </div>
        </div>
      </div>
    )
  }

  // STEP: UPSELLS
  if (step === 'upsells') {
    return (
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-start justify-between mb-6">
            <h2 className="text-xl font-bold text-ink-gray-9 uppercase tracking-wide">Finalise Your Order</h2>
            <div className="text-right">
              <div className="text-2xl font-bold text-ink-gray-9">{formatCurrency(grandTotal)}</div>
            </div>
          </div>

          <div className="panel space-y-4">
            <UpsellOption
              label="Faster documents"
              subLabel="Yes (12 working hrs) / No (standard 24 hrs)"
              price={UPSELL_PRICES.faster_docs}
              checked={upsells.faster_docs}
              onChange={v => setUpsells(p => ({ ...p, faster_docs: v }))}
            />
            <UpsellOption
              label="Printed copy of deeds posted"
              subLabel="Yes (PDF + printed) / No (PDF only)"
              price={UPSELL_PRICES.printed_copy}
              checked={upsells.printed_copy}
              onChange={v => setUpsells(p => ({ ...p, printed_copy: v }))}
            />
            <UpsellOption
              label="SMS application status updates"
              subLabel="Yes / No (email only)"
              price={UPSELL_PRICES.sms_updates}
              checked={upsells.sms_updates}
              onChange={v => setUpsells(p => ({ ...p, sms_updates: v }))}
            />
          </div>

          <div className="flex justify-between mt-6">
            <button onClick={() => setStep('wizard')} className="btn-outline">← Previous</button>
            <button 
              onClick={() => {
                const defaultItems = [
                  { id: 'base-doc-fee', item_type: selectedFormType?.name ?? 'Document Fee', amount: basePrice },
                  ...(hmlrFee > 0 ? [{ id: 'hmlr-fee', item_type: 'HMLR Fee', amount: hmlrFee }] : []),
                  ...(upsells.faster_docs ? [{ id: 'faster-docs', item_type: 'Fast Track Fee', amount: UPSELL_PRICES.faster_docs }] : []),
                  ...(upsells.printed_copy ? [{ id: 'printed-copy', item_type: 'Printed Copy Fee', amount: UPSELL_PRICES.printed_copy }] : []),
                  ...(upsells.sms_updates ? [{ id: 'sms-updates', item_type: 'SMS Updates Fee', amount: UPSELL_PRICES.sms_updates }] : []),
                ]
                setOrderItems(defaultItems)
                setStep('review')
              }} 
              className="btn-primary"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // STEP: REVIEW & PAYMENT
  if (step === 'review') {
    const tc = selectedFormType?.tc_template
      ?.replace('{{brand}}', selectedBrand?.name ?? '')
      ?.replace('{{form_type}}', selectedFormType?.name ?? '')
      ?.replace('{{total}}', formatCurrency(grandTotal))
      ?? `We are processing ${selectedFormType?.name} for you today with ${selectedBrand?.name}. Total cost: ${formatCurrency(grandTotal)}.`

    return (
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="flex items-start justify-between">
            <h2 className="text-xl font-bold text-ink-gray-9 uppercase tracking-wide">Review & Payment</h2>
          </div>

          {/* Contact summary */}
          <div className="panel">
            <div className="section-heading">Contact Details</div>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ['Name', `${formData.title ?? ''} ${formData.first_name ?? ''} ${formData.last_name ?? ''}`.trim()],
                  ['Email', formData.email],
                  ['Phone', formData.phone],
                  ['Address', [formData.address_line1, formData.address_line2, formData.city, formData.county, formData.postcode].filter(Boolean).join(', ')],
                ].map(([label, value]) => value ? (
                  <tr key={label} className="border-t border-outline-gray-2">
                    <td className="py-2 pr-4 font-medium text-ink-gray-5 w-28">{label}</td>
                    <td className="py-2 text-ink-gray-9">{value}</td>
                  </tr>
                ) : null)}
              </tbody>
            </table>
          </div>

          {/* Price breakdown */}
          <div className="panel">
            <div className="flex items-center justify-between mb-3">
              <div className="section-heading">Line Items</div>
              <button 
                onClick={() => {
                  const defaultType = ITEM_TYPES[0]
                  const defaultAmount = DEFAULT_PRICES[defaultType] ?? 0
                  setOrderItems(prev => [...prev, { id: crypto.randomUUID(), item_type: defaultType, amount: defaultAmount }])
                }} 
                className="text-xs font-bold bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors"
              >
                + Add Item
              </button>
            </div>
            
            <div className="space-y-3">
              {orderItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <select 
                    className="form-input flex-1 text-sm text-slate-800 py-1.5" 
                    value={item.item_type} 
                    onChange={e => {
                      const typeStr = e.target.value
                      const defaultAmount = DEFAULT_PRICES[typeStr] ?? 0
                      setOrderItems(prev => prev.map(it => it.id === item.id ? { ...it, item_type: typeStr, amount: defaultAmount } : it))
                    }}
                  >
                    {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  
                  <div className="relative w-32">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-gray-4 text-sm">£</span>
                    <input
                      type="number" 
                      step="0.01" 
                      className="form-input pl-7 w-full text-sm text-slate-800 py-1.5"
                      value={item.amount}
                      onChange={e => {
                        setOrderItems(prev => prev.map(it => it.id === item.id ? { ...it, amount: Number(e.target.value) } : it))
                      }}
                    />
                  </div>
                  
                  <button 
                    onClick={() => {
                      setOrderItems(prev => prev.filter(it => it.id !== item.id))
                    }} 
                    className="text-danger-red hover:text-red-700 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              
              {orderItems.length === 0 && (
                <p className="text-sm text-ink-gray-4 text-center py-4">No line items. Click "Add Item" to add one.</p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-outline-gray-3 pt-3">
              <span className="font-bold text-ink-gray-9">Total Fee</span>
              <span className="text-xl font-bold text-ink-gray-9">{formatCurrency(grandTotal)} <span className="text-xs font-normal text-ink-gray-4">Including VAT</span></span>
            </div>
          </div>

          {/* Uploaded Documents */}
          <div className="panel">
            <div className="section-heading">Supporting Documents</div>
            {selectedFile ? (
              <div className="flex items-center justify-between text-sm py-2">
                <span className="text-ink-gray-5">Selected File</span>
                <span className="font-medium text-ink-gray-9 truncate max-w-[300px]" title={selectedFile.name}>
                  {selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            ) : (
              <p className="text-sm text-ink-gray-4 py-2">No documents selected for upload. You can go back to Step 2 to upload if needed.</p>
            )}
          </div>

          {/* T&Cs */}
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800">
            <div className="font-semibold mb-2">Terms & Conditions</div>
            <p className="leading-relaxed">{tc}</p>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="tc" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="h-4 w-4 rounded" />
            <label htmlFor="tc" className="text-sm text-ink-gray-7 cursor-pointer">
              I accept the terms & conditions
            </label>
          </div>

          {/* Payment Options */}
          {paymentMode === 'card' && paymentClientSecret && createdOrderId ? (
            <div className="panel">
              <div className="section-heading flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Secure Card Payment
              </div>
              <div className="mt-3 mb-3 rounded-lg bg-surface-blue border border-accent-blue/20 px-4 py-3 text-sm text-ink-blue">
                <strong>Secure Payment</strong> — Card data is handled by Stripe and never touches our servers.
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
                <CreateOrderPaymentForm
                  orderId={createdOrderId}
                  amount={grandTotal}
                  onSuccess={() => {
                    toast.success('Payment processed successfully!')
                    router.push(`/admin/orders/${createdOrderId}`)
                  }}
                  onCancel={() => {
                    setPaymentMode(null)
                    setPaymentClientSecret(null)
                    toast.info('Order created but payment skipped. You can take payment from the order page.')
                    router.push(`/admin/orders/${createdOrderId}`)
                  }}
                />
              </Elements>
            </div>
          ) : (
            <>
              <div className="panel">
                <div className="section-heading">Payment Method</div>
                <p className="text-sm text-ink-gray-5 mb-4">Choose how to collect payment for this order.</p>
                <div className="space-y-3">
                  <button
                    onClick={handleSendPaymentLink}
                    disabled={submitting || !termsAccepted}
                    className="w-full flex items-center gap-4 rounded-xl border-2 border-outline-gray-3 hover:border-accent-blue hover:bg-surface-blue/30 p-5 text-left transition-all group"
                  >
                    <div className="h-12 w-12 rounded-lg bg-surface-blue flex items-center justify-center flex-shrink-0">
                      {generatingLink ? <Loader2 className="h-6 w-6 text-accent-blue animate-spin" /> :
                       copiedLink ? <Check className="h-6 w-6 text-success-green" /> :
                       <Link2 className="h-6 w-6 text-accent-blue" />}
                    </div>
                    <div>
                      <div className="font-semibold text-ink-gray-9 group-hover:text-accent-blue">
                        {copiedLink ? 'Link Copied!' : 'Send Payment Link'}
                      </div>
                      <div className="text-xs text-ink-gray-4 mt-0.5">Create order & generate a Stripe payment link to send to the customer</div>
                    </div>
                  </button>

                  <button
                    onClick={handleTakePaymentNow}
                    disabled={submitting || !termsAccepted}
                    className="w-full flex items-center gap-4 rounded-xl border-2 border-outline-gray-3 hover:border-success-green hover:bg-surface-green/30 p-5 text-left transition-all group"
                  >
                    <div className="h-12 w-12 rounded-lg bg-surface-green flex items-center justify-center flex-shrink-0">
                      {submitting && !generatingLink ? <Loader2 className="h-6 w-6 text-success-green animate-spin" /> :
                       <CreditCard className="h-6 w-6 text-success-green" />}
                    </div>
                    <div>
                      <div className="font-semibold text-ink-gray-9 group-hover:text-success-green">Take Payment Now</div>
                      <div className="text-xs text-ink-gray-4 mt-0.5">Create order & enter card details securely via Stripe Elements</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex justify-between">
                <button onClick={() => setStep('upsells')} className="btn-outline">← Previous</button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return null
}

// ─── Stripe Elements Payment Form for Create Order ──────
function CreateOrderPaymentForm({ orderId, amount, onSuccess, onCancel }: {
  orderId: string; amount: number; onSuccess: () => void; onCancel: () => void
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
      confirmParams: { return_url: window.location.href },
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
        body: JSON.stringify({ payment_intent_id: paymentIntent.id, order_id: orderId }),
      })
      if (res.ok) {
        onSuccess()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to record payment')
      }
    }
    setProcessing(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-3">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="btn-outline" disabled={processing}>Skip Payment</button>
        <button type="submit" disabled={!stripe || processing} className="btn-success gap-2">
          {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {processing ? 'Processing...' : `Pay ${formatCurrency(amount)}`}
        </button>
      </div>
    </form>
  )
}

function UpsellOption({ label, subLabel, price, checked, onChange }: {
  label: string; subLabel: string; price: number; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between border-b border-outline-gray-2 pb-4 last:border-0 last:pb-0">
      <div>
        <div className="text-sm font-medium text-ink-gray-9">{label}</div>
        <div className="text-xs text-ink-gray-4 mt-0.5">{subLabel}</div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-ink-gray-5">
          {checked ? `+${formatCurrency(price)}` : 'Included'}
        </span>
        <button
          onClick={() => onChange(!checked)}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium border transition-colors',
            checked
              ? 'bg-navy text-white border-navy'
              : 'bg-white text-ink-gray-7 border-outline-gray-3 hover:border-navy hover:text-navy'
          )}
        >
          {checked ? 'Yes' : 'No'}
        </button>
      </div>
    </div>
  )
}
