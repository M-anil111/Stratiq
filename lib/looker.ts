// lib/looker.ts
// Helpers for integrating Looker Studio (formerly Google Data Studio).
//
// IMPORTANT CONSTRAINTS: Looker Studio has NO API to build charts/reports
// programmatically. The two supported integration mechanisms are:
//
//   (a) Linking API — a specially-formatted URL that opens Looker Studio and
//       creates a NEW report from a template, pre-seeding data-source params.
//       Docs: https://developers.google.com/looker-studio/integrate/linking-api
//
//   (b) Embedding — a published or link-shared report can be embedded in an
//       iframe using its /embed/ URL form.

const LOOKER_HOST = 'lookerstudio.google.com'

export interface LinkingParams {
  /** The template report id to copy (Linking API `c.reportId`). */
  reportId?: string | null
  /** Display name for the newly created report (`r.reportName`). */
  reportName: string
  /** Optional GA4 property id to seed as a data source. */
  ga4PropertyId?: string | null
}

/**
 * Build a Looker Studio Linking API URL.
 *
 * The Linking API URL takes the form:
 *   https://lookerstudio.google.com/reporting/create
 *     ?c.reportId=<TEMPLATE_REPORT_ID>       // config: template to copy
 *     &r.reportName=<encoded report name>    // report-level: new report name
 *     &ds.<alias>.connector=<connectorId>    // data-source: connector type
 *     &ds.<alias>.propertyId=<propertyId>    // data-source: connector config
 *
 * The `ds.<alias>` prefix maps a data source in the template (aliased `ds0`
 * here) to a concrete connector + config. For GA4 we use the built-in
 * `googleAnalytics` connector with a `propertyId`.
 *
 * Returns null when no template reportId is configured (nothing to copy).
 */
export function buildLinkingUrl({ reportId, reportName, ga4PropertyId }: LinkingParams): string | null {
  if (!reportId) return null

  let url =
    `https://${LOOKER_HOST}/reporting/create` +
    `?c.reportId=${encodeURIComponent(reportId)}` +
    `&r.reportName=${encodeURIComponent(reportName)}`

  if (ga4PropertyId) {
    // Seed the first data source (alias ds0) with the client's GA4 property.
    url += `&ds.ds0.connector=googleAnalytics&ds.ds0.propertyId=${encodeURIComponent(ga4PropertyId)}`
  }

  return url
}

/**
 * Convert a normal Looker Studio report URL into its embeddable form.
 *
 * Handles:
 *   - .../reporting/<REPORT_ID>/page/<PAGE_ID>  -> .../embed/reporting/<REPORT_ID>/page/<PAGE_ID>
 *   - .../reporting/<REPORT_ID>                 -> .../embed/reporting/<REPORT_ID>
 *   - already-/embed/ URLs                      -> returned as-is
 *   - short /s/ share links                     -> returned as-is (best effort)
 *
 * Validates the host is lookerstudio.google.com so we never embed an
 * arbitrary third-party site. If the URL can't be parsed or isn't a Looker
 * Studio URL, the original string is returned unchanged.
 */
export function toEmbedUrl(reportUrl: string | null | undefined): string | null {
  if (!reportUrl) return null
  let parsed: URL
  try {
    parsed = new URL(reportUrl)
  } catch {
    return reportUrl
  }

  // Only rewrite genuine Looker Studio URLs; otherwise hand back the original.
  if (parsed.hostname !== LOOKER_HOST) return reportUrl

  // Already an embed URL — return as-is.
  if (parsed.pathname.startsWith('/embed/')) return reportUrl

  // Rewrite /reporting/... paths to /embed/reporting/...
  if (parsed.pathname.startsWith('/reporting/')) {
    return `https://${LOOKER_HOST}/embed${parsed.pathname}${parsed.search}`
  }

  // Short share links (/s/...) or other forms: best-effort, return original.
  return reportUrl
}

/** True when the URL is a valid lookerstudio.google.com URL (or empty). */
export function isLookerUrl(value: string | null | undefined): boolean {
  if (!value) return true // empty is allowed (clears the field)
  try {
    return new URL(value).hostname === LOOKER_HOST
  } catch {
    return false
  }
}
