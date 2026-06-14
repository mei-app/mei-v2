import { useState, useRef, useCallback, memo, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import type { List } from "@/lib/types";

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");

// Injected into the WebView to extract metadata from the already-loaded page.
// Bypasses Cloudflare/bot protection since the page is rendered in a real browser engine.
const EXTRACT_METADATA_JS = String.raw`
(function() {
  try {
    function meta(prop) {
      var el = document.querySelector('meta[property="' + prop + '"]') ||
               document.querySelector('meta[name="' + prop + '"]');
      return el ? el.getAttribute('content') : null;
    }

    // Parse srcset="url1 400w, url2 1200w" -> highest-res URL
    function parseSrcset(srcset) {
      if (!srcset) return null;
      var best = null, bestW = 0;
      var parts = srcset.split(',');
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i].trim().split(/\s+/);
        var url = part[0]; if (!url) continue;
        var w = 0;
        if (part[1]) {
          if (part[1].indexOf('w') !== -1) w = parseInt(part[1]) || 0;
          else if (part[1].indexOf('x') !== -1) w = (parseFloat(part[1]) || 1) * 1000;
        }
        if (!best || w > bestW) { best = url; bestW = w; }
      }
      return best;
    }

    // Make a URL absolute
    function toAbs(src) {
      if (!src) return null;
      if (src.indexOf('http') === 0) return src;
      if (src.indexOf('//') === 0) return 'https:' + src;
      if (src.indexOf('/') === 0) return window.location.origin + src;
      return window.location.href.replace(/\/[^\/]*$/, '/') + src;
    }

    var title = meta('og:title') || document.title || null;
    var image = meta('og:image') || meta('og:image:url') || meta('twitter:image') || meta('twitter:image:src') || null;
    var brand = meta('og:site_name') || null;
    var price = meta('product:price:amount') || meta('og:price:amount') || null;

    // JSON-LD structured data for image + price
    if (!image || !price) {
      var scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (var i = 0; i < scripts.length; i++) {
        try {
          var data = JSON.parse(scripts[i].textContent);
          var nodes = Array.isArray(data) ? data : (data['@graph'] ? data['@graph'] : [data]);
          for (var j = 0; j < nodes.length; j++) {
            var node = nodes[j];
            if (!image && node.image) {
              var ldImg = Array.isArray(node.image) ? node.image[0] : node.image;
              if (typeof ldImg === 'string') image = ldImg;
              else if (ldImg && ldImg.url) image = ldImg.url;
            }
            if (!price && node.offers) {
              var offers = node.offers;
              var p = Array.isArray(offers) ? (offers[0] && offers[0].price) : offers.price;
              if (p != null) price = String(p);
            }
          }
        } catch(e) {}
        if (image && price) break;
      }
    }

    // Common price DOM selectors as last resort
    if (!price) {
      var sel = '[itemprop="price"],[data-price],[class*="product-price"],[class*="ProductPrice"],[class*="price__current"],[class*="price-item--regular"]';
      var priceEl = document.querySelector(sel);
      if (priceEl) {
        price = (priceEl.getAttribute('content') || priceEl.getAttribute('data-price') || priceEl.innerText || '').replace(/[^0-9.]/g, '') || null;
      }
    }

    // Strategy 1: Viewport-center detection — find what the user is actually looking at.
    // Samples 5 points in the upper portion of the screen and walks up the DOM to find
    // an <img> (with srcset/lazy-src support) or a background-image element.
    if (!image) {
      function getImgFromEl(el) {
        if (!el) return null;
        if (el.tagName === 'IMG') {
          var s = parseSrcset(el.getAttribute('srcset')) ||
                  el.getAttribute('data-zoom-image') || el.getAttribute('data-large_image') ||
                  el.getAttribute('data-src') || el.getAttribute('data-lazy-src') ||
                  el.getAttribute('data-original') || el.src || '';
          if (s && s.indexOf('data:') !== 0 && s.indexOf('svg') === -1 && s.length > 5) return s;
        }
        var bg = (el.style && el.style.backgroundImage) || '';
        if (!bg) { try { bg = window.getComputedStyle(el).backgroundImage || ''; } catch(e) {} }
        var bgM = bg.match(/url\(['"]?([^'")\s]+)['"]?\)/);
        if (bgM && bgM[1] && bgM[1].indexOf('data:') !== 0) return bgM[1];
        return null;
      }
      var pts = [[0.5,0.25],[0.5,0.4],[0.3,0.3],[0.7,0.3],[0.5,0.15]];
      for (var p = 0; p < pts.length && !image; p++) {
        var vpEl = document.elementFromPoint(window.innerWidth*pts[p][0], window.innerHeight*pts[p][1]);
        for (var d = 0; d < 6 && vpEl && !image; d++) {
          var found = getImgFromEl(vpEl);
          if (found) image = toAbs(found);
          vpEl = vpEl.parentElement;
        }
      }
    }

    // Strategy 2: <picture><source srcset> elements — common on Shopify/fashion sites
    if (!image) {
      var sources = document.querySelectorAll('picture source[srcset]');
      for (var si = 0; si < sources.length && !image; si++) {
        var parsed = parseSrcset(sources[si].getAttribute('srcset'));
        if (parsed) image = toAbs(parsed);
      }
    }

    // Strategy 3: Largest visible image — score by area with lazy-load attr support
    if (!image) {
      var imgs = document.querySelectorAll('img');
      var bestSrc = null, bestScore = 0;
      for (var k = 0; k < imgs.length; k++) {
        var imgEl = imgs[k];
        var src = parseSrcset(imgEl.getAttribute('srcset')) ||
                  imgEl.getAttribute('data-zoom-image') ||
                  imgEl.getAttribute('data-large_image') ||
                  imgEl.getAttribute('data-full') ||
                  imgEl.getAttribute('data-src') ||
                  imgEl.getAttribute('data-lazy-src') ||
                  imgEl.getAttribute('data-original') ||
                  imgEl.getAttribute('data-bg') ||
                  imgEl.getAttribute('src') || '';
        if (!src || src.indexOf('data:') === 0 || src.indexOf('svg') !== -1 || src.length < 5) continue;
        var absUrl = toAbs(src);
        // Use naturalWidth if loaded, otherwise fall back to layout/offset size
        var w = imgEl.naturalWidth || imgEl.offsetWidth || imgEl.width || 0;
        var h = imgEl.naturalHeight || imgEl.offsetHeight || imgEl.height || 0;
        var area = w * h;
        var cls = (imgEl.className || '') + ' ' + (imgEl.getAttribute('alt') || '');
        if (/product|hero|main|featured|primary|carousel|zoom/i.test(cls)) area = area * 2 + 10000;
        if (area > bestScore && (w > 80 || h > 80)) {
          bestScore = area;
          bestSrc = absUrl;
        }
      }
      if (bestSrc) image = bestSrc;
    }

    // Ensure image URL is https
    if (image) image = image.replace(/^http:\/\//i, 'https://');

    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'metadata', title: title, image: image, brand: brand, price: price
    }));
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'metadata', title: null, image: null, brand: null, price: null
    }));
  }
})();
true;
`;

function toNavigationUrl(input: string): string {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w-]+\.[\w-]+/i.test(trimmed) && !trimmed.includes(" "))
    return `https://${trimmed}`;
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

