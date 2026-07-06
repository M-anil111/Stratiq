'use client'
import { fetchReportBranding, brandHeaderHtml, brandFooterHtml } from '@/lib/report-branding'

export interface PrintSection {
  heading?: string
  /** Raw inner HTML for the section body. */
  html: string
}

export interface PrintReportOptions {
  title?: string
  clientName?: string
  periodLabel?: string
  sections: PrintSection[]
}

const num = (v: any) => (v == null || v === '' ? '—' : Number(v).toLocaleString())

/** Build a metric table (label/value rows) as an HTML string. */
export function metricTableHtml(rows: Array<[string, string]>): string {
  return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
      <tbody>
        ${rows.map((r, i) => `
          <tr style="${i % 2 ? 'background:#f8fafc' : ''}">
            <td style="padding:9px 12px;color:#64748b;font-size:13px">${r[0]}</td>
            <td style="padding:9px 12px;color:#0f172a;font-weight:600;font-size:13px;text-align:right">${r[1]}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  `
}

export function statGridHtml(stats: Array<{ label: string; value: string }>): string {
  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px">
      ${stats.map(s => `
        <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:22px;font-weight:700;color:#0f172a">${s.value}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">${s.label}</div>
        </div>`).join('')}
    </div>
  `
}

export { num as printNum }

/**
 * Opens a print-optimized, org-branded report in a new window and triggers the
 * browser print dialog (Save as PDF). Falls back to same-window print if popups
 * are blocked. Never throws.
 */
export async function openBrandedPrint(opts: PrintReportOptions): Promise<void> {
  const branding = await fetchReportBranding()
  const header = brandHeaderHtml(branding, {
    title: opts.title,
    clientName: opts.clientName,
    periodLabel: opts.periodLabel,
  })
  const footer = brandFooterHtml(branding, opts.periodLabel)
  const body = opts.sections.map(s => `
    <section class="report-block" style="margin-bottom:26px">
      ${s.heading ? `<h2 style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${branding.brandColor};margin:0 0 12px">${s.heading}</h2>` : ''}
      ${s.html}
    </section>`).join('')

  const doc = `<!doctype html><html><head><meta charset="utf-8" />
    <title>${(opts.title || branding.name).replace(/</g, '')}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Inter, system-ui, -apple-system, sans-serif; background: #fff; color: #0f172a; margin: 0; }
      .report-sheet { max-width: 820px; margin: 0 auto; padding: 40px; }
      .report-block { break-inside: avoid; page-break-inside: avoid; }
      @page { margin: 14mm; }
    </style>
  </head><body>
    <div class="report-sheet">${header}${body}${footer}</div>
    <script>window.onload = function(){ setTimeout(function(){ window.focus(); window.print(); }, 250); };</script>
  </body></html>`

  const w = window.open('', '_blank', 'width=900,height=1200')
  if (!w) {
    // Popup blocked — fall back to an iframe print in the current document.
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)
    const idoc = iframe.contentWindow?.document
    if (idoc) {
      idoc.open(); idoc.write(doc); idoc.close()
      setTimeout(() => { iframe.contentWindow?.focus(); iframe.contentWindow?.print() }, 400)
      setTimeout(() => iframe.remove(), 60000)
    }
    return
  }
  w.document.open()
  w.document.write(doc)
  w.document.close()
}
