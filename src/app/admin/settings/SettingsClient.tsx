'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Save, Building2, CreditCard, Globe, Calendar, Link2, AlertCircle } from 'lucide-react'

interface Business {
  id: string; name: string; domain?: string; colour?: string
  logo_url?: string; status: string
}

export default function SettingsClient({
  settings: initialSettings,
  businesses: initialBusinesses,
}: {
  settings: Record<string, string>
  businesses: Business[]
}) {
  const supabase = createClient()
  const [settings, setSettings] = useState(initialSettings)
  const [businesses, setBusinesses] = useState(initialBusinesses)
  const [activeTab, setActiveTab] = useState<'general' | 'businesses' | 'payments' | 'calendly'>('general')
  const [saving, setSaving] = useState(false)
  const [editingBiz, setEditingBiz] = useState<Business | null>(null)

  const [calendlyStatus, setCalendlyStatus] = useState<{
    connected: boolean
    user?: { name: string; email: string; avatar_url?: string }
    webhookSubscribed: boolean
    webhookUri?: string
  } | null>(null)
  const [loadingCalendly, setLoadingCalendly] = useState(false)
  const [submittingWebhook, setSubmittingWebhook] = useState(false)

  const fetchCalendlyStatus = async () => {
    setLoadingCalendly(true)
    try {
      const res = await fetch('/api/calendly/subscribe')
      if (res.ok) {
        const data = await res.json()
        setCalendlyStatus(data)
      }
    } catch (err) {
      console.error('Failed to load Calendly status:', err)
    } finally {
      setLoadingCalendly(false)
    }
  }

  useEffect(() => {
    fetchCalendlyStatus()
  }, [])

  const toggleWebhook = async () => {
    if (!calendlyStatus) return
    setSubmittingWebhook(true)
    try {
      const action = calendlyStatus.webhookSubscribed ? 'unsubscribe' : 'subscribe'
      const res = await fetch('/api/calendly/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        toast.success(
          action === 'subscribe'
            ? 'Subscribed to Calendly webhooks'
            : 'Unsubscribed from Calendly webhooks'
        )
        fetchCalendlyStatus()
      } else {
        const errData = await res.json()
        toast.error(`Operation failed: ${errData.error || 'Unknown error'}`)
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`)
    } finally {
      setSubmittingWebhook(false)
    }
  }

  async function saveSetting(key: string, value: string) {
    await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() })
    setSettings(s => ({ ...s, [key]: value }))
  }

  async function saveAllSettings() {
    setSaving(true)
    await Promise.all(Object.entries(settings).map(([k, v]) => saveSetting(k, v)))
    setSaving(false)
    toast.success('Settings saved')
  }

  async function saveBusiness(biz: Business) {
    await supabase.from('businesses').update({
      name: biz.name, domain: biz.domain, colour: biz.colour, status: biz.status
    }).eq('id', biz.id)
    setBusinesses(prev => prev.map(b => b.id === biz.id ? biz : b))
    setEditingBiz(null)
    toast.success('Business updated')
  }

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Globe },
    { id: 'businesses' as const, label: 'Businesses', icon: Building2 },
    { id: 'payments' as const, label: 'Payments', icon: CreditCard },
    { id: 'calendly' as const, label: 'Calendly', icon: Calendar },
  ]

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Tab sidebar */}
      <div className="w-52 border-r bg-surface-gray-1 p-3 space-y-0.5 flex-shrink-0">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 w-full rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-navy text-white'
                  : 'text-ink-gray-6 hover:bg-surface-gray-2 hover:text-ink-gray-9'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {activeTab === 'general' && (
          <div className="max-w-lg space-y-5">
            <h2 className="text-lg font-bold text-ink-gray-9">General Settings</h2>
            <div className="panel space-y-4">
              <div>
                <label className="form-label">Company Name</label>
                <input className="form-input"
                  value={settings['company_name'] ?? 'KWS Management Services'}
                  onChange={e => setSettings(s => ({ ...s, company_name: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Support Phone</label>
                <input className="form-input"
                  value={settings['support_phone'] ?? '0333 577 0077'}
                  onChange={e => setSettings(s => ({ ...s, support_phone: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Default Currency</label>
                <select className="form-input"
                  value={settings['currency'] ?? 'GBP'}
                  onChange={e => setSettings(s => ({ ...s, currency: e.target.value }))}>
                  <option value="GBP">GBP (£)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
            </div>
            <button onClick={saveAllSettings} disabled={saving} className="btn-primary gap-1">
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}

        {activeTab === 'businesses' && (
          <div className="max-w-2xl space-y-5">
            <h2 className="text-lg font-bold text-ink-gray-9">Businesses</h2>
            <p className="text-sm text-ink-gray-5">
              Each business is a row in the database. Adding a new business here automatically makes it available across the entire CRM.
            </p>
            <div className="space-y-3">
              {businesses.map(biz => (
                <div key={biz.id} className="panel">
                  {editingBiz?.id === biz.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="form-label">Name</label>
                          <input className="form-input" value={editingBiz.name}
                            onChange={e => setEditingBiz(b => b ? { ...b, name: e.target.value } : b)} />
                        </div>
                        <div>
                          <label className="form-label">Domain</label>
                          <input className="form-input" value={editingBiz.domain ?? ''}
                            onChange={e => setEditingBiz(b => b ? { ...b, domain: e.target.value } : b)} />
                        </div>
                        <div>
                          <label className="form-label">Brand Colour</label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={editingBiz.colour ?? '#16243B'}
                              onChange={e => setEditingBiz(b => b ? { ...b, colour: e.target.value } : b)}
                              className="h-9 w-14 rounded border cursor-pointer" />
                            <input className="form-input flex-1" value={editingBiz.colour ?? '#16243B'}
                              onChange={e => setEditingBiz(b => b ? { ...b, colour: e.target.value } : b)} />
                          </div>
                        </div>
                        <div>
                          <label className="form-label">Status</label>
                          <select className="form-input" value={editingBiz.status}
                            onChange={e => setEditingBiz(b => b ? { ...b, status: e.target.value } : b)}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => saveBusiness(editingBiz)} className="btn-primary">Save</button>
                        <button onClick={() => setEditingBiz(null)} className="btn-outline">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full border" style={{ backgroundColor: biz.colour ?? '#16243B' }} />
                        <div>
                          <div className="font-medium text-ink-gray-9">{biz.name}</div>
                          <div className="text-xs text-ink-gray-4">{biz.domain}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-medium ${biz.status === 'active' ? 'text-success-green' : 'text-ink-gray-4'}`}>
                          {biz.status}
                        </span>
                        <button onClick={() => setEditingBiz(biz)} className="btn-ghost py-1 px-2 text-xs">Edit</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="max-w-lg space-y-5">
            <h2 className="text-lg font-bold text-ink-gray-9">Payment Settings</h2>
            <div className="panel space-y-4">
              <div>
                <label className="form-label">Stripe Processing Fee (%)</label>
                <input type="number" step="0.1" className="form-input"
                  value={settings['stripe_fee_pct'] ?? '2.9'}
                  onChange={e => setSettings(s => ({ ...s, stripe_fee_pct: e.target.value }))} />
                <p className="text-xs text-ink-gray-4 mt-1">Standard Stripe fee for display purposes</p>
              </div>
              <div>
                <label className="form-label">Stripe Webhook Secret</label>
                <input type="password" className="form-input" placeholder="whsec_..."
                  value={settings['stripe_webhook_secret'] ?? ''}
                  onChange={e => setSettings(s => ({ ...s, stripe_webhook_secret: e.target.value }))} />
              </div>
              <div className="rounded-lg bg-surface-blue border border-accent-blue/20 px-4 py-3 text-sm text-ink-blue">
                <strong>Stripe Webhook URL:</strong><br />
                <code className="text-xs">{typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/webhooks/stripe</code>
              </div>
            </div>
            <button onClick={saveAllSettings} disabled={saving} className="btn-primary gap-1">
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}

        {activeTab === 'calendly' && (
          <div className="max-w-xl space-y-5">
            <h2 className="text-lg font-bold text-ink-gray-9">Calendly Integration</h2>
            <p className="text-sm text-ink-gray-5">
              Sync scheduled client meetings directly into your CRM lead pipeline.
            </p>

            {loadingCalendly ? (
              <div className="text-sm text-ink-gray-4 py-4">Loading connection status...</div>
            ) : !calendlyStatus?.connected ? (
              <div className="panel space-y-4 max-w-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-ink-gray-4 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-ink-gray-9 text-sm">Calendly is not connected</h3>
                    <p className="text-xs text-ink-gray-5 mt-1">
                      Connect your Calendly account to enable automatic booking synchronization into the enquiries pipeline.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => window.location.href = '/api/calendly/auth'}
                  className="btn-primary gap-1"
                >
                  <Link2 className="h-4 w-4" />
                  Connect Calendly
                </button>
              </div>
            ) : (
              <div className="panel space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b">
                  {calendlyStatus.user?.avatar_url ? (
                    <img
                      src={calendlyStatus.user.avatar_url}
                      alt={calendlyStatus.user.name}
                      className="h-10 w-10 rounded-full"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-navy text-white flex items-center justify-center font-bold">
                      {calendlyStatus.user?.name?.[0] || 'C'}
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-ink-gray-9">{calendlyStatus.user?.name}</div>
                    <div className="text-xs text-ink-gray-4">{calendlyStatus.user?.email}</div>
                  </div>
                  <div className="ml-auto">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-success-green border border-green-200">
                      Connected
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="form-label">Webhook Synchronization</label>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                        calendlyStatus.webhookSubscribed 
                          ? 'bg-blue-50 text-accent-blue border-blue-200' 
                          : 'bg-yellow-50 text-yellow-600 border-yellow-200'
                      }`}>
                        {calendlyStatus.webhookSubscribed ? 'Active Syncing' : 'Inactive'}
                      </span>
                      <button
                        onClick={toggleWebhook}
                        disabled={submittingWebhook}
                        className={`btn-xs ${calendlyStatus.webhookSubscribed ? 'btn-outline' : 'btn-primary'}`}
                      >
                        {submittingWebhook ? 'Processing...' : calendlyStatus.webhookSubscribed ? 'Disable Sync' : 'Enable Sync'}
                      </button>
                    </div>
                    <p className="text-xs text-ink-gray-4 mt-2">
                      Enables or disables receiving booking notifications from Calendly.
                    </p>
                  </div>

                  <div className="border-t pt-4">
                    <label className="form-label">Default Business for Bookings</label>
                    <select
                      className="form-input max-w-xs mt-1"
                      value={settings['calendly_default_business_id'] ?? ''}
                      onChange={async (e) => {
                        const val = e.target.value
                        await saveSetting('calendly_default_business_id', val)
                        toast.success('Default business updated')
                      }}
                    >
                      <option value="">Select Default Business...</option>
                      {businesses.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-ink-gray-4 mt-2">
                      New Calendly bookings will be assigned to this business in the CRM by default.
                    </p>
                  </div>

                  <div className="border-t pt-4 flex gap-2">
                    <button
                      onClick={async () => {
                        if (confirm('Are you sure you want to disconnect Calendly? This will delete all credentials and disable syncing.')) {
                          // De-register webhook first
                          if (calendlyStatus.webhookSubscribed) {
                            await fetch('/api/calendly/subscribe', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'unsubscribe' }),
                            })
                          }
                          // Delete settings from db
                          await Promise.all([
                            supabase.from('settings').delete().eq('key', 'calendly_access_token'),
                            supabase.from('settings').delete().eq('key', 'calendly_refresh_token'),
                            supabase.from('settings').delete().eq('key', 'calendly_expires_at'),
                            supabase.from('settings').delete().eq('key', 'calendly_user_uri'),
                            supabase.from('settings').delete().eq('key', 'calendly_org_uri'),
                            supabase.from('settings').delete().eq('key', 'calendly_default_business_id'),
                          ])
                          toast.success('Calendly disconnected')
                          fetchCalendlyStatus()
                          setSettings(s => {
                            const copy = { ...s }
                            delete copy.calendly_default_business_id
                            return copy
                          })
                        }
                      }}
                      className="text-xs text-red-600 hover:text-red-800 font-semibold"
                    >
                      Disconnect Account
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
