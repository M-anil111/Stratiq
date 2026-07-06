// Helcim integration via direct REST API calls — no npm package needed.
// Env-gated: only active when HELCIM_API_TOKEN is set.
//
// Auth: Helcim's Payment API v2 authenticates with an `api-token` request header.
// Docs summary:
//  - Payment API processes card payments and exposes transaction objects.
//  - Hosted Payment Pages are hosted checkouts ("Pay Now") — the simplest way
//    to collect payment for an invoice from an email link.
//  - Webhooks POST { id, type } and sign the payload with HMAC-SHA256.

import crypto from 'crypto'

const HELCIM_API_BASE = 'https://api.helcim.com/v2'

export function isHelcimConfigured(): boolean {
  return !!process.env.HELCIM_API_TOKEN
}

export interface CreateHostedPaymentParams {
  amount: number // major units, e.g. dollars
  currency?: string
  invoiceNumber: string
  customerName?: string
  description?: string
}

/**
 * Returns a Hosted Payment Page URL for collecting payment on an invoice.
 *
 * ASSUMPTION: Helcim's Hosted Payment Pages are pre-configured in the Helcim
 * dashboard and exposed via a stable base URL. We do not have a documented
 * public "initialize hosted checkout" endpoint that returns a one-off URL, so
 * we build the payment link from `HELCIM_PAYMENT_PAGE_URL`, appending the
 * invoice number and amount as query params so the hosted page can pre-fill /
 * reconcile the payment. If Helcim later exposes a checkout-init endpoint,
 * swap the body of this function to POST to it and return the returned URL.
 */
export async function createHostedPaymentUrl({
  amount,
  currency = 'USD',
  invoiceNumber,
  customerName,
  description,
}: CreateHostedPaymentParams): Promise<string> {
  if (!isHelcimConfigured()) throw new Error('Helcim is not configured')

  const baseUrl = process.env.HELCIM_PAYMENT_PAGE_URL
  if (!baseUrl) {
    throw new Error('HELCIM_PAYMENT_PAGE_URL is not configured')
  }

  const amountStr = Number.isFinite(amount) ? amount.toFixed(2) : '0.00'
  const url = new URL(baseUrl)
  url.searchParams.set('invoiceNumber', invoiceNumber)
  url.searchParams.set('amount', amountStr)
  url.searchParams.set('currency', currency)
  if (customerName) url.searchParams.set('customerName', customerName)
  if (description) url.searchParams.set('description', description)

  return url.toString()
}

export interface HelcimTransaction {
  transactionId: string
  amount: number
  status: string
  invoiceNumber?: string
  approved: boolean
  raw: any
}

/**
 * Fetches a card transaction by id from the Helcim Payment API.
 * Endpoint: GET /v2/card-transactions/{transactionId}
 */
export async function getCardTransaction(transactionId: string): Promise<HelcimTransaction> {
  const token = process.env.HELCIM_API_TOKEN
  if (!token) throw new Error('Helcim is not configured')

  const res = await fetch(`${HELCIM_API_BASE}/card-transactions/${encodeURIComponent(transactionId)}`, {
    method: 'GET',
    headers: {
      'api-token': token,
      accept: 'application/json',
    },
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.message || `Helcim error (${res.status})`)
  }

  const status = String(data?.status ?? '').toLowerCase()
  return {
    transactionId: String(data?.transactionId ?? transactionId),
    amount: parseFloat(data?.amount ?? '0') || 0,
    status: data?.status ?? '',
    invoiceNumber: data?.invoiceNumber ?? undefined,
    approved: status === 'approved' || status === 'captured' || status === 'paid',
    raw: data,
  }
}

/**
 * Verifies a Helcim webhook signature.
 * signedContent = `${webhook-id}.${webhook-timestamp}.${rawBody}`
 * HMAC-SHA256 keyed with the base64-decoded verifier token, digest base64-encoded.
 * The `webhook-signature` header is `v1,<base64>` and may contain multiple
 * space-delimited signatures; we accept if any matches.
 */
export function verifyHelcimWebhook(
  rawBody: string,
  headers: Headers | Record<string, string | null | undefined>,
): boolean {
  const verifierToken = process.env.HELCIM_WEBHOOK_VERIFIER_TOKEN
  if (!verifierToken) return false

  const get = (name: string): string | null => {
    if (headers instanceof Headers) return headers.get(name)
    return headers[name] ?? headers[name.toLowerCase()] ?? null
  }

  const webhookId = get('webhook-id')
  const webhookTimestamp = get('webhook-timestamp')
  const webhookSignature = get('webhook-signature')
  if (!webhookId || !webhookTimestamp || !webhookSignature) return false

  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`
  const key = Buffer.from(verifierToken, 'base64')
  const expected = crypto.createHmac('sha256', key).update(signedContent).digest('base64')
  const expectedBuf = Buffer.from(expected)

  // Header may contain multiple space-delimited signatures, each `v1,<base64>`.
  const parts = webhookSignature.split(' ').filter(Boolean)
  for (const part of parts) {
    const sig = part.includes(',') ? part.split(',')[1] : part
    if (!sig) continue
    const sigBuf = Buffer.from(sig)
    if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return true
    }
  }
  return false
}
