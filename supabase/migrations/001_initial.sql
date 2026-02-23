-- Pre-scraped product catalog from all 13 brands
CREATE TABLE IF NOT EXISTS products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      TEXT NOT NULL,
  brand_name    TEXT NOT NULL,
  external_id   TEXT NOT NULL,
  title         TEXT NOT NULL,
  product_type  TEXT,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  price         NUMERIC(10, 2),
  currency      TEXT DEFAULT 'USD',
  image_url     TEXT NOT NULL,
  product_url   TEXT NOT NULL,
  scraped_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(brand_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_tags ON products USING gin(tags);

-- One session = one stylist + one recipient pair
CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stylist_name  TEXT NOT NULL,
  friend_name   TEXT NOT NULL,
  quiz_answers  JSONB NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'building'
                CHECK (status IN ('building', 'sent', 'swiped')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Product data fully cached here so swipe page never queries products table
CREATE TABLE IF NOT EXISTS session_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id),
  title         TEXT NOT NULL,
  brand_name    TEXT NOT NULL,
  price         NUMERIC(10, 2),
  currency      TEXT DEFAULT 'USD',
  image_url     TEXT NOT NULL,
  product_url   TEXT NOT NULL,
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, product_id)
);

CREATE TABLE IF NOT EXISTS swipe_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  decision      TEXT NOT NULL CHECK (decision IN ('yes', 'no')),
  swiped_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_session_items_session_id ON session_items(session_id);
CREATE INDEX IF NOT EXISTS idx_swipe_results_session_id ON swipe_results(session_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
