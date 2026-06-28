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
          { code: 'PROPERTY_OWNERSHIP', name: 'Property Ownership' },
          { code: 'TITLE_PLAN', name: 'Title Plan' },
          { code: 'TITLE_REGISTER', name: 'Title Register' },
          { code: 'MAP_SEARCH', name: 'Map Search' },
          { code: 'DEED_SEARCH', name: 'Deed Search', isStatic: true, fallbackCode: 'MAP_SEARCH' },
          { code: 'APPLICATION_ENQUIRY', name: 'Application Enquiry', isStatic: true, fallbackCode: 'TITLE_REGISTER' },
          { code: 'PROPERTY_ALERT', name: 'Property Alert', isStatic: true, fallbackCode: 'PROPERTY_OWNERSHIP' },
          { code: 'APPLICATION_PACK', name: 'Application Pack', isStatic: true, fallbackCode: 'PROPERTY_OWNERSHIP' },
          { code: 'DIY_FORMS', name: 'DIY Forms', isStatic: true, fallbackCode: 'TITLE_REGISTER' },
          { code: 'CONVEYANCING_PACK', name: 'Conveyancing Pack', isStatic: true, fallbackCode: 'PROPERTY_OWNERSHIP' },
          { code: 'CONVEYANCING_PACK_ONLINE', name: 'Conveyancing Pack Online', isStatic: true, fallbackCode: 'PROPERTY_OWNERSHIP' },
          { code: 'AP1', name: 'AP1 Name Change' },
          { code: 'DJP', name: 'DJP Death of Joint Proprietor' },
          { code: 'TR1', name: 'TR1 Add/Remove Proprietor' },
          { code: 'COG1', name: 'COG1 Changing Registered Owners Address' },
          { code: 'SEV', name: 'SEV Joint Tenants to Tenants in Common' },
          { code: 'RX3', name: 'RX3 Remove Restriction' },
          { code: 'FR1', name: 'FR1 First Registration' },
          { code: 'TP1', name: 'TP1 Transfer of Part' },
          { code: 'ADV1', name: 'ADV1 Adverse Possession' },
          { code: 'AS1', name: 'AS1 Assent of Whole' },
          { code: 'DJP_FULL', name: 'DJP Death of Joint Proprietor (full Service)', isStatic: true, fallbackCode: 'DJP' },
          { code: 'TR1_FULL', name: 'TR1 Add/Remove Proprietor (Full Service)', isStatic: true, fallbackCode: 'TR1' }
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
  const addonTotal = (formData.addon_title_plan === 'yes' ? 36.00 : 0)
    + (formData.addon_title_register === 'yes' ? 36.00 : 0)
    + (formData.addon_flood_risk === 'yes' ? 25.00 : 0)
  const staticGrandTotal = basePrice + upsellTotal + hmlrFee + addonTotal
  const grandTotal = orderItems.length > 0 
    ? orderItems.reduce((sum, item) => sum + Number(item.amount), 0)
    : staticGrandTotal

  function setField(key: string, value: string) {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  async function createOrderInDB() {
    const { data: { user } } = await supabase.auth.getUser()

    let finalTenure = formData.tenure || ''
    if (selectedFormType?.code === 'DEED_SEARCH') {
      const parts: string[] = []
      if (formData.tenure) parts.push(formData.tenure)
      if (formData.preferred_deed) parts.push(`Preferred Deed: ${formData.preferred_deed}`)
      if (formData.deed_search_reason) parts.push(`Reason: ${formData.deed_search_reason}`)
      finalTenure = parts.join(' | ')
    }

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
      tenure: finalTenure,
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
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-start pt-32 gap-10 p-10 bg-[#f8f9fa]">
        <h2 className="text-[28px] font-bold text-[#0B1B3A] tracking-tight">CREATE ORDER</h2>
        <div className="flex gap-6 w-full max-w-2xl">
          <button
            onClick={() => { setIsInbound(true); }}
            className={cn(
              'flex-1 flex flex-col items-center gap-4 rounded-2xl border-2 p-10 text-[18px] font-bold transition-all duration-200',
              isInbound === true
                ? 'border-[#0B1B3A] bg-[#0B1B3A] text-white shadow-xl scale-[1.03]'
                : 'border-slate-200 bg-white hover:border-[#0B1B3A] hover:bg-slate-50 text-slate-600 hover:text-[#0B1B3A]'
            )}
          >
            <Phone className={cn("h-10 w-10", isInbound === true ? "text-white" : "text-slate-400")} />
            This is an inbound call.
          </button>
          <button
            onClick={() => { setIsInbound(false); }}
            className={cn(
              'flex-1 flex flex-col items-center gap-4 rounded-2xl border-2 p-10 text-[18px] font-bold transition-all duration-200',
              isInbound === false
                ? 'border-[#f97316] bg-[#f97316] text-white shadow-xl scale-[1.03]'
                : 'border-slate-200 bg-white hover:border-[#f97316] hover:bg-orange-50 text-slate-600 hover:text-[#f97316]'
            )}
          >
            <PhoneOff className={cn("h-10 w-10", isInbound === false ? "text-white" : "text-slate-400")} />
            This is not an inbound call.
          </button>
        </div>

        <div className={cn(
          "w-full max-w-2xl transition-all duration-500 ease-in-out",
          isInbound !== null ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}>
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-6">
            <div>
              <label className="block text-[15px] font-semibold text-slate-800 mb-3">Select Phone Identifier</label>
              <select
                className="w-full h-12 px-4 border border-slate-300 rounded-lg focus:border-[#0B1B3A] focus:ring-1 focus:ring-[#0B1B3A] focus:outline-none text-[15px] text-slate-700 bg-white shadow-sm transition-shadow"
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
            {selectedBrand && (
              <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                {formTypes.map((ft, idx) => (
                  <div key={ft.code} className={cn(
                    "flex items-center justify-between p-4",
                    idx % 2 === 0 ? "bg-[#f8f9fa]" : "bg-white"
                  )}>
                    <div className="font-medium text-[#2c3e50] text-[15px]">{ft.name}</div>
                    <button
                      onClick={() => { setSelectedFormType(ft); setStep('wizard') }}
                      className="bg-[#0B1B3A] hover:bg-[#132c57] text-white text-[14px] font-medium px-6 py-2 rounded transition-colors"
                    >
                      Create Order
                    </button>
                  </div>
                ))}
                {formTypes.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-6 bg-white">No services found for this brand.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // STEP: WIZARD
  if (step === 'wizard') {
    const feeScale = selectedFormType ? getScaleForFormType(selectedFormType.code) : null

    return (
      <div className="flex-1 overflow-y-auto p-8 bg-[#f8f9fa]">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Top Bar */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
            <h2 className="text-xl font-bold text-[#0B1B3A]">Step {wizardStep + 1} of 3</h2>
            <div className="text-right">
              <div className="text-2xl font-bold text-[#0B1B3A]">{formatCurrency(grandTotal)}</div>
              <div className="text-xs text-slate-500 font-medium">Running Total</div>
            </div>
          </div>
          
          <div className="progress-bar bg-slate-200 h-2 rounded-full overflow-hidden mb-8 border border-slate-200 shadow-inner">
            <div className="bg-[#0B1B3A] h-full transition-all duration-300" style={{ width: `${((wizardStep + 1) / 3) * 100}%` }} />
          </div>

          {wizardStep === 0 && (
            <>
              {/* Number of Properties */}
              <div className="panel p-6 bg-white border border-slate-200 rounded-md shadow-sm mb-6">
                <h3 className="text-[20px] font-medium text-[#0B1B3A] mb-5">How many properties would you like to search?</h3>
                <label className="form-label text-[#2c3e50] font-semibold mb-2 block text-[13px]">Number of Properties</label>
                <select className="form-input w-full max-w-xs h-11 border-slate-300 rounded text-sm bg-white focus:ring-1 focus:ring-[#0B1B3A] focus:border-[#0B1B3A]">
                  {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              {/* Property 1 */}
              <div className="panel p-6 bg-white border border-slate-200 rounded-md shadow-sm mb-6">
                <h3 className="text-[20px] font-medium text-[#0B1B3A] mb-5">Property 1</h3>
                
                {(['PROPERTY_OWNERSHIP', 'TITLE_REGISTER', 'TITLE_PLAN', 'DEED_SEARCH', 'MAP_SEARCH', 'PROPERTY_ALERT', 'DJP'].includes(selectedFormType?.code ?? '')) && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-[#0B1B3A] text-sm mb-3">Required Documents</h4>
                    {/* Primary service — always included */}
                    <label className="flex items-start gap-2 mb-3 cursor-pointer">
                      <input type="radio" checked className="mt-1 border-slate-300" readOnly />
                      <div>
                        <span className="text-[#2c3e50] text-[15px] font-medium">{selectedFormType!.name} ({formatCurrency(selectedFormType!.base_price)}+vat)</span>
                        <div className="text-[13px] text-slate-500 mt-0.5">
                          {selectedFormType?.code === 'TITLE_REGISTER' && 'Official copy confirming registered ownership.'}
                          {selectedFormType?.code === 'TITLE_PLAN' && 'Scale boundary map outlining property.'}
                          {selectedFormType?.code === 'PROPERTY_OWNERSHIP' && 'Title Register & Title Plan bundle.'}
                          {selectedFormType?.code === 'DEED_SEARCH' && 'Historical transfers (TR1 forms) and leasehold deeds.'}
                          {selectedFormType?.code === 'MAP_SEARCH' && 'GIS coordinate-based boundary mapping search.'}
                          {selectedFormType?.code === 'PROPERTY_ALERT' && 'Real-time fraud alert monitoring and email status updates.'}
                          {selectedFormType?.code === 'DJP' && 'Remove a deceased owner\'s name and update registered title.'}
                        </div>
                      </div>
                    </label>
                    {/* Optional add-on: Include Title Plan (for services that don't already include it) */}
                    {(['TITLE_REGISTER', 'DEED_SEARCH', 'MAP_SEARCH', 'PROPERTY_ALERT', 'DJP'].includes(selectedFormType?.code ?? '')) && (
                      <label className="flex items-start gap-2 cursor-pointer mb-2">
                        <input type="checkbox" className="mt-1 border-slate-300 rounded-sm text-[#0B1B3A] focus:ring-[#0B1B3A]" onChange={(e) => setField('addon_title_plan', e.target.checked ? 'yes' : '')} />
                        <div>
                          <span className="text-[#2c3e50] text-[15px] font-medium">Include Title Plan (£36.00+vat)</span>
                          <div className="text-[13px] text-slate-500 mt-0.5">Scale boundary map outlining property.</div>
                        </div>
                      </label>
                    )}
                    {/* Optional add-on: Include Title Register (for Title Plan service) */}
                    {selectedFormType?.code === 'TITLE_PLAN' && (
                      <label className="flex items-start gap-2 cursor-pointer mb-2">
                        <input type="checkbox" className="mt-1 border-slate-300 rounded-sm text-[#0B1B3A] focus:ring-[#0B1B3A]" onChange={(e) => setField('addon_title_register', e.target.checked ? 'yes' : '')} />
                        <div>
                          <span className="text-[#2c3e50] text-[15px] font-medium">Include Title Register (£36.00+vat)</span>
                          <div className="text-[13px] text-slate-500 mt-0.5">Official copy confirming registered ownership.</div>
                        </div>
                      </label>
                    )}
                    {/* Optional add-on: Flood Risk */}
                    <label className="flex items-start gap-2 cursor-pointer mb-2">
                      <input type="checkbox" className="mt-1 border-slate-300 rounded-sm text-[#0B1B3A] focus:ring-[#0B1B3A]" onChange={(e) => setUpsells(u => ({...u, flood_risk: e.target.checked}))} />
                      <div>
                        <span className="text-[#2c3e50] text-[15px] font-medium">Include Flood Risk (£25.00+vat)</span>
                        <div className="text-[13px] text-slate-500 mt-0.5">Environmental risk assessment report.</div>
                      </div>
                    </label>
                    <p className="text-[12px] text-slate-400 mt-2">Documents are subject to availability.</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">Country</label>
                    <select className="form-input w-full h-11 border-slate-300 rounded text-sm bg-white focus:ring-[#0B1B3A]" value={formData.country ?? ''} onChange={e => setField('country', e.target.value)}>
                      <option value="">Select Country</option>
                      <option value="England">England</option>
                      <option value="Wales">Wales</option>
                      <option value="Scotland">Scotland</option>
                      <option value="Northern Ireland">Northern Ireland</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">Title Number (If known)</label>
                    <input className="form-input w-full h-11 border-slate-300 rounded text-sm focus:ring-[#0B1B3A]" value={formData.title_number ?? ''} onChange={e => setField('title_number', e.target.value)} />
                  </div>

                  {/* Property Alert info note */}
                  {selectedFormType?.code === 'PROPERTY_ALERT' && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-800">
                      <strong>Fraud Monitoring Setup</strong>
                      <p className="mt-1 text-[13px]">Monitor property deeds for unsanctioned filings or transfers. Provide the title number(s) if known, or enter the address so we can locate the titles for you.</p>
                    </div>
                  )}

                  <div>
                    <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">Tenure</label>
                    <select className="form-input w-full h-11 border-slate-300 rounded text-sm bg-white focus:ring-[#0B1B3A]" value={formData.tenure ?? ''} onChange={e => setField('tenure', e.target.value)}>
                      <option value="">Select Tenure</option>
                      <option value="Freehold">Freehold (Absolute Ownership)</option>
                      <option value="Leasehold">Leasehold (Lease Agreement)</option>
                      <option value="Unsure">Unsure / Retrieve Any Available</option>
                    </select>
                  </div>

                  {/* Deed Search: What information are you looking for? */}
                  {selectedFormType?.code === 'DEED_SEARCH' && (
                    <div>
                      <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">What information are you looking for?</label>
                      <select className="form-input w-full h-11 border-slate-300 rounded text-sm bg-white focus:ring-[#0B1B3A]" value={formData.deed_search_reason ?? ''} onChange={e => setField('deed_search_reason', e.target.value)}>
                        <option value="">Select Reason</option>
                        <option value="Ownership history">Ownership history</option>
                        <option value="Boundary information">Boundary information</option>
                        <option value="Transfer of ownership details">Transfer of ownership details</option>
                        <option value="Property description">Property description</option>
                        <option value="Charges on the property">Charges on the property</option>
                        <option value="Confirmation mortgage has been paid off">Confirmation mortgage has been paid off</option>
                        <option value="Check if my property is registered">Check if my property is registered</option>
                        <option value="Dispute with council over road or land">Dispute with council over road or land</option>
                        <option value="Tenancy/lease agreement">Tenancy/lease agreement</option>
                        <option value="Restrictions on property">Restrictions on property</option>
                        <option value="Proof of ownership">Proof of ownership</option>
                        <option value="Purchase price history">Purchase price history</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  )}

                  {/* Deed Search: Preferred Deed */}
                  {selectedFormType?.code === 'DEED_SEARCH' && (
                    <div>
                      <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">Preferred Deed</label>
                      <select className="form-input w-full h-11 border-slate-300 rounded text-sm bg-white focus:ring-[#0B1B3A]" value={formData.preferred_deed ?? ''} onChange={e => setField('preferred_deed', e.target.value)}>
                        <option value="">Select Preference</option>
                        <option value="The Most Relevant Filed Deed">The Most Relevant Filed Deed</option>
                        <option value="Conveyancing Deeds">Conveyancing Deeds</option>
                        <option value="Transfer Deeds">Transfer Deeds</option>
                        <option value="Charge Deeds">Charge Deeds</option>
                        <option value="Lease Deeds">Lease Deeds</option>
                      </select>
                    </div>
                  )}



                  <div>
                    <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">Enter Property Postcode</label>
                    <div className="flex">
                      <input className="form-input rounded-r-none flex-1 h-11 border-slate-300 text-sm focus:ring-[#0B1B3A]" value={formData.lookup_postcode ?? ''} onChange={e => setField('lookup_postcode', e.target.value)} />
                      <button type="button" className="bg-[#0B1B3A] hover:bg-[#132c57] transition-colors text-white px-6 font-semibold rounded-r text-sm">Lookup</button>
                    </div>
                  </div>
                  
                  {/* Map Search info note */}
                  {selectedFormType?.code === 'MAP_SEARCH' && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm text-blue-800">
                      <strong>Map / Land Search</strong>
                      <p className="mt-1 text-[13px]">For map/land searches without a standard postal address, please provide as much location detail as possible — nearest road, landmarks, coordinates, or a written description of the parcel.</p>
                    </div>
                  )}

                  <div className="bg-[#e0f2f1] text-[#00695c] p-4 rounded text-sm border border-[#b2dfdb]">
                    You can search for <strong>any property</strong> - you do not need to own the property.
                  </div>

                  <div>
                    <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">Property Address Line 1</label>
                    <input className="form-input w-full h-11 border-slate-300 rounded text-sm focus:ring-[#0B1B3A]" value={formData.address_line1 ?? ''} onChange={e => setField('address_line1', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">Property Address Line 2</label>
                    <input className="form-input w-full h-11 border-slate-300 rounded text-sm focus:ring-[#0B1B3A]" value={formData.address_line2 ?? ''} onChange={e => setField('address_line2', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">Property City</label>
                    <input className="form-input w-full h-11 border-slate-300 rounded text-sm focus:ring-[#0B1B3A]" value={formData.city ?? ''} onChange={e => setField('city', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">Property County</label>
                    <input className="form-input w-full h-11 border-slate-300 rounded text-sm focus:ring-[#0B1B3A]" value={formData.county ?? ''} onChange={e => setField('county', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">Property Postcode</label>
                    <input className="form-input w-full h-11 border-slate-300 rounded text-sm focus:ring-[#0B1B3A]" value={formData.postcode ?? ''} onChange={e => setField('postcode', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Personal Details */}
              <div className="panel p-6 bg-white border border-slate-200 rounded-md shadow-sm mb-6">
                <h3 className="text-[20px] font-medium text-[#0B1B3A] mb-5">Personal Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">Title</label>
                    <select className="form-input w-full h-11 border-slate-300 rounded text-sm bg-white focus:ring-[#0B1B3A]" value={formData.title ?? ''} onChange={e => setField('title', e.target.value)}>
                      <option value="">Select Title</option>
                      {['Mr', 'Mrs', 'Miss', 'Ms', 'Dr', 'Prof'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">First name</label>
                    <input className="form-input w-full h-11 border-slate-300 rounded text-sm focus:ring-[#0B1B3A]" value={formData.first_name ?? ''} onChange={e => setField('first_name', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 flex justify-between">
                      <span>Middle name</span>
                      <span className="text-slate-400 font-normal">If applicable</span>
                    </label>
                    <input className="form-input w-full h-11 border-slate-300 rounded text-sm focus:ring-[#0B1B3A]" value={formData.middle_name ?? ''} onChange={e => setField('middle_name', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">Surname</label>
                    <input className="form-input w-full h-11 border-slate-300 rounded text-sm focus:ring-[#0B1B3A]" value={formData.last_name ?? ''} onChange={e => setField('last_name', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">Your Email Address</label>
                    <input type="email" className="form-input w-full h-11 border-slate-300 rounded text-sm focus:ring-[#0B1B3A]" value={formData.email ?? ''} onChange={e => setField('email', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">Confirm Email Address:</label>
                    <input type="email" className="form-input w-full h-11 border-slate-300 rounded text-sm focus:ring-[#0B1B3A]" value={formData.email_confirm ?? ''} onChange={e => setField('email_confirm', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">Mobile Phone Number</label>
                    <input type="tel" className="form-input w-full h-11 border-slate-300 rounded text-sm focus:ring-[#0B1B3A]" value={formData.phone ?? ''} onChange={e => setField('phone', e.target.value)} />
                  </div>
                </div>
              </div>

              {feeScale && (
                <div className="panel p-6 bg-white border border-slate-200 rounded-md shadow-sm mb-6">
                  <h3 className="text-[20px] font-medium text-[#0B1B3A] mb-5">HMLR Additional Details</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">Tenancy Type</label>
                      <select className="form-input w-full h-11 border-slate-300 rounded text-sm focus:ring-[#0B1B3A]" value={formData.tenancy_type ?? ''} onChange={e => setField('tenancy_type', e.target.value)}>
                        <option value="">Select...</option>
                        <option value="Sole Owner">Sole Owner</option>
                        <option value="Joint Tenants">Joint Tenants</option>
                        <option value="Tenants in Common">Tenants in Common</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-2 block">Is the property mortgaged?</label>
                      <div className="flex gap-4">
                        {['yes', 'no'].map(v => (
                          <label key={v} className="flex items-center gap-2 cursor-pointer text-sm">
                            <input type="radio" name="mortgaged" value={v}
                              checked={formData.is_mortgaged === v}
                              className="text-[#0B1B3A] focus:ring-[#0B1B3A]"
                              onChange={e => setField('is_mortgaged', e.target.value)} />
                            {v.charAt(0).toUpperCase() + v.slice(1)}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">Property Value (£)</label>
                      <input type="number" className="form-input w-full h-11 border-slate-300 rounded text-sm focus:ring-[#0B1B3A]" value={propertyValue}
                        onChange={e => setPropertyValue(e.target.value)} placeholder="0.00" />
                    </div>
                    <div>
                      <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">Land Registry Fee (Auto calculated)</label>
                      <div className="form-input w-full h-11 border-slate-300 rounded text-sm bg-slate-50 flex items-center text-slate-500 cursor-not-allowed">
                        {hmlrFee > 0 ? formatCurrency(hmlrFee) : '—'}
                      </div>
                      <p className="text-[12px] text-slate-400 mt-1">
                        Fee is automatically calculated based on property value (Scale {feeScale})
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {wizardStep === 1 && (
            <>
            <div className="panel p-6 bg-white border border-slate-200 rounded-md shadow-sm mb-6">
              <h3 className="text-[20px] font-medium text-[#0B1B3A] mb-5">Finalise Your Order</h3>
              <div className="space-y-6">
                <div>
                  <label className="font-semibold text-[#0B1B3A] block mb-2">Would you like your documents quicker?</label>
                  <label className="flex items-center justify-between p-3 border border-slate-200 rounded hover:bg-slate-50 cursor-pointer mb-2">
                    <div className="flex items-center gap-2">
                      <input type="radio" name="faster_docs" checked={upsells.faster_docs === true} onChange={() => setUpsells(u => ({...u, faster_docs: true}))} className="text-[#0B1B3A] focus:ring-[#0B1B3A]" />
                      <span className="text-[14px] font-medium">Yes, I would like to receive the documents faster</span>
                    </div>
                    <span className="font-semibold text-[14px]">{formatCurrency(UPSELL_PRICES.faster_docs)}+vat</span>
                  </label>
                  <p className="text-[13px] text-slate-400 italic px-1 mb-1">Processed within 12 working hours</p>
                  <label className="flex items-center justify-between p-3 border border-slate-200 rounded hover:bg-slate-50 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <input type="radio" name="faster_docs" checked={upsells.faster_docs === false} onChange={() => setUpsells(u => ({...u, faster_docs: false}))} className="text-[#0B1B3A] focus:ring-[#0B1B3A]" />
                      <span className="text-[14px] font-medium">No, I'm happy with the standard service</span>
                    </div>
                    <span className="font-semibold text-[14px]">Included</span>
                  </label>
                  <p className="text-[13px] text-slate-400 italic px-1">Processed within 24 working hours</p>
                </div>
                
                <div>
                  <label className="font-semibold text-[#0B1B3A] block mb-2">Would you also like a printed copy of the deeds posting to you?</label>
                  <label className="flex items-center justify-between p-3 border border-slate-200 rounded hover:bg-slate-50 cursor-pointer mb-2">
                    <div className="flex items-center gap-2">
                      <input type="radio" name="printed_copy" checked={upsells.printed_copy === true} onChange={() => setUpsells(u => ({...u, printed_copy: true}))} className="text-[#0B1B3A] focus:ring-[#0B1B3A]" />
                      <span className="text-[14px] font-medium">Yes, I would like a PDF and printed copy</span>
                    </div>
                    <span className="font-semibold text-[14px]">{formatCurrency(UPSELL_PRICES.printed_copy)}+vat</span>
                  </label>
                  <label className="flex items-center justify-between p-3 border border-slate-200 rounded hover:bg-slate-50 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <input type="radio" name="printed_copy" checked={upsells.printed_copy === false} onChange={() => setUpsells(u => ({...u, printed_copy: false}))} className="text-[#0B1B3A] focus:ring-[#0B1B3A]" />
                      <span className="text-[14px] font-medium">No, I'm happy with just a PDF copy</span>
                    </div>
                    <span className="font-semibold text-[14px]">Included</span>
                  </label>
                </div>

                <div>
                  <label className="font-semibold text-[#0B1B3A] block mb-2">Would you like SMS application status updates?</label>
                  <label className="flex items-center justify-between p-3 border border-slate-200 rounded hover:bg-slate-50 cursor-pointer mb-2">
                    <div className="flex items-center gap-2">
                      <input type="radio" name="sms_updates" checked={upsells.sms_updates === true} onChange={() => setUpsells(u => ({...u, sms_updates: true}))} className="text-[#0B1B3A] focus:ring-[#0B1B3A]" />
                      <span className="text-[14px] font-medium">Yes, I would like text updates</span>
                    </div>
                    <span className="font-semibold text-[14px]">{formatCurrency(UPSELL_PRICES.sms_updates)}+vat</span>
                  </label>
                  <p className="text-[13px] text-slate-400 italic mb-2 px-1">
                    By selecting this option we will send you SMS updates at each stage of the application process. We will also contact you via SMS if we require any further information to process your application.
                  </p>
                  <label className="flex items-center justify-between p-3 border border-slate-200 rounded hover:bg-slate-50 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <input type="radio" name="sms_updates" checked={upsells.sms_updates === false} onChange={() => setUpsells(u => ({...u, sms_updates: false}))} className="text-[#0B1B3A] focus:ring-[#0B1B3A]" />
                      <span className="text-[14px] font-medium">No, I'm happy with email updates</span>
                    </div>
                    <span className="font-semibold text-[14px]">Included</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Conditional Postal Address — only when printed copy is selected */}
            {upsells.printed_copy && (
              <div className="panel p-6 bg-white border border-slate-200 rounded-md shadow-sm mb-6">
                <h3 className="text-[20px] font-medium text-[#0B1B3A] mb-5">Your Postal Address</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">Enter your postcode</label>
                    <div className="flex">
                      <input className="form-input rounded-r-none flex-1 h-11 border-slate-300 text-sm focus:ring-[#0B1B3A]" value={formData.postal_postcode ?? ''} onChange={e => setFormData(d => ({...d, postal_postcode: e.target.value}))} />
                      <button type="button" className="bg-[#0B1B3A] hover:bg-[#132c57] transition-colors text-white px-6 font-semibold rounded-r text-sm">Lookup</button>
                    </div>
                  </div>
                  <div>
                    <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">Address line 1</label>
                    <input className="form-input w-full h-11 border-slate-300 rounded text-sm focus:ring-[#0B1B3A]" value={formData.postal_address_line1 ?? ''} onChange={e => setFormData(d => ({...d, postal_address_line1: e.target.value}))} />
                  </div>
                  <div className="col-span-2">
                    <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">Address line 2</label>
                    <input className="form-input w-full h-11 border-slate-300 rounded text-sm focus:ring-[#0B1B3A]" value={formData.postal_address_line2 ?? ''} onChange={e => setFormData(d => ({...d, postal_address_line2: e.target.value}))} />
                  </div>
                  <div>
                    <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">City</label>
                    <input className="form-input w-full h-11 border-slate-300 rounded text-sm focus:ring-[#0B1B3A]" value={formData.postal_city ?? ''} onChange={e => setFormData(d => ({...d, postal_city: e.target.value}))} />
                  </div>
                  <div>
                    <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">County</label>
                    <input className="form-input w-full h-11 border-slate-300 rounded text-sm focus:ring-[#0B1B3A]" value={formData.postal_county ?? ''} onChange={e => setFormData(d => ({...d, postal_county: e.target.value}))} />
                  </div>
                  <div>
                    <label className="form-label text-[#2c3e50] font-semibold text-[13px] mb-1 block">Postcode</label>
                    <input className="form-input w-full h-11 border-slate-300 rounded text-sm focus:ring-[#0B1B3A]" value={formData.postal_postcode_confirm ?? ''} onChange={e => setFormData(d => ({...d, postal_postcode_confirm: e.target.value}))} />
                  </div>
                </div>
              </div>
            )}
            </>
          )}



          {/* Nav */}
          <div className="flex justify-start mt-8 pb-10 gap-4">
            <button onClick={() => {
              if (wizardStep === 0) {
                setStep('landing')
              } else {
                setWizardStep(s => s - 1)
              }
            }}
            className="border border-slate-300 bg-white hover:bg-slate-50 transition-colors text-[#2c3e50] font-medium px-8 py-2.5 rounded shadow-sm">
              Previous
            </button>
            <button onClick={() => {
              if (wizardStep < 1) {
                setWizardStep(s => s + 1)
              } else {
                const defaultItems = [
                  { id: 'base-doc-fee', item_type: selectedFormType?.name ?? 'Document Fee', amount: basePrice },
                  ...(hmlrFee > 0 ? [{ id: 'hmlr-fee', item_type: 'HMLR Fee', amount: hmlrFee }] : []),
                  ...(upsells.faster_docs ? [{ id: 'faster-docs', item_type: 'Fast Track Fee', amount: UPSELL_PRICES.faster_docs }] : []),
                  ...(upsells.printed_copy ? [{ id: 'printed-copy', item_type: 'Printed Copy Fee', amount: UPSELL_PRICES.printed_copy }] : []),
                  ...(upsells.sms_updates ? [{ id: 'sms-updates', item_type: 'SMS Updates Fee', amount: UPSELL_PRICES.sms_updates }] : []),
                  ...(formData.addon_title_plan === 'yes' ? [{ id: 'addon-title-plan', item_type: 'Title Plan', amount: 36.00 }] : []),
                  ...(formData.addon_title_register === 'yes' ? [{ id: 'addon-title-register', item_type: 'Title Register', amount: 36.00 }] : []),
                  ...(formData.addon_flood_risk === 'yes' ? [{ id: 'addon-flood-risk', item_type: 'Flood Risk', amount: 25.00 }] : []),
                ]
                setOrderItems(defaultItems)
                setStep('review')
              }
            }} className="bg-[#0B1B3A] hover:bg-[#132c57] transition-colors text-white font-medium px-8 py-2.5 rounded shadow">
              Next
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
      <div className="flex-1 overflow-y-auto p-8 bg-[#f8f9fa]">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Top Bar */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
            <h2 className="text-xl font-bold text-[#0B1B3A]">Step 3 of 3: Review & Payment</h2>
            <div className="text-right">
              <div className="text-2xl font-bold text-[#0B1B3A]">{formatCurrency(grandTotal)}</div>
              <div className="text-xs text-slate-500 font-medium">Running Total</div>
            </div>
          </div>
          
          <div className="progress-bar bg-slate-200 h-2 rounded-full overflow-hidden mb-8 border border-slate-200 shadow-inner">
            <div className="bg-[#0B1B3A] h-full transition-all duration-300" style={{ width: '100%' }} />
          </div>

          {/* Contact summary */}
          <div className="panel p-6 bg-white border border-slate-200 rounded-md shadow-sm mb-6">
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
          <div className="panel p-6 bg-white border border-slate-200 rounded-md shadow-sm mb-6">
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
            <div className="panel p-6 bg-white border border-slate-200 rounded-md shadow-sm mb-6">
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
              <div className="panel p-6 bg-white border border-slate-200 rounded-md shadow-sm mb-6">
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
                    className="w-full flex items-center gap-4 rounded-xl border-2 border-slate-200 hover:border-green-600 hover:bg-green-50/50 p-5 text-left transition-all group"
                  >
                    <div className="h-12 w-12 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                      {submitting && !generatingLink ? <Loader2 className="h-6 w-6 text-green-600 animate-spin" /> :
                       <CreditCard className="h-6 w-6 text-green-600" />}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 group-hover:text-green-700">Take Payment Now</div>
                      <div className="text-xs text-slate-400 mt-0.5">Create order & enter card details securely via Stripe Elements</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex justify-start mt-8 pb-10 gap-4">
                <button onClick={() => {
                  setStep('wizard')
                  setWizardStep(1)
                }} className="border border-slate-300 bg-white hover:bg-slate-50 transition-colors text-[#2c3e50] font-medium px-8 py-2.5 rounded shadow-sm">Previous</button>
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
