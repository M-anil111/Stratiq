// Stripe integration via direct REST API calls — no stripe npm package needed.
// Env-gated: only active when STRIPE_SECRET_KEY is set.

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

export interface CreatePaymentLinkParams {
  amount: number // in major units, e.g. dollars
  currency?: string
  description: string
  invoiceNumber: string
}

/**
 * Creates a Stripe Checkout Session (mode: payment) for a one-off invoice
 * payment and returns the hosted payment URL.
 */
export async function createPaymentLink({
  amount,
  currency = 'usd',
  description,
  invoiceNumber,
}: CreatePaymentLinkParams): Promise<string> {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) throw new Error('Stripe is not configured')

  const unitAmount = Math.round(amount * 100)
  if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
    throw new Error('Invalid payment amount')
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const body = new URLSearchParams({
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': currency.toLowerCase(),
    'line_items[0][price_data][unit_amount]': String(unitAmount),
    'line_items[0][price_data][product_data][name]': description,
    success_url: `${baseUrl}/pay/success?invoice=${encodeURIComponent(invoiceNumber)}`,
    cancel_url: `${baseUrl}/pay/cancelled?invoice=${encodeURIComponent(invoiceNumber)}`,
    'metadata[invoice_number]': invoiceNumber,
  })

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.message || `Stripe error (${res.status})`)
  }
  if (!data?.url) throw new Error('Stripe did not return a payment URL')
  return data.url as string
}
