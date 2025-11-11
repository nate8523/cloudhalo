'use client'

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'

interface CostSnapshot {
  id: string
  date: string
  cost_usd: number
  service_category: string | null
  resource_name: string | null
  resource_type: string | null
  resource_group: string | null
  location: string | null
  subscription_id: string
}

interface CostTableProps {
  data: CostSnapshot[]
}

export function CostTable({ data }: CostTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [sortField, setSortField] = useState<keyof CostSnapshot>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const itemsPerPage = 50

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]

      if (aVal === null) return 1
      if (bVal === null) return -1

      if (sortDirection === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
      }
    })
  }, [data, sortField, sortDirection])

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return sortedData.slice(startIndex, startIndex + itemsPerPage)
  }, [sortedData, currentPage])

  const totalPages = Math.ceil(data.length / itemsPerPage)

  const handleSort = (field: keyof CostSnapshot) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const SortIcon = ({ field }: { field: keyof CostSnapshot }) => {
    if (sortField !== field) return <span className="text-muted-foreground ml-1">⇅</span>
    return <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No cost records found</p>
        <p className="text-xs mt-1">Try adjusting your filters</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr className="text-left">
              <th
                className="py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('date')}
              >
                Date <SortIcon field="date" />
              </th>
              <th
                className="py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('cost_usd')}
              >
                Cost <SortIcon field="cost_usd" />
              </th>
              <th
                className="py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('service_category')}
              >
                Service <SortIcon field="service_category" />
              </th>
              <th
                className="py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('resource_name')}
              >
                Resource <SortIcon field="resource_name" />
              </th>
              <th
                className="py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('location')}
              >
                Location <SortIcon field="location" />
              </th>
              <th
                className="py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('resource_group')}
              >
                Resource Group <SortIcon field="resource_group" />
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((record, index) => (
              <tr
                key={record.id}
                className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${
                  index % 2 === 0 ? 'bg-muted/10' : ''
                }`}
              >
                <td className="py-3 px-4 font-mono text-xs">
                  {format(parseISO(record.date), 'MMM dd, yyyy')}
                </td>
                <td className="py-3 px-4 font-semibold text-foreground">
                  ${Number(record.cost_usd).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                    {record.service_category || 'N/A'}
                  </span>
                </td>
                <td className="py-3 px-4 max-w-xs truncate" title={record.resource_name || 'N/A'}>
                  {record.resource_name || 'N/A'}
                </td>
                <td className="py-3 px-4 text-muted-foreground">
                  {record.location || 'N/A'}
                </td>
                <td className="py-3 px-4 text-muted-foreground max-w-xs truncate" title={record.resource_group || 'N/A'}>
                  {record.resource_group || 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to{' '}
            {Math.min(currentPage * itemsPerPage, data.length)} of {data.length} records
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded-md border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded-md border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
