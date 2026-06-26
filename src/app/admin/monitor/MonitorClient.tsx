'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { 
  Search, ExternalLink, Clock, Zap, Upload, Eye, Trash2, Loader2, FileText, CheckCircle
} from 'lucide-react'
import { toast } from 'sonner'

interface FormType { id: string; name: string; code: string }

interface Props {
  formTypes: FormType[]
}

// Helper to generate deterministic 7-digit IDs from UUID
function getNumericId(uuid: string, salt: number = 0) {
  let hash = 0
  const str = uuid + salt
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash % 9000000) + 1000000
}

// Helper to format date as HH:MM DD/MM/YYYY
function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

// Helper to calculate SLA hours remaining
function calculateWorkingHours(createdAt: string, priority: string) {
  const createdDate = new Date(createdAt)
  const now = new Date()
  
  // SLA SLA hours: Fast Track = 12h, Standard = 24h
  const totalSla = priority === 'fast_track' ? 12 : 24
  const diffMs = now.getTime() - createdDate.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  
  const remaining = totalSla - diffHours
  return remaining > 0 ? remaining.toFixed(2) : '0.00'
}

export default function MonitorClient({ formTypes }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const formTypeIds = formTypes.map(f => f.id)
    if (formTypeIds.length === 0) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('orders')
      .select('*, user:users!orders_user_id_fkey(id, full_name, email), brand:brands(id, name, code)')
      .in('form_type_id', formTypeIds)
      .order('created_at', { ascending: false })
      .limit(300)

    if (error) {
      toast.error('Failed to load monitor orders')
      console.error(error)
    } else {
      setOrders(data || [])
    }
    setLoading(false)
  }, [supabase, formTypes])

  useEffect(() => {
    fetchOrders()

    const channel = supabase.channel('monitor-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchOrders, supabase])

  // File Upload logic
  const handleUpload = async (orderId: string, file: File, currentReqs: any) => {
    setUploadingId(orderId)
    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `${orderId}/${Math.random().toString(36).substring(2)}.${fileExt}`
      
      const { data, error: uploadError } = await supabase.storage
        .from('order-documents')
        .upload(filePath, file)

      if (uploadError) {
        toast.error('Failed to upload file to storage')
        console.error(uploadError)
        setUploadingId(null)
        return
      }

      const newReqs = { ...currentReqs, docs_uploaded: true }
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          document_url: filePath,
          submission_requirements: newReqs,
          status: 'Documents Uploaded'
        })
        .eq('id', orderId)

      if (updateError) {
        toast.error('Failed to update order in database')
        console.error(updateError)
      } else {
        toast.success('File uploaded successfully!')
        fetchOrders()
      }
    } catch (err) {
      console.error(err)
      toast.error('An error occurred during upload')
    } finally {
      setUploadingId(null)
    }
  }

  // Delete file logic
  const handleDeleteProof = async (orderId: string, filePath: string, currentReqs: any) => {
    if (!window.confirm('Are you sure you want to remove this uploaded document?')) return

    try {
      await supabase.storage.from('order-documents').remove([filePath])

      const newReqs = { ...currentReqs, docs_uploaded: false }
      const { error } = await supabase
        .from('orders')
        .update({
          document_url: null,
          submission_requirements: newReqs,
          status: 'Incomplete'
        })
        .eq('id', orderId)

      if (error) {
        toast.error('Failed to delete proof')
        console.error(error)
      } else {
        toast.success('Proof removed!')
        fetchOrders()
      }
    } catch (err) {
      console.error(err)
      toast.error('An error occurred while removing proof')
    }
  }

  // View file logic
  const handleViewProof = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('order-documents')
        .createSignedUrl(filePath, 3600)

      if (error) {
        toast.error('Failed to view file')
        console.error(error)
      } else if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank')
      }
    } catch (err) {
      console.error(err)
      toast.error('An error occurred while opening file')
    }
  }

  // Filter orders
  const filteredOrders = orders.filter(o => {
    const serviceName = formTypes.find(f => f.id === o.form_type_id)?.name || ''
    return (
      (o.first_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.last_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.user?.email || '').toLowerCase().includes(search.toLowerCase()) ||
      serviceName.toLowerCase().includes(search.toLowerCase())
    )
  })

  // Compute stats based on overall loaded orders
  const statUploaded = orders.filter(o => o.document_url || o.submission_requirements?.docs_uploaded).length
  const statOLR = orders.filter(o => o.brand?.code === 'OLR').length
  const statLRT = orders.filter(o => o.brand?.code === 'LRT').length

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-[#f8f7fc]">
      {/* Header */}
      <div className="p-6 bg-white border-b border-purple-100 flex items-center justify-between shadow-sm z-10">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Process Monitor</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Live status, SLA countdown, and file submission tracking.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-xl border border-purple-100 bg-slate-50 px-4 py-2 w-64 focus-within:border-purple-400 focus-within:ring-1 focus-within:ring-purple-100 transition-all">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search monitor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 outline-none font-semibold"
            />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
        <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Uploaded</span>
            <h2 className="text-3xl font-black text-slate-900 mt-1">{statUploaded}</h2>
          </div>
          <div className="h-12 w-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <Upload className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">OLR (Online Land Registry)</span>
            <h2 className="text-3xl font-black text-slate-900 mt-1">{statOLR}</h2>
          </div>
          <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <FileText className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">LRT (Land Registry Transfers)</span>
            <h2 className="text-3xl font-black text-slate-900 mt-1">{statLRT}</h2>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Order ID</th>
                  <th className="py-4 px-6">Item ID</th>
                  <th className="py-4 px-6">Queue</th>
                  <th className="py-4 px-6">Name</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Priority</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6 text-right">Working Hours Remaining</th>
                  <th className="py-4 px-6 text-center">Proofs / Files</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredOrders.map(order => {
                  const serviceName = formTypes.find(f => f.id === order.form_type_id)?.name || 'Unknown Service'
                  const isFastTrack = order.priority === 'fast_track'
                  const isUploaded = order.document_url || order.submission_requirements?.docs_uploaded

                  return (
                    <tr 
                      key={order.id}
                      className={cn(
                        "hover:bg-slate-50/50 transition-colors",
                        isFastTrack && "bg-rose-50/20 hover:bg-rose-50/30"
                      )}
                    >
                      {/* Order ID */}
                      <td className="py-4 px-6">
                        <button 
                          onClick={() => router.push(`/admin/orders/${order.id}`)}
                          className="font-mono text-purple-600 hover:text-purple-800 hover:underline flex items-center gap-1 font-bold"
                        >
                          #{getNumericId(order.id, 123)}
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </td>

                      {/* Item ID */}
                      <td className="py-4 px-6 font-mono text-slate-500">
                        {getNumericId(order.id, 456)}
                      </td>

                      {/* Queue */}
                      <td className="py-4 px-6 font-semibold text-slate-900">
                        {serviceName}
                      </td>

                      {/* Name */}
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900">{order.first_name} {order.last_name}</div>
                        <div className="text-[10px] text-slate-400 font-semibold">{order.email || order.user?.email || '—'}</div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        {isUploaded ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase bg-red-100 text-red-800 border border-red-200">
                            Files Uploaded
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                            {order.status || 'Incomplete'}
                          </span>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="py-4 px-6">
                        {isFastTrack ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                            <Zap className="h-3 w-3 fill-rose-500" /> Fast Track
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                            Standard
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-4 px-6 font-semibold text-slate-600">
                        {formatDate(order.created_at)}
                      </td>

                      {/* Working Hours Remaining */}
                      <td className={cn(
                        "py-4 px-6 text-right font-mono font-bold",
                        Number(calculateWorkingHours(order.created_at, order.priority)) < 5 ? "text-rose-600" : "text-slate-800"
                      )}>
                        {calculateWorkingHours(order.created_at, order.priority)}
                      </td>

                      {/* Proofs / Files */}
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {isUploaded ? (
                            <>
                              <button
                                onClick={() => handleViewProof(order.document_url)}
                                title="View Proof"
                                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-purple-600 transition-colors"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteProof(order.id, order.document_url, order.submission_requirements)}
                                title="Delete Proof"
                                className="p-1.5 rounded-md hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <input 
                                type="file" 
                                ref={el => { fileInputRefs.current[order.id] = el }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) handleUpload(order.id, file, order.submission_requirements)
                                }}
                                className="hidden"
                              />
                              <button
                                onClick={() => fileInputRefs.current[order.id]?.click()}
                                disabled={uploadingId === order.id}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-all cursor-pointer"
                              >
                                {uploadingId === order.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Upload className="h-3 w-3" />
                                )}
                                Upload
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-10 font-bold text-slate-400">
                      No applications found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
