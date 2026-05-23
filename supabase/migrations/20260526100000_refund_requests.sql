-- Customer-initiated refund requests (admin review + Lomi / pawaPay processing).
CREATE TABLE IF NOT EXISTS refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'rejected', 'processing', 'completed', 'failed')),
  product_kind text NOT NULL,
  purchase_row_id uuid,
  entity_id text,
  item_title text NOT NULL,
  payment_ref text,
  payment_provider text CHECK (payment_provider IS NULL OR payment_provider IN ('lomi', 'pawapay')),
  amount_cents integer,
  currency text DEFAULT 'USD',
  reason text NOT NULL,
  admin_notes text,
  provider_refund_id text,
  lomi_transaction_id text,
  provider_status text,
  provider_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refund_requests_user_id_idx ON refund_requests (user_id);
CREATE INDEX IF NOT EXISTS refund_requests_status_idx ON refund_requests (status);
CREATE INDEX IF NOT EXISTS refund_requests_created_at_idx ON refund_requests (created_at DESC);

COMMENT ON TABLE refund_requests IS 'Customer refund requests; admins approve and platform calls Lomi or pawaPay.';
COMMENT ON COLUMN refund_requests.payment_ref IS 'Checkout session id (Lomi) or depositId (pawaPay), legacy column name stripe_session_id on purchases.';
COMMENT ON COLUMN refund_requests.lomi_transaction_id IS 'Lomi transaction UUID required for POST /refunds when payment_ref is a checkout session id.';
