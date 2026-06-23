'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, PhoneOff, ChevronRight, CreditCard, Link2, Loader2, Check, Copy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency } from '@/lib/utils'
import { calculateHMLRFee, getScaleForFormType } from '@/lib/hmlr-fees'
import { toast } from 'sonner'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

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

  useEffect(() => {
    if (!selectedBrand) return
    supabase
      .from('form_types')
      .select('id, code, name, brand_ids, base_price, fee_scale, tc_template, business_id')
      .contains('brand_ids', [selectedBrand.id])
      .then(({ data }) => setFormTypes(data ?? []))
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
  }

  const basePrice = selectedFormType ? (SERVICE_RETAIL_VALS[selectedFormType.code] ?? selectedFormType.base_price) : 0
  const upsellTotal = (upsells.faster_docs ? UPSELL_PRICES.faster_docs : 0)
    + (upsells.printed_copy ? UPSELL_PRICES.printed_copy : 0)
    + (upsells.sms_updates ? UPSELL_PRICES.sms_updates : 0)
  const grandTotal = basePrice + upsellTotal + hmlrFee

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

    const lineItems = [
      { order_id: newOrder.id, item_type: 'Document Fee', amount: basePrice },
      ...(hmlrFee > 0 ? [{ order_id: newOrder.id, item_type: 'HMLR Fee', amount: hmlrFee }] : []),
      ...(upsells.faster_docs ? [{ order_id: newOrder.id, item_type: 'Fast Track Fee', amount: UPSELL_PRICES.faster_docs }] : []),
      ...(upsells.printed_copy ? [{ order_id: newOrder.id, item_type: 'Printed Copy Fee', amount: UPSELL_PRICES.printed_copy }] : []),
      ...(upsells.sms_updates ? [{ order_id: newOrder.id, item_type: 'SMS Updates Fee', amount: UPSELL_PRICES.sms_updates }] : []),
    ]
    await supabase.from('order_items').insert(lineItems)

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
              <div key={ft.id} className="flex items-center justify-between rounded-lg border bg-white p-4 hover:bg-surface-gray-1">
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
            <button onClick={() => setStep('review')} className="btn-primary">Next →</button>
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
            <div className="section-heading">Price Breakdown</div>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-t border-outline-gray-2">
                  <td className="py-2 text-ink-gray-5">Document Fee</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(basePrice)} <span className="text-xs text-ink-gray-4">Including VAT</span></td>
                </tr>
                {hmlrFee > 0 && (
                  <tr className="border-t border-outline-gray-2">
                    <td className="py-2 text-ink-gray-5">Land Registry Fee</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(hmlrFee)} <span className="text-xs text-ink-gray-4">Including VAT</span></td>
                  </tr>
                )}
                {upsellTotal > 0 && (
                  <tr className="border-t border-outline-gray-2">
                    <td className="py-2 text-ink-gray-5">Additional Services</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(upsellTotal)} <span className="text-xs text-ink-gray-4">Including VAT</span></td>
                  </tr>
                )}
                <tr className="border-t-2 border-outline-gray-3">
                  <td className="py-2 font-bold text-ink-gray-9">Total Fee</td>
                  <td className="py-2 text-right font-bold text-xl text-ink-gray-9">{formatCurrency(grandTotal)} <span className="text-xs text-ink-gray-4">Including VAT</span></td>
                </tr>
              </tbody>
            </table>
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
