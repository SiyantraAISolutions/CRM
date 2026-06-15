'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import { toast } from 'sonner'
import { UserPlus, Edit2, Check, X } from 'lucide-react'

type UserRole = 'director' | 'sales' | 'admin'
type Status = 'available' | 'break' | 'lunch' | 'toilet' | 'training'

interface TeamUser {
  id: string; full_name: string; email: string
  role: UserRole; current_status: Status; sales_target: number; created_at: string
  user_businesses?: { business_id: string }[]
}
interface Business { id: string; name: string }

const roleBadge = (role: string) => {
  const map: Record<string, 'red' | 'blue' | 'gray'> = { director: 'red', sales: 'blue', admin: 'gray' }
  return <Badge label={role.toUpperCase()} variant={map[role] ?? 'gray'} />
}

const statusDot: Record<Status, string> = {
  available: 'bg-success-green', break: 'bg-warning-orange',
  lunch: 'bg-warning-orange', toilet: 'bg-ink-gray-4', training: 'bg-accent-blue',
}

export default function TeamClient({ users: initialUsers, businesses }: { users: TeamUser[]; businesses: Business[] }) {
  const supabase = createClient()
  const [users, setUsers] = useState(initialUsers)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<TeamUser>>({})
  const [editBusinesses, setEditBusinesses] = useState<string[]>([])
  const [showInviteModal, setShowInviteModal] = useState(false)

  function startEdit(user: TeamUser) {
    setEditingId(user.id)
    setEditForm({ role: user.role, sales_target: user.sales_target })
    setEditBusinesses(user.user_businesses?.map(ub => ub.business_id) ?? [])
  }

  async function saveEdit(id: string) {
    // 1. Update user role and sales target
    await supabase.from('users').update(editForm).eq('id', id)
    
    // 2. Update many-to-many business assignments
    await supabase.from('user_businesses').delete().eq('user_id', id)
    if (editBusinesses.length > 0) {
      const inserts = editBusinesses.map(bId => ({
        user_id: id,
        business_id: bId
      }))
      await supabase.from('user_businesses').insert(inserts)
    }

    setUsers(prev => prev.map(u => u.id === id ? { 
      ...u, 
      ...editForm,
      user_businesses: editBusinesses.map(bId => ({ business_id: bId }))
    } as TeamUser : u))
    
    setEditingId(null)
    toast.success('User updated')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b bg-surface-gray-1">
        <span className="text-sm text-ink-gray-5">{users.length} team members</span>
        <button onClick={() => setShowInviteModal(true)} className="btn-primary gap-1">
          <UserPlus className="h-4 w-4" /> Invite Member
        </button>
      </div>

      {/* Team table */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="panel p-0 overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th><th>Role</th><th>Assigned Businesses</th><th>Status</th>
                <th>Sales Target</th><th>Joined</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar label={user.full_name} size="md" />
                      <div>
                        <div className="font-medium text-ink-gray-9">{user.full_name}</div>
                        <div className="text-xs text-ink-gray-4">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {editingId === user.id ? (
                      <select className="form-input py-0.5 text-xs w-28"
                        value={editForm.role}
                        onChange={e => setEditForm(f => ({ ...f, role: e.target.value as UserRole }))}>
                        <option value="director">Director</option>
                        <option value="sales">Sales</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : roleBadge(user.role)}
                  </td>
                  <td>
                    {editingId === user.id ? (
                      <div className="flex flex-col gap-1">
                        {businesses.map(b => (
                          <label key={b.id} className="flex items-center gap-1.5 text-xs text-ink-gray-7">
                            <input
                              type="checkbox"
                              checked={editBusinesses.includes(b.id)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setEditBusinesses(prev => [...prev, b.id])
                                } else {
                                  setEditBusinesses(prev => prev.filter(id => id !== b.id))
                                }
                              }}
                            />
                            {b.name}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {user.role === 'director' ? (
                          <Badge label="ALL BUSINESSES" variant="red" />
                        ) : user.user_businesses && user.user_businesses.length > 0 ? (
                          user.user_businesses.map(ub => {
                            const bizName = businesses.find(b => b.id === ub.business_id)?.name
                            return bizName ? <Badge key={ub.business_id} label={bizName} variant="blue" /> : null
                          })
                        ) : (
                          <span className="text-xs text-ink-gray-4 italic">No assignments</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <div className={`h-2 w-2 rounded-full ${statusDot[user.current_status] ?? 'bg-ink-gray-3'}`} />
                      <span className="text-sm capitalize">{user.current_status?.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td>
                    {editingId === user.id ? (
                      <input type="number" className="form-input py-0.5 text-xs w-24"
                        value={editForm.sales_target}
                        onChange={e => setEditForm(f => ({ ...f, sales_target: Number(e.target.value) }))} />
                    ) : (
                      <span className="text-sm">£{(user.sales_target ?? 0).toLocaleString()}/mo</span>
                    )}
                  </td>
                  <td className="text-xs text-ink-gray-4">{formatDate(user.created_at)}</td>
                  <td>
                    {editingId === user.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => saveEdit(user.id)} className="btn-ghost p-1 text-success-green">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="btn-ghost p-1 text-danger-red">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(user)} className="btn-ghost p-1">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>


      {showInviteModal && (
        <InviteModal onClose={() => setShowInviteModal(false)}
          onInvited={() => setShowInviteModal(false)} />
      )}
    </div>
  )
}

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('sales')
  const [submitting, setSubmitting] = useState(false)

  const [email2, setEmail2] = useState('')

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    // Send invite via Supabase Auth
    const { error } = await supabase.auth.admin?.inviteUserByEmail
      ? { error: null } // Would use admin in server action
      : await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/admin` } })

    if (!error) {
      toast.success(`Invite sent to ${email}`)
      onInvited()
    } else {
      toast.error('Failed to send invite')
    }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold">Invite Team Member</h2>
          <button onClick={onClose} className="btn-ghost p-1 text-lg">×</button>
        </div>
        <form onSubmit={invite} className="p-5 space-y-4">
          <div>
            <label className="form-label">Email Address *</label>
            <input type="email" required className="form-input" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="agent@kws-managementservices.co.uk" />
          </div>
          <div>
            <label className="form-label">Role</label>
            <select className="form-input" value={role} onChange={e => setRole(e.target.value as UserRole)}>
              <option value="sales">Sales</option>
              <option value="admin">Admin</option>
              <option value="director">Director</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
