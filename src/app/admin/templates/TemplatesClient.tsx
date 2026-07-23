'use client'

import { useState, useEffect } from 'react'
import { Mail, CheckCircle2, Copy, FileText, Plus, Save, Trash2, Send, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
}

export default function TemplatesClient() {
  const supabase = createClient()
  const router = useRouter()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  
  // Form State
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isNew, setIsNew] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Send Modal State
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendTo, setSendTo] = useState('')
  const [sendSubject, setSendSubject] = useState('')
  const [sendBody, setSendBody] = useState('')
  const [isSending, setIsSending] = useState(false)

  const fetchTemplates = async () => {
    const { data, error } = await supabase.from('email_templates').select('*').order('name')
    if (data) {
      setTemplates(data)
      // Read the query string manually if we want to link directly
      const params = new URLSearchParams(window.location.search)
      const typeId = params.get('id')
      if (typeId && data.find(t => t.id === typeId)) {
        setActiveTemplateId(typeId)
      } else if (data.length > 0 && !activeTemplateId) {
        setActiveTemplateId(data[0].id)
      }
    } else {
      toast.error('Failed to load templates')
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  // Sync form state when active template changes
  useEffect(() => {
    if (isNew) {
      setName('')
      setSubject('')
      setBody('')
    } else if (activeTemplateId) {
      const t = templates.find(t => t.id === activeTemplateId)
      if (t) {
        setName(t.name)
        setSubject(t.subject)
        setBody(t.body)
      }
    }
  }, [activeTemplateId, isNew, templates])

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const handleSave = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      toast.error('Please fill in all fields')
      return
    }
    
    setIsSaving(true)
    if (isNew) {
      const { data, error } = await supabase.from('email_templates').insert({
        name, subject, body
      }).select().single()
      
      if (error) {
        toast.error('Failed to create template')
      } else if (data) {
        toast.success('Template created')
        setIsNew(false)
        setActiveTemplateId(data.id)
        fetchTemplates()
      }
    } else {
      const { error } = await supabase.from('email_templates').update({
        name, subject, body
      }).eq('id', activeTemplateId)

      if (error) {
        toast.error('Failed to save changes')
      } else {
        toast.success('Changes saved')
        fetchTemplates()
      }
    }
    setIsSaving(false)
  }

  const handleDelete = async () => {
    if (!activeTemplateId || isNew) return
    if (!confirm('Are you sure you want to delete this template?')) return
    
    const { error } = await supabase.from('email_templates').delete().eq('id', activeTemplateId)
    if (error) {
      toast.error('Failed to delete template')
    } else {
      toast.success('Template deleted')
      setActiveTemplateId(null)
      fetchTemplates()
    }
  }

  const startNewTemplate = () => {
    setActiveTemplateId(null)
    setIsNew(true)
    setName('')
    setSubject('')
    setBody('')
  }

  const selectTemplate = (id: string) => {
    setIsNew(false)
    setActiveTemplateId(id)
  }

  const openSendModal = () => {
    setSendTo('')
    setSendSubject(subject)
    setSendBody(body)
    setShowSendModal(true)
  }

  const handleSendEmail = async () => {
    if (!sendTo.trim()) {
      toast.error('Please enter a recipient email address')
      return
    }
    if (!sendSubject.trim()) {
      toast.error('Please enter a subject')
      return
    }
    if (!sendBody.trim()) {
      toast.error('Please enter a message body')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(sendTo.trim())) {
      toast.error('Please enter a valid email address')
      return
    }

    setIsSending(true)
    try {
      const res = await fetch('/api/email/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: sendTo.trim(),
          subject: sendSubject.trim(),
          body: sendBody.trim(),
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        toast.error(result.error || 'Failed to send email')
      } else {
        toast.success(`Email sent successfully to ${sendTo}`)
        setShowSendModal(false)
        setSendTo('')
        setSendSubject('')
        setSendBody('')
      }
    } catch (err) {
      toast.error('Network error — failed to send email')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <>
      <div className="flex-1 overflow-hidden flex bg-[#f8f7fc]">
        {/* Sidebar List */}
        <div className="w-80 border-r border-purple-100 bg-white flex flex-col">
          <div className="p-6 pb-4 border-b border-purple-50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Mail className="h-4 w-4 text-purple-600" />
                Email Templates
              </h2>
              <p className="text-[11px] font-medium text-slate-500 mt-1">Manage standard communications.</p>
            </div>
            <button 
              onClick={startNewTemplate}
              className="bg-purple-50 hover:bg-purple-100 text-purple-700 p-2 rounded-xl transition-colors"
              title="Create New Template"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4 space-y-2 overflow-y-auto flex-1">
            {isNew && (
              <button
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left bg-purple-50 border border-purple-200 text-purple-900 shadow-sm"
              >
                <FileText className="h-4 w-4 flex-shrink-0 text-purple-600" />
                <span className="text-xs font-bold tracking-tight italic">New Template...</span>
              </button>
            )}
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => selectTemplate(t.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all",
                  (activeTemplateId === t.id && !isNew)
                    ? "bg-purple-50 border border-purple-200 text-purple-900 shadow-sm"
                    : "bg-white border border-transparent hover:bg-slate-50 text-slate-600 hover:text-slate-900"
                )}
              >
                <FileText className={cn("h-4 w-4 flex-shrink-0", (activeTemplateId === t.id && !isNew) ? "text-purple-600" : "text-slate-400")} />
                <span className="text-xs font-bold tracking-tight truncate">{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8 overflow-y-auto">
          {(activeTemplateId || isNew) ? (
            <div className="max-w-3xl bg-white rounded-2xl border border-purple-100 shadow-sm p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="flex-1 mr-4">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Template Name (e.g. Purchase Confirmation)"
                    className="w-full text-2xl font-black text-slate-900 tracking-tight mb-2 outline-none border-b border-transparent hover:border-slate-200 focus:border-purple-400 transition-colors bg-transparent px-1"
                  />
                  <p className="text-xs font-medium text-slate-500 px-1">This internal name is displayed in the sidebar.</p>
                </div>
                <div className="flex gap-2">
                  {!isNew && (
                    <button 
                      onClick={openSendModal}
                      className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
                    >
                      <Send className="h-4 w-4" /> Send Email
                    </button>
                  )}
                  {!isNew && (
                    <button 
                      onClick={handleDelete}
                      className="flex items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  )}
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm shadow-purple-600/20"
                  >
                    <Save className="h-4 w-4" /> {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Subject Line</label>
                    <button onClick={() => handleCopy(subject)} className="text-[10px] font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded transition-colors">
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </div>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject line for the email..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-semibold text-slate-800 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Email Body</label>
                    <button onClick={() => handleCopy(body)} className="text-[10px] font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded transition-colors">
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </div>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Type the email body here..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium text-slate-800 leading-relaxed min-h-[300px] outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all resize-y"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <Mail className="h-12 w-12 text-slate-200 mb-4" />
              <h3 className="text-sm font-bold text-slate-900">No Template Selected</h3>
              <p className="text-xs font-medium text-slate-500 mt-1 max-w-[250px]">Select a template from the left or create a new one to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* Send Email Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isSending && setShowSendModal(false)} />
          
          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-xl">
                  <Send className="h-5 w-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Send Email</h3>
                  <p className="text-[11px] font-medium text-slate-500">Using template: {name}</p>
                </div>
              </div>
              <button 
                onClick={() => !isSending && setShowSendModal(false)} 
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Recipient */}
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2 block px-1">
                  Recipient Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
                  autoFocus
                />
              </div>

              {/* Subject */}
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2 block px-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={sendSubject}
                  onChange={(e) => setSendSubject(e.target.value)}
                  placeholder="Email subject..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
                />
              </div>

              {/* Body */}
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2 block px-1">
                  Message Body
                </label>
                <textarea
                  value={sendBody}
                  onChange={(e) => setSendBody(e.target.value)}
                  placeholder="Email content..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm font-medium text-slate-800 leading-relaxed min-h-[200px] outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all resize-y"
                />
              </div>

              {/* Live Professional Email Preview */}
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2 block px-1 flex items-center justify-between">
                  <span>Professional Email Preview (What Customer Receives)</span>
                  <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Auto-Formatted</span>
                </label>
                <div className="bg-slate-100 rounded-xl p-4 border border-slate-200 shadow-inner">
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                    {/* Header */}
                    <div className="bg-[#0b1b3a] p-4 text-white">
                      <div className="font-bold text-base">Online Land Registry</div>
                      <div className="text-[10px] text-slate-300">Official Land Registry Documentation Services</div>
                    </div>
                    {/* Body */}
                    <div className="p-5 space-y-3 text-xs text-slate-700">
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {sendBody || <span className="italic text-slate-400">Type email content...</span>}
                      </div>

                      {/* Queries Banner */}
                      <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-[11px]">
                        <strong>Need Help or Have Queries?</strong><br/>
                        If you have any questions regarding this email or your application, please feel free to reply directly to this email or call our support line at <strong>0333 577 0077</strong>.
                      </div>

                      {/* Sign off */}
                      <div className="mt-4 pt-3 border-t border-slate-100 text-slate-600 text-[11px]">
                        <div>Kind regards,</div>
                        <div className="font-bold text-slate-900">Customer Support Team</div>
                        <div className="text-slate-500 text-[10px]">Online Land Registry</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2.5">
                <Mail className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] font-medium text-amber-800 leading-relaxed">
                  You can edit the subject and body before sending. The original template will not be modified.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => !isSending && setShowSendModal(false)}
                disabled={isSending}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={isSending}
                className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm shadow-emerald-600/20 disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
