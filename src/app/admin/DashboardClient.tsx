'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Clock, ArrowRight, FileText, CheckSquare, AlertCircle, Plus,
  ExternalLink, CreditCard, Ticket, BookOpen, ChevronRight, HelpCircle,
  FolderOpen, Search, Layers, ShieldAlert, ArrowLeftRight, Scissors,
  Home, Key, Trash2, Shield, UserMinus, UserCheck, FilePlus, Sparkles
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

export interface Service {
  id: string
  code: string
  name: string
  base_price: number
  fee_scale: string | null
}

interface Props {
  stats: { totalToday: number; paidToday: number; openTickets: number; helpRequests: number }
  services: Service[]
  currentUserId: string
  userName: string
}

// Map service codes to friendly descriptions and premium icons
const SERVICE_DETAILS: Record<string, { desc: string; category: 'registry' | 'deed'; icon: any }> = {
  TITLE_REGISTER: { desc: "Official HMLR document proving ownership, charge registers, covenants, and easements.", category: 'registry', icon: FileText },
  TITLE_PLAN: { desc: "Illustrates the registered boundaries of the property outlined in red on the map.", category: 'registry', icon: Layers },
  MAP_SEARCH: { desc: "Identify a property boundary or check mapping deeds via registry indexes.", category: 'registry', icon: Search },
  PROPERTY_OWNERSHIP: { desc: "Verification of current legal ownership details registered under the property.", category: 'registry', icon: Shield },
  FR1: { desc: "Register unregistered land or property for the first time with historical deeds.", category: 'deed', icon: FilePlus },
  AP1: { desc: "Register a change of name, marital status, or minor title registration details.", category: 'deed', icon: UserCheck },
  DJP: { desc: "Remove a deceased joint proprietor from the property register of title.", category: 'deed', icon: UserMinus },
  TR1: { desc: "Transfer entire property ownership to another person (add or remove a proprietor).", category: 'deed', icon: ArrowLeftRight },
  TP1: { desc: "Transfer of part of a registered plot/land to a new owner.", category: 'deed', icon: Scissors },
  COG1: { desc: "Update registered owners contact address or notification details.", category: 'deed', icon: Home },
  SEV: { desc: "Sever a joint tenancy into tenants in common to protect equity shares.", category: 'deed', icon: Key },
  RX3: { desc: "Application to cancel or remove a restrictive covenant or restriction from the title.", category: 'deed', icon: Trash2 },
  ADV1: { desc: "Adverse possession claim of registered land (squatter's rights application).", category: 'deed', icon: ShieldAlert },
  AS1: { desc: "Assent of the whole of registered title to beneficiaries by personal representatives.", category: 'deed', icon: BookOpen },
}

export default function DashboardClient({
  stats,
  services,
  userName
}: Props) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'registry' | 'deed'>('all')

  // Filtered services
  const filteredServices = services.filter(service => {
    const details = SERVICE_DETAILS[service.code] || { desc: '', category: 'registry' }
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          service.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          details.desc.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTab = activeTab === 'all' || details.category === activeTab
    return matchesSearch && matchesTab
  })

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#f8f7fc] text-slate-900">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-700 via-violet-700 to-indigo-800 px-8 py-8 shadow-xl">
        <div className="absolute right-0 top-0 -mt-12 -mr-12 h-80 w-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 -mb-12 h-64 w-64 rounded-full bg-purple-300/10 blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-semibold text-white/90">
              <Sparkles className="h-3.5 w-3.5 text-purple-200 animate-pulse" />
              Service Desk Portal
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Welcome back, {userName}
            </h1>
            <p className="text-sm text-purple-100 max-w-xl font-medium leading-relaxed">
              Launch application wizards, view fee scales, and generate new customer orders from our complete catalog of Land Registry & Conveyancing services.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/15 self-start md:self-auto">
            <Clock className="h-4 w-4 text-purple-200" />
            <div className="text-left">
              <div className="text-[10px] text-purple-200 font-bold uppercase tracking-wider">System Status</div>
              <div className="text-xs font-bold text-white">Active Catalog Online</div>
            </div>
          </div>
        </div>
      </div>

      {/* Catalog Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white border border-purple-100 p-4 rounded-xl shadow-sm">
        {/* Tabs */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer",
              activeTab === 'all'
                ? "bg-purple-50 border-purple-200 text-purple-700 shadow-sm"
                : "bg-slate-50 border-transparent text-slate-500 hover:bg-purple-50/50 hover:text-purple-700"
            )}
          >
            All Services
          </button>
          <button
            onClick={() => setActiveTab('registry')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer",
              activeTab === 'registry'
                ? "bg-purple-50 border-purple-200 text-purple-700 shadow-sm"
                : "bg-slate-50 border-transparent text-slate-500 hover:bg-purple-50/50 hover:text-purple-700"
            )}
          >
            Land Registry Docs
          </button>
          <button
            onClick={() => setActiveTab('deed')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer",
              activeTab === 'deed'
                ? "bg-purple-50 border-purple-200 text-purple-700 shadow-sm"
                : "bg-slate-50 border-transparent text-slate-500 hover:bg-purple-50/50 hover:text-purple-700"
            )}
          >
            Deeds & Transfers
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 rounded-xl border border-purple-100 bg-slate-50 px-4 py-2 w-full md:max-w-xs hover:border-purple-200 focus-within:border-purple-400 focus-within:ring-1 focus-within:ring-purple-100 transition-all">
          <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search our services..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 outline-none font-semibold"
          />
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.map(service => {
          const meta = SERVICE_DETAILS[service.code] || { desc: "Land registry application form and filing service.", category: 'registry', icon: FileText }
          const Icon = meta.icon
          const isRegistry = meta.category === 'registry'

          return (
            <div
              key={service.id}
              onClick={() => router.push(`/admin/create-order?form_type_id=${service.id}`)}
              className="bg-white border border-purple-100 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:border-purple-300 transition-all duration-300 flex flex-col justify-between group cursor-pointer active:scale-[0.98]"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className={cn(
                    "p-3 rounded-xl border transition-transform group-hover:scale-105 duration-300",
                    isRegistry 
                      ? "bg-blue-50 border-blue-100 text-blue-600"
                      : "bg-purple-50 border-purple-100 text-purple-600"
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "text-[9px] font-extrabold px-2 py-0.5 rounded uppercase border tracking-wider",
                      isRegistry
                        ? "bg-blue-50 border-blue-200 text-blue-700"
                        : "bg-purple-50 border-purple-200 text-purple-700"
                    )}>
                      {service.code}
                    </span>
                    <div className="text-xs font-black text-slate-900 mt-1.5">
                      {service.base_price > 0 ? formatCurrency(service.base_price) : 'Scale Fee'}
                    </div>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-900 tracking-tight group-hover:text-purple-700 transition-colors">
                  {service.name}
                </h3>
                
                <p className="text-[11px] text-slate-500 font-medium mt-2 leading-relaxed">
                  {meta.desc}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-purple-50 flex items-center justify-between text-xs font-bold text-purple-700">
                <span>Start Application</span>
                <ChevronRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )
        })}

        {filteredServices.length === 0 && (
          <div className="col-span-full py-16 text-center text-xs flex flex-col items-center justify-center gap-2">
            <div className="p-3 rounded-full bg-slate-50 text-slate-400">
              <Search className="h-8 w-8" />
            </div>
            <span className="font-semibold text-slate-600">No Services Found</span>
            <span className="text-[11px] text-slate-500">Try adjusting your search filters.</span>
          </div>
        )}
      </div>
    </div>
  )
}
