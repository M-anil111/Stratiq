// Client-side CSV export helper.

function escapeCell(value: any): string {
  if (value == null) return '""'
  const s = String(value).replace(/"/g, '""')
  return `"${s}"`
}

/**
 * Builds a CSV from an array of objects (keys of the first row become the
 * header) and triggers a browser download.
 */
export function downloadCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map(row => headers.map(h => escapeCell(row[h])).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
