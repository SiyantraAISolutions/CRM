'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime, timeAgo, cn } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import { Plus, CheckCircle2, Circle, Clock } from 'lucide-react'
import { toast } from 'sonner'

type TaskStatus = 'open' | 'in_progress' | 'done'
type Priority = 'low' | 'medium' | 'high'

const priorityColors: Record<Priority, string> = {
  high: 'text-danger-red', medium: 'text-warning-orange', low: 'text-ink-gray-4'
}

interface User { id: string; full_name: string; avatar_url?: string }

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  due_at: string | null;
  assigned: { full_name: string; avatar_url?: string } | null;
  created_at: string;
  assigned_to: string | null;
}

export default function TasksClient({ currentUserId, users }: { currentUserId: string; users: User[] }) {
  const supabase = createClient()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'mine' | 'all'>('mine')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('open')
  const [showModal, setShowModal] = useState(false)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('tasks')
      .select('*, assigned:users!tasks_assigned_to_fkey(id,full_name,avatar_url), created_by_user:users!tasks_created_by_fkey(id,full_name)')
      .order('due_at', { ascending: true, nullsFirst: false })

    if (filter === 'mine') q = q.eq('assigned_to', currentUserId)
    if (statusFilter !== 'all') q = q.eq('status', statusFilter)

    const { data } = await q
    setTasks(data ?? [])
    setLoading(false)
  }, [filter, statusFilter, currentUserId, supabase])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  async function toggleStatus(id: string, current: string) {
    const next = current === 'open' ? 'in_progress' : current === 'in_progress' ? 'done' : 'open'
    await supabase.from('tasks').update({
      status: next,
      ...(next === 'done' ? { completed_at: new Date().toISOString(), completed_by: currentUserId } : {})
    }).eq('id', id)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: next } : t))
    if (next === 'done') toast.success('Task completed!')
  }

  const statusIcon = (status: string) => {
    if (status === 'done') return <CheckCircle2 className="h-5 w-5 text-success-green flex-shrink-0" />
    if (status === 'in_progress') return <Clock className="h-5 w-5 text-warning-orange flex-shrink-0" />
    return <Circle className="h-5 w-5 text-ink-gray-3 flex-shrink-0" />
  }

  const isOverdue = (dueAt: string | null, status: string) => {
    if (!dueAt || status === 'done') return false
    return new Date(dueAt) < new Date()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b bg-surface-gray-1">
        <div className="flex rounded-md border overflow-hidden">
          {(['mine', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-4 py-1.5 text-sm font-medium transition-colors',
                filter === f ? 'bg-navy text-white' : 'bg-white text-ink-gray-5 hover:bg-surface-gray-1')}>
              {f === 'mine' ? 'My Tasks' : 'All Tasks'}
            </button>
          ))}
        </div>
        <select className="form-input py-1 text-xs w-36" value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as TaskStatus | 'all')}>
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        <button onClick={() => setShowModal(true)} className="btn-primary gap-1 ml-auto">
          <Plus className="h-4 w-4" /> New Task
        </button>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="text-center py-10 text-sm text-ink-gray-4">Loading...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-10 text-sm text-ink-gray-4">No tasks found</div>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => {
              const dueAt = task.due_at
              const status = task.status
              const overdue = isOverdue(dueAt, status)
              const assigned = task.assigned

              return (
                <div key={task.id}
                  className={cn('flex items-start gap-3 rounded-lg border bg-white p-4 transition-colors',
                    overdue && 'border-danger-red/30 bg-surface-red-2/20')}>
                  <button onClick={() => toggleStatus(task.id, status)} className="mt-0.5">
                    {statusIcon(status)}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className={cn('font-medium text-sm', status === 'done' && 'line-through text-ink-gray-4')}>
                        {task.title}
                      </span>
                      <span className={cn('text-xs font-semibold flex-shrink-0', priorityColors[task.priority])}>
                        {task.priority.toUpperCase()}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-xs text-ink-gray-5 mt-0.5 truncate">{task.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      {dueAt && (
                        <span className={cn('text-xs', overdue ? 'text-danger-red font-medium' : 'text-ink-gray-4')}>
                          {overdue ? '⚠ Overdue: ' : 'Due: '}{formatDateTime(dueAt)}
                        </span>
                      )}
                      {assigned && (
                        <div className="flex items-center gap-1 ml-auto">
                          <Avatar label={assigned.full_name} image={assigned.avatar_url} size="xs" />
                          <span className="text-xs text-ink-gray-4">{assigned.full_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <CreateTaskModal users={users} currentUserId={currentUserId}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetchTasks() }} />
      )}
    </div>
  )
}

function CreateTaskModal({ users, currentUserId, onClose, onCreated }: {
  users: User[]; currentUserId: string; onClose: () => void; onCreated: () => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState({ title: '', description: '', assigned_to: currentUserId, priority: 'medium', due_at: '' })
  const [submitting, setSubmitting] = useState(false)

  function setF(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title) return
    setSubmitting(true)
    await supabase.from('tasks').insert({
      ...form,
      created_by: currentUserId,
      due_at: form.due_at || null,
      status: 'open',
    })
    setSubmitting(false)
    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-ink-gray-9">New Task</h2>
          <button onClick={onClose} className="btn-ghost p-1 text-lg">×</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div><label className="form-label">Title *</label>
            <input className="form-input" required value={form.title} onChange={e => setF('title', e.target.value)} /></div>
          <div><label className="form-label">Description</label>
            <textarea className="form-input resize-none" rows={3} value={form.description} onChange={e => setF('description', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Priority</label>
              <select className="form-input" value={form.priority} onChange={e => setF('priority', e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select></div>
            <div><label className="form-label">Due Date</label>
              <input type="datetime-local" className="form-input" value={form.due_at} onChange={e => setF('due_at', e.target.value)} /></div>
          </div>
          <div><label className="form-label">Assign To</label>
            <select className="form-input" value={form.assigned_to} onChange={e => setF('assigned_to', e.target.value)}>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select></div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
