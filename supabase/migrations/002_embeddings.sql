-- Enable pgvector (built into Supabase, free)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- HNSW index for fast cosine similarity search
-- Build this AFTER running the embed-products script so it indexes real data
CREATE INDEX IF NOT EXISTS idx_products_embedding_hnsw
  ON products USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Similarity search function called from /api/items
CREATE OR REPLACE FUNCTION match_products(
  query_embedding    vector(1536),
  match_count        int     DEFAULT 60,
  filter_min_price   numeric DEFAULT NULL,
  filter_max_price   numeric DEFAULT NULL,
  exclude_ids        uuid[]  DEFAULT '{}'
)
RETURNS TABLE (
  id           uuid,
  brand_id     text,
  brand_name   text,
  external_id  text,
  title        text,
  product_type text,
  tags         text[],
  price        numeric,
  currency     text,
  image_url    text,
  product_url  text,
  scraped_at   timestamptz
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.id,
    p.brand_id,
    p.brand_name,
    p.external_id,
    p.title,
    p.product_type,
    p.tags,
    p.price,
    p.currency,
    p.image_url,
    p.product_url,
    p.scraped_at
  FROM products p
  WHERE
    p.embedding IS NOT NULL
    AND p.image_url IS NOT NULL
    AND (filter_min_price IS NULL OR p.price >= filter_min_price)
    AND (filter_max_price IS NULL OR p.price <= filter_max_price)
    AND NOT (p.id = ANY(exclude_ids))
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
$$;
