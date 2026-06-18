'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const DEPARTMENTS = ['Sales', 'Admin']
const PRIORITIES = ['low', 'medium', 'high']

export default function CreateTicketForm({ brands }: { brands: { id: string; code: string; name: string }[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({
    department: '',
    brand_id: '',
    priority: 'medium',
    name: '',
    body: ''
  })
  const [submitting, setSubmitting] = useState(false)

  function setField(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.department || !form.brand_id || !form.name || !form.body) {
      toast.error('Please fill in all required fields')
      return
    }
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()

    // Get next ticket number
    const { count } = await supabase.from('tickets').select('id', { count: 'exact', head: true })
    const number = (count ?? 0) + 27500 // offset to start at realistic number

    const { error } = await supabase.from('tickets').insert({
      ...form,
      number,
      status: 'pending',
      user_id: user?.id,
    })

    if (error) { toast.error('Failed to create ticket'); setSubmitting(false); return }
    toast.success('Ticket created')
    router.push('/admin/tickets')
  }

  return (
    <form onSubmit={handleSubmit} className="panel space-y-4">
      <div>
        <label className="form-label">Department *</label>
        <select className="form-input" value={form.department} onChange={e => setField('department', e.target.value)}>
          <option value="">Select Department</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div>
        <label className="form-label">Site *</label>
        <select className="form-input" value={form.brand_id} onChange={e => setField('brand_id', e.target.value)}>
          <option value="">Select Site</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
        </select>
      </div>
      <div>
        <label className="form-label">Priority *</label>
        <select className="form-input" value={form.priority} onChange={e => setField('priority', e.target.value)}>
          {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
      </div>
      <div>
        <label className="form-label">Name / Subject *</label>
        <input className="form-input" value={form.name} onChange={e => setField('name', e.target.value)} />
      </div>
      <div>
        <label className="form-label">Ticket Body *</label>
        <textarea className="form-input resize-none" rows={5} value={form.body} onChange={e => setField('body', e.target.value)} />
      </div>
      <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
        {submitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  )
}
