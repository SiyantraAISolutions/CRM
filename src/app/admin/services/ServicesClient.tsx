'use client'

import { useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

type Service = {
  id: string; code: string; name: string; business_id: string
  base_price: number; fee_scale: string | null
}
type Business = { id: string; name: string }

interface Props { services: Service[]; businesses: Business[] }

export default function ServicesClient({ services: initial, businesses }: Props) {
  const supabase = createClient()
  const [services, setServices] = useState<Service[]>(initial)
  const [editId, setEditId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [editError, setEditError] = useState('')

  function startEdit(s: Service) {
    setEditId(s.id)
    setEditPrice(String(s.base_price))
    setEditError('')
  }

  async function savePrice(service: Service) {
    setEditError('')
    const val = parseFloat(editPrice)
    if (isNaN(val) || val <= 0) { setEditError('Price must be greater than £0'); return }
    if (val > 999999.99) { setEditError('Price too large'); return }

    const { error } = await supabase.from('form_types').update({ base_price: val }).eq('id', service.id)
    if (error) { toast.error('Failed to update price'); return }

    // Audit log
    await supabase.from('audit_logs').insert({
      action_type: 'service_price_change',
      target_table: 'form_types',
      target_id: service.id,
      old_value: { base_price: service.base_price },
      new_value: { base_price: val },
    })

    setServices(prev => prev.map(s => s.id === service.id ? { ...s, base_price: val } : s))
    setEditId(null)
    toast.success('Price updated')
  }

  function getBusinessName(businessId: string) {
    return businesses.find(b => b.id === businessId)?.name ?? '—'
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b px-5 py-3 bg-surface-gray-1">
        <h1 className="text-lg font-bold text-ink-gray-9">Services & Prices</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        <div className="panel p-0 overflow-hidden">
          <table className="data-table">
            <thead>
              <tr><th>Code</th><th>Service Name</th><th>Business</th><th>Fee Scale</th><th>Base Price</th><th>Edit</th></tr>
            </thead>
            <tbody>
              {services.map(s => (
                <tr key={s.id}>
                  <td className="font-mono text-xs">{s.code}</td>
                  <td className="font-medium">{s.name}</td>
                  <td className="text-sm text-ink-gray-5">{getBusinessName(s.business_id)}</td>
                  <td className="text-xs text-ink-gray-5 capitalize">{s.fee_scale?.replace('scale', 'Scale ') ?? '—'}</td>
                  <td>
                    {editId === s.id ? (
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-ink-gray-5 text-sm">£</span>
                          <input
                            type="number" step="0.01" min="0.01"
                            className="form-input w-28 py-1 text-sm"
                            value={editPrice}
                            onChange={e => setEditPrice(e.target.value)}
                            autoFocus
                          />
                        </div>
                        {editError && <div className="text-xs text-danger-red mt-1">{editError}</div>}
                      </div>
                    ) : (
                      <span className="font-semibold">{formatCurrency(s.base_price)}</span>
                    )}
                  </td>
                  <td>
                    {editId === s.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => savePrice(s)} className="p-1 rounded text-success-green hover:bg-surface-green"><Check className="h-4 w-4" /></button>
                        <button onClick={() => setEditId(null)} className="p-1 rounded text-danger-red hover:bg-surface-red-2"><X className="h-4 w-4" /></button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(s)} className="p-1 rounded text-ink-gray-5 hover:bg-surface-gray-1"><Pencil className="h-4 w-4" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

