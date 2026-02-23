export interface QuizAnswers {
  vibe?: string[];
  fit?: string[];
  colors?: string[];
  occasion?: string[];
  budget?: string[];
  avoid?: string[];
}

export interface BrandConfig {
  id: string;
  name: string;
  domain: string;
  currency: string;
  useCollectionEndpoint?: boolean;
}

export interface Product {
  id: string;           // UUID from Supabase products table
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
  scraped_at: string;
}

export interface Session {
  id: string;
  stylist_name: string;
  friend_name: string;
  quiz_answers: QuizAnswers;
  status: "building" | "sent" | "swiped";
  created_at: string;
  updated_at: string;
}

export interface SessionItem {
  id: string;
  session_id: string;
  product_id: string | null;
  title: string;
  brand_name: string;
  price: number | null;
  currency: string;
  image_url: string;
  product_url: string;
  position: number;
  created_at: string;
}

export interface SwipeResult {
  id: string;
  session_id: string;
  item_id: string;
  decision: "yes" | "no";
  swiped_at: string;
}

// Raw product shape from Shopify /products.json
export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  tags: string[];
  images: Array<{ src: string }>;
  variants: Array<{ price: string }>;
}
