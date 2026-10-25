-- WP5 fulfillment: review gate, Gelato payload/ids, tracking, timestamps; Gelato webhook idempotency.
ALTER TABLE orders ADD COLUMN review TEXT;                 -- JSON: { textFits, photoOk, noBlank, by, at, fit }
ALTER TABLE orders ADD COLUMN fulfillment_payload TEXT;    -- the exact Gelato order body (gelato_draft: stored for review, maybe sent as a draft)
ALTER TABLE orders ADD COLUMN tracking_code TEXT;
ALTER TABLE orders ADD COLUMN carrier TEXT;
ALTER TABLE orders ADD COLUMN placed_at TEXT;
ALTER TABLE orders ADD COLUMN shipped_at TEXT;
ALTER TABLE orders ADD COLUMN delivered_at TEXT;
ALTER TABLE orders ADD COLUMN admin_note TEXT;

CREATE TABLE IF NOT EXISTS gelato_events (
  id TEXT PRIMARY KEY,                  -- event id, or a hash of the body when Gelato sends none
  event TEXT,
  order_id TEXT,
  received_at TEXT DEFAULT (datetime('now'))
);
