import type { BrandConfig, ShopifyProduct } from "@/types";

export interface NormalizedProduct {
  brand_id: string;
  brand_name: string;
  external_id: string;
  title: string;
  product_type: string | null;
  tags: string[];
  price: number | null;
  currency: string;
  image_url: string;
  product_url: string;
}

function normalize(product: ShopifyProduct, brand: BrandConfig): NormalizedProduct | null {
  const image = product.images?.[0]?.src;
  if (!image) return null;

  const priceStr = product.variants?.[0]?.price;
  const price = priceStr ? parseFloat(priceStr) : null;

  // Normalize tags: lowercase, trim
  const tags = (product.tags || [])
    .flatMap((t: string) => t.split(","))
    .map((t: string) => t.trim().toLowerCase())
    .filter(Boolean);

  return {
    brand_id: brand.id,
    brand_name: brand.name,
    external_id: String(product.id),
    title: product.title,
    product_type: product.product_type || null,
    tags,
    price,
    currency: brand.currency,
    image_url: image,
    product_url: `https://${brand.domain}/products/${product.handle}`,
  };
}

async function fetchFromEndpoint(url: string): Promise<ShopifyProduct[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; product-catalog-sync/1.0)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) return [];

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return [];

  const data = await res.json();
  return data.products || [];
}

export async function scrapeBrand(brand: BrandConfig): Promise<NormalizedProduct[]> {
  const results: NormalizedProduct[] = [];
  const endpoints = brand.useCollectionEndpoint
    ? [
        `https://${brand.domain}/collections/all/products.json?limit=250`,
        `https://${brand.domain}/products.json?limit=250`,
      ]
    : [
        `https://${brand.domain}/products.json?limit=250`,
        `https://${brand.domain}/collections/all/products.json?limit=250`,
      ];

  let products: ShopifyProduct[] = [];

  for (const endpoint of endpoints) {
    // Try paginated fetch up to 10 pages
    let page = 1;
    let pageProducts: ShopifyProduct[] = [];

    do {
      const url = `${endpoint}&page=${page}`;
      pageProducts = await fetchFromEndpoint(url);
      products.push(...pageProducts);
      page++;
    } while (pageProducts.length === 250 && page <= 10);

    if (products.length > 0) break; // Got results from this endpoint
  }

  for (const product of products) {
    const normalized = normalize(product, brand);
    if (normalized) results.push(normalized);
  }

  return results;
}
