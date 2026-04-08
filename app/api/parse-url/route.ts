import { NextRequest, NextResponse } from "next/server";

function extractMeta(html: string, property: string): string | null {
  const m =
    html.match(new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"'<>]+)["']`, "i")) ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"'<>]+)["'][^>]+property=["']${property}["']`, "i")) ||
    html.match(new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"'<>]+)["']`, "i")) ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"'<>]+)["'][^>]+name=["']${property}["']`, "i"));
  return m ? m[1].trim() : null;
}

function extractTitle(html: string): string | null {
  const ogTitle = extractMeta(html, "og:title");
  if (ogTitle) return ogTitle;
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}

function extractPrice(html: string): string | null {
  const fromMeta =
    extractMeta(html, "product:price:amount") ||
    extractMeta(html, "og:price:amount") ||
    extractMeta(html, "twitter:data1");
  if (fromMeta) return fromMeta;

  // Try JSON-LD structured data
  const jsonLdMatches = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1]);
      const nodes: unknown[] = Array.isArray(data)
        ? data
        : data["@graph"]
          ? data["@graph"]
          : [data];
      for (const node of nodes) {
        const n = node as Record<string, unknown>;
        const offers = n.offers;
        if (offers) {
          const price = Array.isArray(offers)
            ? (offers[0] as Record<string, unknown>)?.price
            : (offers as Record<string, unknown>)?.price;
          if (price != null) return String(price);
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return null;
}

function extractBrand(html: string, url: string): string | null {
  const siteName = extractMeta(html, "og:site_name");
  if (siteName) return siteName;
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    const name = domain.split(".")[0].replace(/-/g, " ");
    return name
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; facebookexternalhit/1.1; +http://www.facebook.com/externalhit_uatext.php)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "could not fetch that URL" },
        { status: 400 }
      );
    }

    // Only read first 100KB to keep it fast (OG tags are in <head>)
    const reader = response.body?.getReader();
    let html = "";
    if (reader) {
      const decoder = new TextDecoder();
      let bytes = 0;
      while (bytes < 100_000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        bytes += value.byteLength;
      }
      reader.cancel();
    } else {
      html = await response.text();
    }

    return NextResponse.json({
      url,
      title: extractTitle(html),
      image_url: extractMeta(html, "og:image"),
      price: extractPrice(html),
      brand: extractBrand(html, url),
    });
  } catch (err) {
    console.error("parse-url error:", err);
    return NextResponse.json({ error: "failed to parse URL" }, { status: 500 });
  }
}
