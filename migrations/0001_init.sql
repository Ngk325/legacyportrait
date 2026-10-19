CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  stripe_customer_id TEXT,
  marketing_opt_in INTEGER DEFAULT 0,
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS portraits (
  id TEXT PRIMARY KEY,                 -- random, unguessable: the link is the access key for a draft
  customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | previewed | approved | paid | delivered
  answers TEXT NOT NULL DEFAULT '{}',   -- questionnaire + style options (JSON)
  generated TEXT,                       -- last model output (JSON)
  edited TEXT,                          -- what the customer approved/edited (JSON)
  photos TEXT NOT NULL DEFAULT '[]',    -- [{key, name, width, height, bytes}] (JSON)
  regen_count INTEGER NOT NULL DEFAULT 0,
  draft_count INTEGER NOT NULL DEFAULT 0,
  approved_at TEXT,
  utm TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  portrait_id TEXT NOT NULL,
  customer_id TEXT,
  stripe_session_id TEXT,
  product_type TEXT,
  size TEXT,
  amount INTEGER,
  currency TEXT,
  provider TEXT,
  provider_order_id TEXT,
  fulfillment_status TEXT,
  tracking_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
