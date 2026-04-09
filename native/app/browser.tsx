import { useState, useRef, useCallback } from "react";
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

// Injected into the WebView to extract metadata from the already-loaded page.
// Bypasses Cloudflare/bot protection since the page is rendered in a real browser engine.
const EXTRACT_METADATA_JS = `
(function() {
  function meta(prop) {
    var el = document.querySelector('meta[property="' + prop + '"]') ||
             document.querySelector('meta[name="' + prop + '"]');
    return el ? el.getAttribute('content') : null;
  }

  var title = meta('og:title') || document.title || null;
  var image = meta('og:image') || null;
  var brand = meta('og:site_name') || null;
  var price = meta('product:price:amount') || meta('og:price:amount') || null;

  // JSON-LD structured data for price
  if (!price) {
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < scripts.length; i++) {
      try {
        var data = JSON.parse(scripts[i].textContent);
        var nodes = Array.isArray(data) ? data : (data['@graph'] ? data['@graph'] : [data]);
        for (var j = 0; j < nodes.length; j++) {
          var offers = nodes[j].offers;
          if (offers) {
            var p = Array.isArray(offers) ? (offers[0] && offers[0].price) : offers.price;
            if (p != null) { price = String(p); break; }
          }
        }
      } catch(e) {}
      if (price) break;
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

  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'metadata',
    title: title,
    image: image,
    brand: brand,
    price: price
  }));
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

export default function BrowserScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string; listId?: string }>();
  const initialUrl = params.url ?? "https://www.google.com";
  const presetListId = params.listId ?? null;

  // Browser state
  const webViewRef = useRef<WebView>(null);
  const currentUrlRef = useRef(initialUrl); // ref = no re-render on every navigation event
  const [displayUrl, setDisplayUrl] = useState(initialUrl); // only updated on load end
  const [urlBarText, setUrlBarText] = useState(initialUrl);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [loading, setLoading] = useState(true);

  // Add to list sheet
  const [sheetVisible, setSheetVisible] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<ParsedPreview | null>(null);
  const [capturedUrl, setCapturedUrl] = useState("");
  const [lists, setLists] = useState<List[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(presetListId);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Resolver for the JS injection promise
  const metadataResolverRef = useRef<((d: ParsedPreview) => void) | null>(null);

  const handleNavigate = (input: string) => {
    const url = toNavigationUrl(input);
    currentUrlRef.current = url;
    setDisplayUrl(url);
    setUrlBarText(url);
    setIsEditingUrl(false);
  };

  // Receive messages from injected JS — uses ref so no re-render dependency
  const handleWebViewMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "metadata" && metadataResolverRef.current) {
        const domain = (() => {
          try {
            return new URL(currentUrlRef.current).hostname.replace(/^www\./, "").split(".")[0];
          } catch { return null; }
        })();
        const brand = msg.brand ?? (domain
          ? domain.charAt(0).toUpperCase() + domain.slice(1)
          : null);
        metadataResolverRef.current({
          title: msg.title ?? null,
          image_url: msg.image ?? null,
          price: msg.price ?? null,
          brand,
        });
        metadataResolverRef.current = null;
      }
    } catch {}
  }, []); // no deps — reads from ref

  const extractMetadata = (): Promise<ParsedPreview> =>
    new Promise((resolve) => {
      metadataResolverRef.current = resolve;
      webViewRef.current?.injectJavaScript(EXTRACT_METADATA_JS);
    });

  const handleAddToList = useCallback(async () => {
    setCapturedUrl(currentUrlRef.current);
    setPreview(null);
    setSaved(false);
    setSheetVisible(true);
    setParsing(true);

    // Run JS injection + fetch lists in parallel
    const [metadata, listsResult] = await Promise.all([
      extractMetadata(),
      presetListId
        ? Promise.resolve({ data: [] as List[] })
        : supabase.from("lists").select("*").order("created_at", { ascending: false }),
    ]);

    setParsing(false);
    setPreview(metadata);

    const listsData = listsResult.data as List[] | null;
    if (!presetListId && listsData) {
      setLists(listsData);
      if (listsData.length === 1) setSelectedListId(listsData[0].id);
    }
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

  const closeSheet = () => {
    setSheetVisible(false);
    setPreview(null);
    setSaved(false);
    metadataResolverRef.current = null;
    if (!presetListId) setSelectedListId(null);
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
            {loading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text className="text-base">↻</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: displayUrl }}
        style={{ flex: 1 }}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={(e) => {
          setLoading(false);
          const url = e.nativeEvent.url;
          if (url) {
            currentUrlRef.current = url;
            if (!isEditingUrl) setUrlBarText(url);
          }
        }}
        onMessage={handleWebViewMessage}
        allowsBackForwardNavigationGestures
        sharedCookiesEnabled
        javaScriptEnabled
      />

      {/* Add to List floating button */}
      <SafeAreaView edges={["bottom"]} className="bg-transparent">
        <View className="px-6 py-3">
          <TouchableOpacity
            className="bg-black py-3.5 items-center"
            onPress={handleAddToList}
          >
            <Text className="text-white font-bold text-base">+ add to list</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

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

                  {/* Preview */}
                  {parsing ? (
                    <View className="items-center py-8">
                      <ActivityIndicator color="#000" />
                      <Text className="text-black/40 text-sm mt-2">reading page...</Text>
                    </View>
                  ) : preview ? (
                    <View className="border-2 border-black mb-4 flex-row">
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
                        {!preview.title && !preview.image_url ? (
                          <Text className="text-xs text-black/40">
                            no preview — will save URL only
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ) : null}

                  {/* List selector */}
                  {!presetListId && !parsing ? (
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
                  ) : null}

                  {presetListId && !parsing ? (
                    <Text className="text-sm text-black/40 mb-4">saving to current list</Text>
                  ) : null}

                  {/* Save / Success */}
                  {!parsing ? (
                    saved ? (
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
                  ) : null}
                </View>
              </SafeAreaView>
            </Pressable>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
