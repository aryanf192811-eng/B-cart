import { ChevronUp, ChevronDown } from 'lucide-react';

export default function DataTable({ 
  columns, 
  rows, 
  loading, 
  emptyMessage = 'No data available', 
  selectable, 
  onRowClick,
  pagination,
  sort 
}) {
  if (loading) {
    return (
      <div className="w-full">
        <table className="w-full">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={i} style={{ width: c.width }} className={c.align === 'right' ? 'text-right' : ''}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr key={i}>
                <td colSpan={columns.length} className="px-4 py-3">
                  <div className="h-[28px] bg-paper2 rounded w-full animate-pulse"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="w-full">
        <table className="w-full">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={i} style={{ width: c.width }} className={c.align === 'right' ? 'text-right' : ''}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
        </table>
        <div className="py-12 flex flex-col items-center justify-center text-steel2 text-sm">
          {emptyMessage}
        </div>
      </div>
    );
  }

  const handleSort = (field) => {
    if (!sort || !sort.onChange) return;
    const order = sort.field === field && sort.order === 'asc' ? 'desc' : 'asc';
    sort.onChange({ field, order });
  };

  return (
    <div className="w-full flex flex-col">
      <table className="w-full">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th 
                key={i} 
                style={{ width: c.width }} 
                className={`
                  ${c.align === 'right' ? 'text-right' : ''} 
                  ${c.sortable ? 'cursor-pointer hover:bg-paper2 select-none' : ''}
                `}
                onClick={() => c.sortable && handleSort(c.key)}
              >
                <div className={`flex items-center gap-1 ${c.align === 'right' ? 'justify-end' : ''}`}>
                  {c.label}
                  {c.sortable && sort?.field === c.key && (
                    sort.order === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr 
              key={i} 
              onClick={() => onRowClick && onRowClick(row)}
              className={onRowClick ? 'cursor-pointer transition-colors' : ''}
            >
              {columns.map((c, j) => (
                <td key={j} className={c.align === 'right' ? 'text-right' : ''}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {pagination && (
        <div className="flex items-center justify-between px-4 py-3 border-t-[0.5px] border-rule text-steel">
          <div className="font-mono text-[12px]">
            {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </div>
          <div className="flex items-center gap-4 font-mono text-[12px]">
            <button 
              disabled={pagination.page <= 1} 
              onClick={() => pagination.onChange(pagination.page - 1)}
              className="hover:text-ink disabled:opacity-50"
            >
              &lt;
            </button>
            <div className="flex items-center gap-2">
              <span className="text-ink">{pagination.page}</span>
            </div>
            <button 
              disabled={pagination.page * pagination.limit >= pagination.total}
              onClick={() => pagination.onChange(pagination.page + 1)}
              className="hover:text-ink disabled:opacity-50"
            >
              &gt;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
