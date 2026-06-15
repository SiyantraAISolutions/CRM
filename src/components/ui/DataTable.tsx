'use client'

import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: keyof T | string
  label: string
  sortable?: boolean
  width?: string
  render?: (value: unknown, row: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  searchable?: boolean
  pageSize?: number
  totalCount?: number // for server-side
  page?: number
  onPageChange?: (page: number) => void
  onSearch?: (search: string) => void
  onSort?: (key: string, dir: 'asc' | 'desc') => void
  loading?: boolean
  emptyMessage?: string
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  searchable = true,
  pageSize = 10,
  totalCount,
  page = 1,
  onPageChange,
  onSearch,
  onSort,
  loading,
  emptyMessage = 'No records found',
}: DataTableProps<T>) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [localPage, setLocalPage] = useState(1)
  const [localPageSize, setLocalPageSize] = useState(pageSize)

  const isServerSide = !!onPageChange

  // Client-side filtering
  const filtered = useMemo(() => {
    if (isServerSide || !search) return data
    const q = search.toLowerCase()
    return data.filter((row) =>
      Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q))
    )
  }, [data, search, isServerSide])

  // Client-side sort
  const sorted = useMemo(() => {
    if (isServerSide || !sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir, isServerSide])

  // Client-side pagination
  const currentPage = isServerSide ? page : localPage
  const total = isServerSide ? (totalCount ?? data.length) : sorted.length
  const paginated = isServerSide ? sorted : sorted.slice((localPage - 1) * localPageSize, localPage * localPageSize)
  const totalPages = Math.ceil(total / (isServerSide ? pageSize : localPageSize))

  function handleSort(key: string) {
    if (sortKey === key) {
      const newDir = sortDir === 'asc' ? 'desc' : 'asc'
      setSortDir(newDir)
      onSort?.(key, newDir)
    } else {
      setSortKey(key)
      setSortDir('asc')
      onSort?.(key, 'asc')
    }
  }

  function handleSearch(val: string) {
    setSearch(val)
    onSearch?.(val)
    if (!isServerSide) setLocalPage(1)
  }

  const from = (currentPage - 1) * (isServerSide ? pageSize : localPageSize) + 1
  const to = Math.min(currentPage * (isServerSide ? pageSize : localPageSize), total)

  return (
    <div className="flex flex-col h-full">
      {/* Controls row */}
      <div className="flex items-center justify-between gap-4 px-5 py-3 border-b bg-surface-gray-1">
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-gray-5">Show</span>
          <select
            className="form-input w-16 py-1 text-xs"
            value={isServerSide ? pageSize : localPageSize}
            onChange={(e) => {
              const val = Number(e.target.value)
              if (!isServerSide) { setLocalPageSize(val); setLocalPage(1) }
            }}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span className="text-sm text-ink-gray-5">entries</span>
        </div>
        {searchable && (
          <div className="relative w-60">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-gray-4" />
            <input
              type="text"
              placeholder="Search..."
              className="form-input pl-8 py-1 text-sm"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-ink-gray-4 text-sm">
            Loading...
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(col.sortable && 'cursor-pointer select-none hover:bg-surface-gray-2')}
                    onClick={() => col.sortable && handleSort(String(col.key))}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && (
                        <span className="text-ink-gray-4">
                          {sortKey === col.key ? (
                            sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-10 text-ink-gray-4">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                paginated.map((row, i) => (
                  <tr
                    key={i}
                    onClick={() => onRowClick?.(row)}
                    className={cn(onRowClick && 'cursor-pointer')}
                  >
                    {columns.map((col) => (
                      <td key={String(col.key)}>
                        {col.render
                          ? col.render(row[String(col.key)], row)
                          : String(row[String(col.key)] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination footer */}
      <div className="flex items-center justify-between border-t px-5 py-3 text-sm text-ink-gray-5">
        <span>
          {total === 0
            ? 'No entries'
            : `Showing ${from} to ${to} of ${total} entries${
                search && !isServerSide ? ` (filtered from ${data.length} total entries)` : ''
              }`}
        </span>
        <div className="flex items-center gap-1">
          <button
            className="btn-ghost p-1 disabled:opacity-40"
            disabled={currentPage <= 1}
            onClick={() => isServerSide ? onPageChange?.(currentPage - 1) : setLocalPage(p => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const pg = i + 1
            return (
              <button
                key={pg}
                onClick={() => isServerSide ? onPageChange?.(pg) : setLocalPage(pg)}
                className={cn(
                  'h-7 w-7 rounded text-xs font-medium transition-colors',
                  currentPage === pg
                    ? 'bg-navy text-white'
                    : 'hover:bg-surface-gray-2 text-ink-gray-7'
                )}
              >
                {pg}
              </button>
            )
          })}
          <button
            className="btn-ghost p-1 disabled:opacity-40"
            disabled={currentPage >= totalPages}
            onClick={() => isServerSide ? onPageChange?.(currentPage + 1) : setLocalPage(p => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
