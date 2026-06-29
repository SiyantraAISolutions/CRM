'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, Plus, Trash2, Edit, Save, ToggleLeft, ToggleRight, User, AlertCircle, X, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

interface Solicitor {
  id: string
  full_name: string
  email: string
  is_active: boolean
}

interface Availability {
  id?: string
  day_of_week: number
  start_time: string
  end_time: string
  slot_duration: number
}

interface BlockedDate {
  id: string
  blocked_date: string
  notes: string | null
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

export default function SchedulerClient() {
  const [solicitors, setSolicitors] = useState<Solicitor[]>([])
  const [selectedSol, setSelectedSol] = useState<Solicitor | null>(null)
  
  // Solicitor Form state
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [solForm, setSolForm] = useState({ id: '', full_name: '', email: '', is_active: true })
  
  // Availability state
  const [availabilities, setAvailabilities] = useState<Availability[]>([])
  const [loadingAvail, setLoadingAvail] = useState(false)
  
  // Blocked dates state
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [loadingBlocked, setLoadingBlocked] = useState(false)
  const [newBlockedDate, setNewBlockedDate] = useState('')
  const [newBlockedNotes, setNewBlockedNotes] = useState('')

  // Fetch all solicitors
  const fetchSolicitors = async () => {
    try {
      const res = await fetch('/api/solicitors')
      const data = await res.json()
      if (res.ok) {
        setSolicitors(data)
        if (data.length > 0 && !selectedSol) {
          setSelectedSol(data[0])
        }
      } else {
        toast.error(data.error || 'Failed to load solicitors')
      }
    } catch (err) {
      toast.error('Network error loading solicitors')
    }
  }

  // Fetch availability and blocked dates for selected solicitor
  const fetchSolDetails = async (solId: string) => {
    setLoadingAvail(true)
    setLoadingBlocked(true)
    try {
      // Fetch Availability
      const availRes = await fetch(`/api/solicitors/${solId}/availability`)
      const availData = await availRes.json()
      if (availRes.ok) {
        setAvailabilities(availData)
      }

      // Fetch Blocked Dates
      const blockedRes = await fetch(`/api/solicitors/${solId}/blocked-dates`)
      const blockedData = await blockedRes.json()
      if (blockedRes.ok) {
        setBlockedDates(blockedData)
      }
    } catch (err) {
      toast.error('Error fetching solicitor details')
    } finally {
      setLoadingAvail(false)
      setLoadingBlocked(false)
    }
  }

  useEffect(() => {
    fetchSolicitors()
  }, [])

  useEffect(() => {
    if (selectedSol) {
      fetchSolDetails(selectedSol.id)
    } else {
      setAvailabilities([])
      setBlockedDates([])
    }
  }, [selectedSol])

  // Handle adding solicitor
  const handleAddSolicitor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!solForm.full_name || !solForm.email) return

