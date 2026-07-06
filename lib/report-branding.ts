// Shared report branding: organization logo + wordmark header/footer markup and
// the print stylesheet used by the print-to-PDF report views. Kept framework
// agnostic (returns HTML strings + plain data) so it can be used from print
// pages, the client "Download PDF" action, and future server-rendered exports.

export const WORDMARK_FALLBACK = 'Mindshare Consulting'

export interface ReportBranding {
  name: string
  logoUrl: string | null
  brandColor: string
}

const DEFAULT_BRAND_COLOR = '#0ea5e9'

/**
 * Fetch the organization's branding (logo + name + brand color) from the
 * company settings endpoint, with a "Mindshare Consulting" wordmark fallback.
 * Never throws — always resolves to a usable branding object.
 */
export async function fetchReportBranding(): Promise<ReportBranding> {
  try {
    const res = await fetch('/api/settings/company')
    if (!res.ok) return brandingFallback()
    const data = await res.json().catch(() => ({}))
    return {
      name: (data?.name && String(data.name).trim()) || WORDMARK_FALLBACK,
      logoUrl: data?.logo_url || null,
      brandColor: (data?.brand_color && String(data.brand_color).trim()) || DEFAULT_BRAND_COLOR,
    }
  } catch {
    return brandingFallback()
  }
}

export function brandingFallback(): ReportBranding {
  return { name: WORDMARK_FALLBACK, logoUrl: null, brandColor: DEFAULT_BRAND_COLOR }
}

/**
 * Print stylesheet shared across report print views. Hides app chrome
 * (sidebar / nav), forces a white sheet, and keeps sections from breaking
 * awkwardly across pages. Returns a raw CSS string to inline in a <style> tag.
 */
export function reportPrintCss(): string {
  return `
    @media print {
      aside, nav, header, [class*="glass-sidebar"], .print-hide, .no-print { display: none !important; }
      body, html { background: #fff !important; }
      .bg-mesh { background: #fff !important; }
      .lg\\:ml-20 { margin-left: 0 !important; }
      .report-print-root { padding: 0 !important; }
      .report-sheet { box-shadow: none !important; border: none !important; margin: 0 !important; max-width: none !important; }
      .report-print-only { display: block !important; }
      .report-block { break-inside: avoid; page-break-inside: avoid; }
      @page { margin: 14mm; }
    }
    .report-print-only { display: none; }
  `
}

/**
 * Branded header markup (HTML string). Logo on the left with a wordmark
 * fallback; optional client + period on the right.
 */
export function brandHeaderHtml(
  branding: ReportBranding,
  opts: { title?: string; clientName?: string; periodLabel?: string } = {},
): string {
  const { name, logoUrl, brandColor } = branding
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(name)}" style="height:48px;width:auto;object-fit:contain" />`
    : `<span style="font-size:20px;font-weight:800;letter-spacing:-0.01em;color:${brandColor}">${escapeHtml(name)}</span>`
  return `
    <div class="report-block" style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:20px;margin-bottom:28px;border-bottom:3px solid ${brandColor}">
      <div style="display:flex;align-items:center;gap:14px">
        ${logo}
        <div>
          <div style="font-size:18px;font-weight:700;color:#0f172a">${escapeHtml(opts.title || name)}</div>
          <div style="font-size:13px;color:#64748b">${escapeHtml(opts.title ? name : 'Report')}</div>
        </div>
      </div>
      <div style="text-align:right">
        ${opts.clientName ? `<div style="font-size:15px;font-weight:600;color:#0f172a">${escapeHtml(opts.clientName)}</div>` : ''}
        ${opts.periodLabel ? `<div style="font-size:13px;color:#64748b;margin-top:2px">${escapeHtml(opts.periodLabel)}</div>` : ''}
      </div>
    </div>
  `
}

/** Branded footer markup (HTML string). */
export function brandFooterHtml(branding: ReportBranding, periodLabel?: string): string {
  return `
    <p class="report-block" style="font-size:12px;color:#94a3b8;margin-top:36px;text-align:center">
      Prepared by ${escapeHtml(branding.name)}${periodLabel ? ` · ${escapeHtml(periodLabel)}` : ''}
    </p>
  `
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
