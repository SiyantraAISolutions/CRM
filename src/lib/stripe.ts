import Stripe from 'stripe'

/**
 * Stripe server-side singleton.
 * Only import this in server components / API routes (not client components).
 */
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
    _stripe = new Stripe(key, { apiVersion: '2024-06-20' })
  }
  return _stripe
}

/** Create a Stripe Checkout Session (Payment Link) for an order */
export async function createPaymentLink(opts: {
  orderId: string
  businessId?: string
  amount: number          // in GBP (e.g. 29.99)
  customerEmail?: string
  description: string
  successUrl: string
  cancelUrl: string
}) {
  const stripe = getStripe()

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: opts.customerEmail || undefined,
    line_items: [
      {
        price_data: {
          currency: 'gbp',
          unit_amount: Math.round(opts.amount * 100), // pence
          product_data: { name: opts.description },
        },
        quantity: 1,
      },
    ],
    metadata: {
      order_id: opts.orderId,
      business_id: opts.businessId ?? '',
    },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  })

  return session
}

/** Create a PaymentIntent for server-side charging (phone/call payments) */
export async function createCharge(opts: {
  orderId: string
  businessId?: string
  amount: number          // in GBP
  paymentMethodId: string
  customerEmail?: string
  description: string
}) {
  const stripe = getStripe()

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(opts.amount * 100), // pence
    currency: 'gbp',
    payment_method: opts.paymentMethodId,
    confirm: true,
    description: opts.description,
    receipt_email: opts.customerEmail || undefined,
    metadata: {
      order_id: opts.orderId,
      business_id: opts.businessId ?? '',
    },
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: 'never',
    },
  })

  return paymentIntent
}

/** Issue a full or partial refund */
export async function createRefund(opts: {
  paymentIntentId: string
  amount?: number         // optional, in GBP — omit for full refund
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
}) {
  const stripe = getStripe()

  const refund = await stripe.refunds.create({
    payment_intent: opts.paymentIntentId,
    amount: opts.amount ? Math.round(opts.amount * 100) : undefined,
    reason: opts.reason ?? 'requested_by_customer',
  })

  return refund
}

/** Retrieve a PaymentIntent by ID */
export async function retrievePaymentIntent(paymentIntentId: string) {
  const stripe = getStripe()
  return stripe.paymentIntents.retrieve(paymentIntentId)
}

/** Create a SetupIntent for Stripe Elements client-side tokenization */
export async function createPaymentIntent(opts: {
  amount: number          // in GBP
  orderId: string
  businessId?: string
  customerEmail?: string
  description: string
}) {
  const stripe = getStripe()

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(opts.amount * 100),
    currency: 'gbp',
    description: opts.description,
    receipt_email: opts.customerEmail || undefined,
    metadata: {
      order_id: opts.orderId,
      business_id: opts.businessId ?? '',
    },
    automatic_payment_methods: { enabled: true },
  })

  return paymentIntent
}