type ParsedPreview = {
  title: string | null;
  image_url: string | null;
  price: string | null;
  brand: string | null;
};

// Isolated memoized WebView — never re-renders when sheet/modal state changes
const BrowserWebView = memo(function BrowserWebView({
  webViewRef,
  displayUrl,
  currentUrlRef,
  onUrlChangeRef,
  onMessage,
}: {
  webViewRef: React.RefObject<WebView | null>;
  displayUrl: string;
  currentUrlRef: React.MutableRefObject<string>;
  onUrlChangeRef: React.MutableRefObject<(url: string) => void>;
  onMessage: (e: WebViewMessageEvent) => void;
}) {
  return (
    <WebView
      ref={webViewRef}
      source={{ uri: displayUrl }}
      style={{ flex: 1 }}
      onNavigationStateChange={(state) => {
        if (state.url) {
          currentUrlRef.current = state.url;
          onUrlChangeRef.current(state.url);
        }
      }}
      onLoadEnd={(e) => {
        const url = e.nativeEvent.url;
        if (url) {
          currentUrlRef.current = url;
          onUrlChangeRef.current(url);
        }
      }}
      onMessage={onMessage}
      allowsBackForwardNavigationGestures
      sharedCookiesEnabled
      javaScriptEnabled
      domStorageEnabled
      cacheEnabled
      cacheMode="LOAD_CACHE_ELSE_NETWORK"
      pullToRefreshEnabled
    />
  );
});