    try {
      const res = await fetch('/api/solicitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(solForm),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Solicitor added successfully')
        setShowAddModal(false)
        setSolForm({ id: '', full_name: '', email: '', is_active: true })
        fetchSolicitors()
      } else {
        toast.error(data.error || 'Failed to add solicitor')
      }
    } catch (err) {
      toast.error('Error submitting solicitor')
    }
  }

  // Handle updating solicitor
  const handleUpdateSolicitor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!solForm.full_name || !solForm.email) return

    try {
      const res = await fetch(`/api/solicitors/${solForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(solForm),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Solicitor updated')
        setShowEditModal(false)
        if (selectedSol?.id === data.id) {
          setSelectedSol(data)
        }
        fetchSolicitors()
      } else {
        toast.error(data.error || 'Failed to update solicitor')
      }
    } catch (err) {
      toast.error('Error updating solicitor')
    }
  }

  // Handle deleting solicitor
  const handleDeleteSolicitor = async (id: string) => {
    if (!confirm('Are you sure you want to delete this solicitor? All associated bookings, availability and settings will be removed.')) return

    try {
      const res = await fetch(`/api/solicitors/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Solicitor deleted')
        setShowEditModal(false)
        if (selectedSol?.id === id) {
          setSelectedSol(null)
        }
        fetchSolicitors()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete solicitor')
      }
    } catch (err) {
      toast.error('Error deleting solicitor')
    }
  }

  // Handle toggling day active status
  const handleToggleDay = (dayValue: number) => {
    const existing = availabilities.find(a => a.day_of_week === dayValue)
    if (existing) {
      setAvailabilities(prev => prev.filter(a => a.day_of_week !== dayValue))
    } else {
      setAvailabilities(prev => [...prev, {
        day_of_week: dayValue,
        start_time: '09:00:00',
        end_time: '17:00:00',
        slot_duration: 15
      }].sort((a, b) => a.day_of_week - b.day_of_week))
    }
  }

  // Handle editing time / duration
  const handleUpdateAvailField = (dayValue: number, field: keyof Availability, value: any) => {
    setAvailabilities(prev => prev.map(a => {
      if (a.day_of_week === dayValue) {
        return { ...a, [field]: value }
      }
      return a
    }))
  }

  // Save weekly availability settings
  const handleSaveAvailability = async () => {
    if (!selectedSol) return

    try {
      const res = await fetch(`/api/solicitors/${selectedSol.id}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availabilities }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Availability settings saved')
        fetchSolDetails(selectedSol.id)
      } else {
        toast.error(data.error || 'Failed to save availability')
      }
    } catch (err) {
      toast.error('Error saving availability')
    }
  }

  // Add Blocked Date
  const handleAddBlockedDate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSol || !newBlockedDate) return

    try {
      const res = await fetch(`/api/solicitors/${selectedSol.id}/blocked-dates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked_date: newBlockedDate, notes: newBlockedNotes }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Date blocked successfully')
        setNewBlockedDate('')
        setNewBlockedNotes('')
        fetchSolDetails(selectedSol.id)
      } else {
        toast.error(data.error || 'Failed to block date')
      }
    } catch (err) {
      toast.error('Error blocking date')
    }
  }

  // Delete Blocked Date
  const handleDeleteBlockedDate = async (blockedId: string) => {
    if (!selectedSol) return
    try {
      const res = await fetch(`/api/solicitors/${selectedSol.id}/blocked-dates?id=${blockedId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        toast.success('Blocked date removed')
        fetchSolDetails(selectedSol.id)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to remove blocked date')
      }
    } catch (err) {
      toast.error('Error removing blocked date')
    }
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Sidebar: Solicitors list */}
      <div className="w-80 border-r border-purple-100 bg-white flex flex-col h-full flex-shrink-0">
        <div className="p-6 border-b border-purple-50 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <User className="h-4 w-4 text-purple-600" />
              Solicitors
            </h2>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">Available for verification calls</p>
          </div>
          <button
            onClick={() => {
              setSolForm({ id: '', full_name: '', email: '', is_active: true })
              setShowAddModal(true)
            }}
            className="bg-purple-50 hover:bg-purple-100 text-purple-700 p-2 rounded-xl transition-colors cursor-pointer"
            title="Add Solicitor"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-2 overflow-y-auto flex-1 scrollbar-thin">
          {solicitors.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs">No solicitors registered yet.</p>
            </div>
          ) : (
            solicitors.map(sol => (
              <div
                key={sol.id}
                onClick={() => setSelectedSol(sol)}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left cursor-pointer transition-all duration-200 ${
                  selectedSol?.id === sol.id
                    ? 'bg-purple-50 border-purple-200 text-purple-900 shadow-sm'
                    : 'bg-white border-transparent hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="text-xs font-bold truncate">{sol.full_name}</div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">{sol.email}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`h-1.5 w-1.5 rounded-full ${sol.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSolForm({ id: sol.id, full_name: sol.full_name, email: sol.email, is_active: sol.is_active })
                      setShowEditModal(true)
                    }}
                    className="p-1 rounded hover:bg-purple-100 text-slate-400 hover:text-purple-600 transition-colors"
                  >
                    <Edit className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {selectedSol ? (
        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#f8f7fc] h-full scrollbar-thin">
          {/* Header Card */}
          <div className="bg-white border border-purple-100 rounded-2xl p-6 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-purple-50 flex items-center justify-center border border-purple-100">
                <User className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">{selectedSol.full_name}</h3>
                <p className="text-xs text-slate-500 font-medium">{selectedSol.email} · {selectedSol.is_active ? 'Active' : 'Inactive'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSolForm({ id: selectedSol.id, full_name: selectedSol.full_name, email: selectedSol.email, is_active: selectedSol.is_active })
                  setShowEditModal(true)
                }}
                className="btn-outline text-xs px-4 py-2 hover:bg-slate-50"
              >
                Edit Solicitor Profile
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Weekly Availability Config (2/3 width) */}
            <div className="xl:col-span-2 bg-white rounded-2xl border border-purple-100 shadow-sm p-6 flex flex-col">
              <div className="flex items-center justify-between border-b border-purple-50 pb-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 tracking-tight">Weekly Working Hours</h4>
                    <p className="text-[11px] text-slate-500 font-medium">Configure days and slots available for client bookings</p>
                  </div>
                </div>
                <button
                  onClick={handleSaveAvailability}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="h-4 w-4" /> Save Settings
                </button>
              </div>

              {loadingAvail ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                </div>
              ) : (
                <div className="space-y-4">
                  {DAYS_OF_WEEK.map(day => {
                    const avail = availabilities.find(a => a.day_of_week === day.value)
                    const isActive = !!avail

                    return (
                      <div key={day.value} className={`flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
                        isActive ? 'bg-white border-purple-100' : 'bg-slate-50/50 border-slate-100 opacity-60'
                      }`}>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={() => handleToggleDay(day.value)}
                            id={`day-${day.value}`}
                            className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                          />
                          <label htmlFor={`day-${day.value}`} className="text-xs font-bold text-slate-800 cursor-pointer w-24">
                            {day.label}
                          </label>
                        </div>

                        {isActive && avail && (
                          <div className="flex flex-wrap items-center gap-4 mt-3 md:mt-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Start</span>
                              <input
                                type="time"
                                value={avail.start_time.substring(0, 5)}
                                onChange={(e) => handleUpdateAvailField(day.value, 'start_time', e.target.value + ':00')}
                                className="form-input text-xs py-1 px-2 border-slate-200 rounded-lg w-28"
                              />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">End</span>
                              <input
                                type="time"
                                value={avail.end_time.substring(0, 5)}
                                onChange={(e) => handleUpdateAvailField(day.value, 'end_time', e.target.value + ':00')}
                                className="form-input text-xs py-1 px-2 border-slate-200 rounded-lg w-28"
                              />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Slot</span>
                              <select
                                value={avail.slot_duration}
                                onChange={(e) => handleUpdateAvailField(day.value, 'slot_duration', Number(e.target.value))}
                                className="form-input text-xs py-1 px-2 border-slate-200 rounded-lg w-28"
                              >
                                <option value={15}>15 Minutes</option>
                                <option value={30}>30 Minutes</option>
                                <option value={45}>45 Minutes</option>
                                <option value={60}>60 Minutes</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Blocked Dates Config (1/3 width) */}
            <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-6 flex flex-col">
              <div className="flex items-center gap-3 border-b border-purple-50 pb-4 mb-6">
                <div className="p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 tracking-tight">Blocked Dates</h4>
                  <p className="text-[11px] text-slate-500 font-medium">Block leave or specific holidays</p>
                </div>
              </div>

              {/* Add blocked date form */}
              <form onSubmit={handleAddBlockedDate} className="space-y-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="text-[10px] font-extrabold uppercase text-slate-600">Block New Date</div>
                <input
                  type="date"
                  required
                  value={newBlockedDate}
                  onChange={(e) => setNewBlockedDate(e.target.value)}
                  className="form-input text-xs w-full"
                />
                <input
                  type="text"
                  placeholder="Notes (e.g. Leave, Holiday)..."
                  value={newBlockedNotes}
                  onChange={(e) => setNewBlockedNotes(e.target.value)}
                  className="form-input text-xs w-full"
                />
                <button
                  type="submit"
                  disabled={!newBlockedDate}
                  className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer"
                >
                  Block Date
                </button>
              </form>

              {/* List of blocked dates */}
              <div className="flex-1 overflow-y-auto max-h-[300px] space-y-2 scrollbar-thin">
                {loadingBlocked ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600" />
                  </div>
                ) : blockedDates.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 font-medium">No dates currently blocked.</div>
                ) : (
                  blockedDates.map(b => (
                    <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-white hover:bg-slate-50/40 transition-colors">
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-bold text-slate-800">{new Date(b.blocked_date).toLocaleDateString('en-GB')}</div>
                        {b.notes && <div className="text-[10px] text-slate-500 mt-0.5 truncate">{b.notes}</div>}
                      </div>
                      <button
                        onClick={() => handleDeleteBlockedDate(b.id)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded transition-colors"
                        title="Remove block"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#f8f7fc] text-center p-8">
          <ShieldAlert className="h-16 w-16 text-purple-200 mb-4" />
          <h3 className="text-sm font-bold text-slate-900">No Solicitor Selected</h3>
          <p className="text-xs font-medium text-slate-500 mt-1 max-w-[250px]">Select a solicitor from the sidebar or add a new one to configure the booking system.</p>
        </div>
      )}

      {/* ─── ADD SOLICITOR MODAL ─── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={handleAddSolicitor} className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add New Solicitor</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="form-label text-xs">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  className="form-input text-xs w-full"
                  value={solForm.full_name}
                  onChange={(e) => setSolForm(prev => ({ ...prev, full_name: e.target.value }))}
                />
              </div>

              <div>
                <label className="form-label text-xs">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. john@solicitors.local"
                  className="form-input text-xs w-full"
                  value={solForm.email}
                  onChange={(e) => setSolForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="add-active"
                  checked={solForm.is_active}
                  onChange={(e) => setSolForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="add-active" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Mark as Active immediately
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" onClick={() => setShowAddModal(false)} className="btn-outline text-xs">Cancel</button>
              <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer">Add Solicitor</button>
            </div>
          </form>
        </div>
      )}

      {/* ─── EDIT SOLICITOR MODAL ─── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={handleUpdateSolicitor} className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Edit Solicitor Profile</h3>
              <button type="button" onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="form-label text-xs">Full Name</label>
                <input
                  type="text"
                  required
                  className="form-input text-xs w-full"
                  value={solForm.full_name}
                  onChange={(e) => setSolForm(prev => ({ ...prev, full_name: e.target.value }))}
                />
              </div>

              <div>
                <label className="form-label text-xs">Email Address</label>
                <input
                  type="email"
                  required
                  className="form-input text-xs w-full"
                  value={solForm.email}
                  onChange={(e) => setSolForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="edit-active"
                  checked={solForm.is_active}
                  onChange={(e) => setSolForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="edit-active" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Active (appears in booking selection)
                </label>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleDeleteSolicitor(solForm.id)}
                className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
              
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-outline text-xs">Cancel</button>
                <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer">Save Changes</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
