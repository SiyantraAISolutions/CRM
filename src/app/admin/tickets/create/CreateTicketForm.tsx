'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const DEPARTMENTS = ['Sales', 'Admin']
const PRIORITIES = ['low', 'medium', 'high']

export default function CreateTicketForm({ brands, resumeDraft }: { 
  brands: { id: string; code: string; name: string }[] 
  resumeDraft?: any
}) {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({
    department: resumeDraft?.form_data?.department || '',
    brand_id: resumeDraft?.form_data?.brand_id || '',
    priority: resumeDraft?.form_data?.priority || 'medium',
    name: resumeDraft?.form_data?.name || '',
    body: resumeDraft?.form_data?.body || ''
  })
  const [draftId, setDraftId] = useState<string | null>(resumeDraft?.id || null)
  const [submitting, setSubmitting] = useState(false)

  // Auto-save draft on typing
  useEffect(() => {
    if (!form.department && !form.brand_id && !form.name && !form.body) return

    const timer = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const draftPayload = {
        user_id: user.id,
        draft_type: 'ticket',
        brand_id: form.brand_id || null,
        customer_name: form.name || 'Untitled Ticket',
        form_type_code: form.department || 'Ticket',
        form_type_name: `${form.department || 'Support'} Ticket`,
        form_data: form,
        updated_at: new Date().toISOString()
      }

      if (draftId) {
        await supabase.from('work_drafts').update(draftPayload).eq('id', draftId)
      } else {
        const { data } = await supabase
          .from('work_drafts')
          .insert(draftPayload)
          .select('id')
          .single()
        if (data?.id) {
          setDraftId(data.id)
        }
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [form, draftId, supabase])

  // Prevent accidental navigation when form has details entered
  useEffect(() => {
    const isDirty = !submitting && !!(form.department || form.brand_id || form.name || form.body)

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
        return ''
      }
    }

    const handleClientNavigation = (e: MouseEvent) => {
      if (!isDirty) return

      let target = e.target as HTMLElement | null
      while (target && target.tagName !== 'A') {
        target = target.parentElement
      }

      if (target && target.tagName === 'A') {
        const href = target.getAttribute('href')
        if (href && href.startsWith('/') && !href.startsWith('#')) {
          e.preventDefault()
          e.stopPropagation()
          
          const confirmTab = window.confirm(
            'You have an active ticket in progress. Would you like to open the new page in a new tab so you do not lose your place?'
          )
          if (confirmTab) {
            window.open(href, '_blank')
          }
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleClientNavigation, true)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleClientNavigation, true)
    }
  }, [form, submitting])

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