export default function BrowserScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string; listId?: string; refreshItemId?: string }>();
  const initialUrl = params.url ?? "https://www.google.com";
  const presetListId = params.listId ?? null;
  const refreshItemId = params.refreshItemId ?? null;

  // Browser state
  const webViewRef = useRef<WebView>(null);
  const currentUrlRef = useRef(initialUrl); // ref = no re-render on every navigation event
  const [displayUrl, setDisplayUrl] = useState(initialUrl); // only updated on load end
  const [urlBarText, setUrlBarText] = useState(initialUrl);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [currentPageUrl, setCurrentPageUrl] = useState(initialUrl);

  function isSearchEngineFn(url: string) {
    try {
      const u = new URL(url);
      const h = u.hostname.replace(/^www\./, "");
      // Google: only hide on search results pages, not on accounts/fonts/maps/etc.
      if (h === "google.com" || h.endsWith(".google.com"))
        return u.pathname.startsWith("/search") || u.pathname === "/";
      return ["bing.com", "duckduckgo.com", "yahoo.com", "baidu.com"].some(
        (d) => h === d || h.endsWith("." + d)
      );
    } catch { return false; }
  }
  const isSearchEngine = isSearchEngineFn(currentPageUrl);

  // Add to list sheet
  const [sheetVisible, setSheetVisible] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<ParsedPreview | null>(null);
  const [capturedUrl, setCapturedUrl] = useState("");
  const [lists, setLists] = useState<List[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(presetListId);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Pre-fetch lists on mount so the sheet opens instantly
  useEffect(() => {
    if (presetListId) return;
    supabase.from("lists").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) {
        setLists(data as List[]);
        if (data.length === 1) setSelectedListId(data[0].id);
      }
    });
  }, []);

  // Metadata cache — pre-extracted as soon as each page loads
  const cachedMetadataRef = useRef<ParsedPreview | null>(null);
  // Resolver for the JS injection promise (user-triggered or preload)
  const metadataResolverRef = useRef<((d: ParsedPreview) => void) | null>(null);
  const preloadResolverRef = useRef<((d: ParsedPreview) => void) | null>(null);
  const preloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onUrlChangeRef = useRef<(url: string) => void>(() => {});
  onUrlChangeRef.current = (url: string) => {
    setCurrentPageUrl(url);
    cachedMetadataRef.current = null; // clear cache on navigation
    if (preloadTimerRef.current) clearTimeout(preloadTimerRef.current);
    if (!isSearchEngineFn(url)) {
      // Debounce 1.5s: onLoadEnd fires multiple times per page (redirects, sub-frames).
      // Only inject after the page has fully settled so meta tags are populated.
      preloadTimerRef.current = setTimeout(() => {
        preloadResolverRef.current = (data) => { cachedMetadataRef.current = data; };
        webViewRef.current?.injectJavaScript(EXTRACT_METADATA_JS);
      }, 1500);
    }
  };

  const handleNavigate = (input: string) => {
    const url = toNavigationUrl(input);
    currentUrlRef.current = url;
    setDisplayUrl(url);
    setUrlBarText(url);
    setIsEditingUrl(false);
    setCurrentPageUrl(url); // update immediately so button shows/hides without waiting for onLoadEnd
  };

  // Parse a metadata message into a ParsedPreview
  function buildPreview(msg: Record<string, unknown>): ParsedPreview {
    const domain = (() => {
      try { return new URL(currentUrlRef.current).hostname.replace(/^www\./, "").split(".")[0]; }
      catch { return null; }
    })();
    const brand = (msg.brand as string | null) ?? (domain
      ? domain.charAt(0).toUpperCase() + domain.slice(1)
      : null);
    return {
      title: (msg.title as string | null) ?? null,
      image_url: ((msg.image as string | null) ?? null)?.replace(/^http:\/\//i, "https://") ?? null,
      price: (msg.price as string | null) ?? null,
      brand,
    };
  }

  // Receive messages from injected JS — handles both preload and user-triggered
  const handleWebViewMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "metadata") {
        const result = buildPreview(msg);
        if (metadataResolverRef.current) {
          metadataResolverRef.current(result);
          metadataResolverRef.current = null;
          preloadResolverRef.current = null;
        } else if (preloadResolverRef.current) {
          preloadResolverRef.current(result);
          preloadResolverRef.current = null;
        }
      }
    } catch {}
  }, []);

  const extractMetadata = (): Promise<ParsedPreview> =>
    new Promise((resolve) => {
      const fallback = setTimeout(() => {
        metadataResolverRef.current = null;
        resolve({ title: null, image_url: null, price: null, brand: null });
      }, 5000);
      metadataResolverRef.current = (data) => {
        clearTimeout(fallback);
        resolve(data);
      };
      webViewRef.current?.injectJavaScript(EXTRACT_METADATA_JS);
    });

  const handleAddToList = useCallback(async () => {
    setCapturedUrl(currentUrlRef.current);
    setSaved(false);
    setSheetVisible(true); // open instantly — no waiting

    if (cachedMetadataRef.current) {
      setPreview(cachedMetadataRef.current);
      setParsing(false);
      return;
    }

    // No cache yet — show sheet immediately with spinner in preview only,
    // inject JS in background and update preview when ready
    setParsing(true);
    setPreview(null);
    extractMetadata().then((metadata) => {
      setPreview(metadata);
      setParsing(false);
    });
  }, [presetListId]);

  const saveItem = async () => {
    const listId = presetListId ?? selectedListId;
    if (!listId) {
      Alert.alert("pick a list first");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("list_items").insert({
      list_id: listId,
      url: capturedUrl,
      title: preview?.title ?? null,
      image_url: preview?.image_url ?? null,
      price: preview?.price ?? null,
      brand: preview?.brand ?? null,
      position: 0,
    });
    setSaving(false);
    if (error) {
      Alert.alert("Error", "couldn't save item");
    } else {
      setSaved(true);
      setTimeout(() => setSheetVisible(false), 800);
    }
  };

  const [imageSaved, setImageSaved] = useState(false);

  const handleSaveImage = useCallback(async () => {
    if (!refreshItemId) return;
    setParsing(true);
    const metadata = await extractMetadata();
    let imageUrl = metadata.image_url;

    // Fallback: server-side parse if WebView JS found nothing
    if (!imageUrl) {
      try {
        const res = await fetch(`${API_URL}/api/parse-url?url=${encodeURIComponent(currentUrlRef.current)}`);
        const data = await res.json();
        imageUrl = data.image_url ?? null;
      } catch {}
    }

    setParsing(false);
    if (!imageUrl) {
      Alert.alert("No image found", "couldn't find a product image on this page");
      return;
    }
    await supabase
      .from("list_items")
      .update({ image_url: imageUrl })
      .eq("id", refreshItemId);
    setImageSaved(true);
    setTimeout(() => router.back(), 800);
  }, [refreshItemId]);

  const closeSheet = () => {
    setSheetVisible(false);
    setPreview(null);
    setSaved(false);
    metadataResolverRef.current = null;
  };

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={["top"]} className="bg-white">
        {/* URL Bar */}
        <View className="flex-row items-center px-3 py-2 gap-2 border-b border-black/10">
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text className="text-xl font-bold">←</Text>
          </TouchableOpacity>

          {isEditingUrl ? (
            <TextInput
              className="flex-1 bg-black/5 px-3 py-1.5 text-sm rounded"
              value={urlBarText}
              onChangeText={setUrlBarText}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              autoFocus
              selectTextOnFocus
              onSubmitEditing={() => handleNavigate(urlBarText)}
              onBlur={() => {
                setIsEditingUrl(false);
                setUrlBarText(currentUrlRef.current);
              }}
            />
          ) : (
            <TouchableOpacity
              className="flex-1 bg-black/5 px-3 py-1.5 rounded"
              onPress={() => {
                setUrlBarText(currentUrlRef.current);
                setIsEditingUrl(true);
              }}
            >
              <Text className="text-sm text-black/60" numberOfLines={1}>
                {urlBarText.replace(/^https?:\/\/(www\.)?/, "")}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => webViewRef.current?.reload()} hitSlop={12}>
            <Text className="text-base">↻</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* WebView — memoized so sheet state changes don't remount/rerender it */}
      <BrowserWebView
        webViewRef={webViewRef}
        displayUrl={displayUrl}
        currentUrlRef={currentUrlRef}
        onUrlChangeRef={onUrlChangeRef}
        onMessage={handleWebViewMessage}
      />

      {/* Bottom action button — hidden on search engines */}
      {(refreshItemId || !isSearchEngine) && (
      <SafeAreaView edges={["bottom"]} className="bg-transparent">
        <View className="px-6 py-3">
          {refreshItemId ? (
            <TouchableOpacity
              className="bg-black py-3.5 items-center"
              onPress={handleSaveImage}
              disabled={parsing || imageSaved}
              style={{ opacity: parsing || imageSaved ? 0.6 : 1 }}
            >
              {parsing ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-base">
                  {imageSaved ? "✓ image saved" : "save image"}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              className="bg-black py-3.5 items-center"
              onPress={handleAddToList}
            >
              <Text className="text-white font-bold text-base">+ add to list</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
      )}

      {/* Add to List Bottom Sheet */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            className="flex-1 bg-black/40 justify-end"
            activeOpacity={1}
            onPress={closeSheet}
          >
            <Pressable className="bg-white" onPress={() => {}}>
              <SafeAreaView edges={["bottom"]}>
                <View className="px-6 pt-6 pb-2">
                  <Text className="text-2xl font-bold mb-4">add to list</Text>

                  {/* Preview — shows inline spinner while loading, never blocks the sheet */}
                  <View className="border-2 border-black mb-4 flex-row" style={{ minHeight: 80 }}>
                    {parsing ? (
                      <View className="flex-1 items-center justify-center py-6">
                        <ActivityIndicator color="#000" size="small" />
                      </View>
                    ) : preview ? (
                      <>
                        {preview.image_url ? (
                          <Image
                            source={{ uri: preview.image_url }}
                            style={{ width: 90, height: 110 }}
                            contentFit="cover"
                          />
                        ) : null}
                        <View className="flex-1 p-3 gap-0.5 justify-center">
                          {preview.brand ? (
                            <Text className="text-xs text-black/40 uppercase tracking-wider">
                              {preview.brand}
                            </Text>
                          ) : null}
                          {preview.title ? (
                            <Text className="font-bold text-sm leading-tight" numberOfLines={3}>
                              {preview.title}
                            </Text>
                          ) : null}
                          {preview.price ? (
                            <Text className="text-sm text-black/60">${preview.price}</Text>
                          ) : null}
                        </View>
                      </>
                    ) : (
                      <View className="flex-1 p-3 justify-center">
                        <Text className="text-xs text-black/30" numberOfLines={1}>{capturedUrl}</Text>
                      </View>
                    )}
                  </View>

                  {/* List selector — always visible */}
                  {!presetListId ? (
                    <View className="mb-4">
                      <Text className="text-sm font-semibold mb-2 text-black/60">save to</Text>
                      {lists.length === 0 ? (
                        <Text className="text-sm text-black/40">no lists yet — create one first</Text>
                      ) : (
                        <FlatList
                          data={lists}
                          keyExtractor={(l) => l.id}
                          scrollEnabled={false}
                          renderItem={({ item: l }) => (
                            <TouchableOpacity
                              className="flex-row items-center gap-3 py-2.5 border-b border-black/5"
                              onPress={() => setSelectedListId(l.id)}
                            >
                              <View
                                className="w-4 h-4 border-2 border-black items-center justify-center"
                                style={{ backgroundColor: selectedListId === l.id ? "#000" : "transparent" }}
                              >
                                {selectedListId === l.id ? (
                                  <Text className="text-white text-xs">✓</Text>
                                ) : null}
                              </View>
                              <Text className="text-base font-medium">{l.name}</Text>
                            </TouchableOpacity>
                          )}
                        />
                      )}
                    </View>
                  ) : (
                    <Text className="text-sm text-black/40 mb-4">saving to current list</Text>
                  )}

                  {/* Save / Success — always visible */}
                  {saved ? (
                    <View className="bg-black py-3.5 items-center mb-2">
                      <Text className="text-white font-bold text-base">✓ saved</Text>
                    </View>
                  ) : (
                      <TouchableOpacity
                        className="bg-black py-3.5 items-center mb-2"
                        onPress={saveItem}
                        disabled={saving || (!selectedListId && !presetListId)}
                        style={{ opacity: saving || (!selectedListId && !presetListId) ? 0.4 : 1 }}
                      >
                        {saving ? (
                          <ActivityIndicator color="white" />
                        ) : (
                          <Text className="text-white font-bold text-base">save to list</Text>
                        )}
                      </TouchableOpacity>
                    )
                  }
                </View>
              </SafeAreaView>
            </Pressable>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
