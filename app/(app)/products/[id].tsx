import { useState, type ReactNode } from "react";
import { Image, Linking, Modal, Pressable, ScrollView, Share, useWindowDimensions, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/icon";
import { DetailHeader, RoundButton, SheetEmpty, Thumb } from "@/components/shell";
import { AppText, Badge } from "@/components/ui";
import { formatCount, formatIls } from "@/lib/format";
import { PRODUCT_BADGE, knownBadge } from "@/lib/orders";
import type { PageEntry, ProductRecord } from "@/lib/snapshot";
import { useAllowed, useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { TAB_SPACE, tokens } from "@/theme/tokens";

const PAGE_PARTS: { key: keyof NonNullable<ProductRecord["page"]>; label: string }[] = [
  { key: "highlights", label: "נקודות מפתח" },
  { key: "panels", label: "פאנלים בעמוד" },
  { key: "steps", label: "שלבי שימוש" },
  { key: "ingredients", label: "רכיבים" },
  { key: "inci", label: "INCI" },
  { key: "reviews", label: "ביקורות בעמוד" },
  { key: "faqs", label: "שאלות נפוצות" },
];

function storeUrl(hostname: string | undefined, product: ProductRecord) {
  const host = hostname?.trim();
  if (!host) return "";
  const base = host.startsWith("http") ? host.replace(/\/+$/, "") : `https://${host}`;
  return `${base}/product/${encodeURIComponent(product.handle || product.id)}`;
}

export default function ProductScreen() {
  const fonts = useFontSet();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const allowed = useAllowed("products.read");
  const { snapshot, error } = useStoreData();
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [viewer, setViewer] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const product = snapshot?.products?.find((item) => item.id === id);

  if (!allowed) return <Screen title="מוצר"><SheetEmpty icon="tag" text="אין הרשאה למסך הזה." /></Screen>;
  if (!product) return <Screen title="מוצר"><SheetEmpty icon="tag" text={error || "המוצר לא נמצא."} /></Screen>;

  const badge = knownBadge(PRODUCT_BADGE, product.status);
  const media = product.media ?? [];
  const bundles = product.bundles ?? [];
  const url = storeUrl(snapshot?.hostname, product);
  const collections = (snapshot?.collections ?? []).filter((collection) => collection.productIds?.includes(product.id)).map((collection) => collection.title);
  const prices = [product.price, ...bundles.map((bundle) => bundle.price)].filter((value): value is number => value != null);
  const priceLine = prices.length ? [...new Set(prices)].map(formatIls).join(", ") : "לא הוגדר מחיר";
  const margin = product.price && product.cost ? Math.round(((product.price - product.cost) / product.price) * 100) : null;
  const tile = (width - 32 - 10) / 2;
  const toggle = (key: string) => setOpen((state) => ({ ...state, [key]: !state[key] }));

  async function share() {
    if (!url) return;
    await Share.share({ message: `${product?.title ?? ""}\n${url}`, url });
  }

  async function copyLink() {
    setMenu(false);
    if (!url) return;
    await Clipboard.setStringAsync(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Screen
      title={compact ? product.title || "מוצר" : ""}
      actions={(
        <>
          {url ? <RoundButton icon="share" onPress={() => void share()} /> : null}
          {url ? <RoundButton icon="dots" onPress={() => setMenu(true)} /> : null}
        </>
      )}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: tokens.field }}
        contentContainerStyle={{ gap: 8, paddingBottom: TAB_SPACE + insets.bottom + 12 }}
        scrollEventThrottle={32}
        onScroll={(event) => {
          const next = event.nativeEvent.contentOffset.y > 300;
          if (next !== compact) setCompact(next);
        }}
      >
        <View style={{ backgroundColor: tokens.card }}>
          <Row label="סטטוס מוצר" trailing={badge ? <Badge {...badge} /> : null} last />
        </View>

        <View style={{ backgroundColor: tokens.card, paddingTop: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 10 }}>
            <AppText style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: tokens.inkStrong }}>{`מדיה (${formatCount(media.length)})`}</AppText>
            {media.length ? (
              <Pressable onPress={() => setViewer(0)} hitSlop={8}>
                <AppText style={{ color: tokens.link, fontSize: 15 }}>הצג הכל</AppText>
              </Pressable>
            ) : null}
          </View>
          {media.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
              {media.map((uri, index) => (
                <Pressable key={uri} onPress={() => setViewer(index)}>
                  <Image source={{ uri }} style={{ width: tile, height: tile, borderRadius: 12, borderWidth: 1, borderColor: tokens.line, backgroundColor: tokens.card }} resizeMode="contain" />
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={{ paddingHorizontal: 16 }}>
              <View style={{ width: tile, height: tile, borderRadius: 12, borderWidth: 1, borderColor: tokens.line, alignItems: "center", justifyContent: "center" }}>
                <Icon name="image" size={30} color="#b5b5b5" />
              </View>
            </View>
          )}
          <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6, gap: 4 }}>
            <AppText style={{ fontSize: 22, lineHeight: 30, color: tokens.inkStrong }}>{product.title || ""}</AppText>
            {product.subtitle ? <AppText style={{ fontSize: 14, color: tokens.inkSecondary }}>{product.subtitle}</AppText> : null}
          </View>
          <Row
            label={product.description || "אין תיאור"}
            muted={!product.description}
            lines={open.description ? undefined : 2}
            onPress={product.description ? () => toggle("description") : undefined}
            expanded={open.description}
          />
          <Row
            icon="layers"
            label={product.category || "לא נבחרה קטגוריה"}
            muted={!product.category}
            hint={product.subcategories?.length ? product.subcategories.join(" • ") : undefined}
          />
          <Row label={priceLine} onPress={() => toggle("price")} expanded={open.price} last={!open.price} />
          {open.price ? (
            <Details last>
              <Pair label="מחיר" value={product.price != null ? formatIls(product.price) : "—"} />
              {product.compareAt != null ? <Pair label="מחיר לפני הנחה" value={formatIls(product.compareAt)} strike /> : null}
              {product.cost != null ? <Pair label="עלות לפריט" value={formatIls(product.cost)} /> : null}
              {product.price != null && product.cost != null ? <Pair label="רווח" value={formatIls(product.price - product.cost)} /> : null}
              {margin != null ? <Pair label="שולי רווח" value={`${margin}%`} /> : null}
            </Details>
          ) : null}
        </View>

        <Block title="פרסום" subtitle="ערוץ אחד • חנות אונליין">
          <Row
            icon="store"
            label="חנות אונליין"
            hint={product.status === "active" ? "מוצג בחנות" : product.status === "draft" ? "טיוטה — לא מוצג בחנות" : "בארכיון — לא מוצג בחנות"}
            onPress={url && product.status === "active" ? () => void Linking.openURL(url) : undefined}
            external
            last
          />
        </Block>

        {bundles.length ? (
          <Block title="אפשרויות">
            <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 8 }}>
              <AppText style={{ fontSize: 13, color: tokens.ink }}>{`כמות (${formatCount(bundles.length)})`}</AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {bundles.map((bundle) => (
                  <View key={bundle.qty} style={{ paddingHorizontal: 12, height: 32, borderRadius: 8, backgroundColor: "#ebebeb", justifyContent: "center" }}>
                    <AppText style={{ fontSize: 13, color: tokens.inkStrong }}>{bundle.label}</AppText>
                  </View>
                ))}
              </View>
            </View>
          </Block>
        ) : null}

        <Block title="וריאנטים">
          <Pressable
            disabled={!bundles.length}
            onPress={() => toggle("variants")}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 14, opacity: pressed ? 0.6 : 1 })}
          >
            <Thumb uri={media[0]} size={40} />
            <AppText style={{ flex: 1, fontSize: 15, color: tokens.inkStrong }}>
              {bundles.length ? `${formatCount(bundles.length)} וריאנטים` : product.variant || "וריאנט יחיד"}
            </AppText>
            {bundles.length ? <Chevron down={open.variants} /> : null}
          </Pressable>
          {open.variants ? bundles.map((bundle) => (
            <View key={bundle.qty} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: tokens.line }}>
              <Thumb uri={bundle.image ?? media[0]} size={36} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText style={{ fontSize: 14, color: tokens.inkStrong }}>{bundle.label}</AppText>
                <AppText style={{ fontSize: 12, color: tokens.inkSecondary }}>
                  {[`${formatCount(bundle.qty)} יח׳`, bundle.tag, `${formatIls(bundle.price / bundle.qty)} ליחידה`].filter(Boolean).join(" • ")}
                </AppText>
              </View>
              <AppText style={{ fontSize: 14, fontFamily: fonts.semibold, color: tokens.inkStrong }}>{formatIls(bundle.price)}</AppText>
            </View>
          )) : null}
        </Block>

        <Block title="מלאי" subtitle={product.stock == null ? "לא במעקב" : product.stock > 0 ? `${formatCount(product.stock)} במלאי` : "אזל מהמלאי"}>
          {product.sku || product.barcode ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 6 }}>
              {product.sku ? <Pair label="מק״ט" value={product.sku} /> : null}
              {product.barcode ? <Pair label="ברקוד" value={product.barcode} /> : null}
            </View>
          ) : null}
        </Block>

        {product.page && PAGE_PARTS.some((part) => product.page?.[part.key].length) ? (
          <Block title="תוכן עמוד המוצר">
            {PAGE_PARTS.filter((part) => product.page?.[part.key].length).map((part, index, list) => (
              <View key={part.key}>
                <Row
                  label={part.label}
                  hint={`${formatCount(product.page?.[part.key].length ?? 0)} פריטים`}
                  onPress={() => toggle(part.key)}
                  expanded={open[part.key]}
                  last={index === list.length - 1 && !open[part.key]}
                />
                {open[part.key] ? <EntryList items={product.page?.[part.key] ?? []} /> : null}
              </View>
            ))}
          </Block>
        ) : null}

        <View style={{ backgroundColor: tokens.card }}>
          {product.variant ? <Row icon="box" label="סוג" hint={product.variant} /> : null}
          <Row icon="store" label="ספק" hint={product.vendor || "לא הוגדר"} />
          <Row icon="tag" label="קטגוריות" hint={collections.length ? collections.join(", ") : "לא משויך לקטגוריות"} />
          <Row icon="hash" label="תגיות" hint={product.tags?.length ? product.tags.join(" • ") : "אין תגיות"} />
          {product.badge ? <Row icon="discount" label="תווית על המוצר" hint={product.badgeHidden ? `${product.badge} (מוסתרת)` : product.badge} /> : null}
          <Row
            icon="search"
            label="SEO"
            hint={product.seoTitle || product.title}
            onPress={() => toggle("seo")}
            expanded={open.seo}
            last={!open.seo}
          />
          {open.seo ? (
            <Details last>
              <Pair label="כותרת" value={product.seoTitle || product.title || "—"} />
              <Pair label="תיאור" value={product.seoDescription || "לא הוגדר"} />
              {url ? <Pair label="כתובת" value={url} ltr /> : null}
            </Details>
          ) : null}
        </View>
        {copied ? <AppText style={{ textAlign: "center", color: tokens.inkSecondary, fontSize: 13 }}>הקישור הועתק</AppText> : null}
      </ScrollView>

      <Modal visible={menu} transparent animationType="slide" onRequestClose={() => setMenu(false)}>
        <Pressable onPress={() => setMenu(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: tokens.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) + 8, direction: "rtl" }}>
            <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "#d4d4d4", marginBottom: 8 }} />
            <SheetAction label="צפייה בחנות" onPress={() => { setMenu(false); void Linking.openURL(url); }} />
            <SheetAction label="העתקת קישור למוצר" onPress={() => void copyLink()} />
            <SheetAction label="שיתוף" onPress={() => { setMenu(false); void share(); }} />
          </View>
        </Pressable>
      </Modal>

      <Modal visible={viewer != null} animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={{ flex: 1, backgroundColor: "#000000", direction: "rtl" }}>
          {viewer != null && media[viewer] ? <Image source={{ uri: media[viewer] }} style={{ flex: 1 }} resizeMode="contain" /> : null}
          <View style={{ position: "absolute", top: insets.top + 8, start: 12, end: 12, flexDirection: "row", alignItems: "center" }}>
            <RoundButton icon="close" onPress={() => setViewer(null)} dark />
            <AppText style={{ flex: 1, textAlign: "center", color: "#ffffff", fontSize: 15 }}>{viewer != null ? `${viewer + 1} / ${media.length}` : ""}</AppText>
            <View style={{ width: 36 }} />
          </View>
          {media.length > 1 ? (
            <View style={{ position: "absolute", bottom: insets.bottom + 24, start: 0, end: 0, flexDirection: "row", justifyContent: "center", gap: 16 }}>
              <RoundButton icon="back" dark size={44} onPress={() => setViewer((index) => (index == null ? 0 : (index - 1 + media.length) % media.length))} />
              <RoundButton icon="forward" dark size={44} onPress={() => setViewer((index) => (index == null ? 0 : (index + 1) % media.length))} />
            </View>
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}

function Screen({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: tokens.card }}>
      <DetailHeader title={title} actions={actions} />
      {children}
    </View>
  );
}

function Block({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  const fonts = useFontSet();
  return (
    <View style={{ backgroundColor: tokens.card }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: children ? 10 : 14, gap: 2 }}>
        <AppText style={{ fontFamily: fonts.semibold, fontSize: 15, color: tokens.inkStrong }}>{title}</AppText>
        {subtitle ? <AppText style={{ fontSize: 12, color: tokens.inkSecondary }}>{subtitle}</AppText> : null}
      </View>
      {children}
    </View>
  );
}

function Chevron({ down = false }: { down?: boolean }) {
  return <Icon name={down ? "down" : "forward"} size={16} color="#b5b5b5" strokeWidth={2} />;
}

function Row({
  icon,
  label,
  hint,
  trailing,
  onPress,
  expanded,
  muted = false,
  lines = 1,
  last = false,
  external = false,
}: {
  icon?: IconName;
  label: string;
  hint?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  expanded?: boolean;
  muted?: boolean;
  lines?: number;
  last?: boolean;
  external?: boolean;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingVertical: 12, marginHorizontal: 16, borderBottomWidth: last ? 0 : 1, borderBottomColor: tokens.line, opacity: pressed ? 0.6 : 1 })}
    >
      {icon ? <Icon name={icon} size={18} color={tokens.inkStrong} strokeWidth={1.7} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={{ fontSize: 15, color: muted ? tokens.inkSecondary : tokens.inkStrong }} numberOfLines={lines}>{label}</AppText>
        {hint ? <AppText style={{ fontSize: 12, color: tokens.inkSecondary }} numberOfLines={expanded ? undefined : 1}>{hint}</AppText> : null}
      </View>
      {trailing}
      {onPress ? (external ? <Icon name="link" size={16} color="#b5b5b5" strokeWidth={1.8} /> : <Chevron down={expanded} />) : null}
    </Pressable>
  );
}

function Details({ children, last = false }: { children: ReactNode; last?: boolean }) {
  return <View style={{ marginHorizontal: 16, paddingBottom: 14, gap: 8, borderBottomWidth: last ? 0 : 1, borderBottomColor: tokens.line }}>{children}</View>;
}

function Pair({ label, value, strike = false, ltr = false }: { label: string; value: string; strike?: boolean; ltr?: boolean }) {
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <AppText style={{ fontSize: 14, color: tokens.inkSecondary }}>{label}</AppText>
      <AppText
        style={{ flex: 1, fontSize: 14, color: tokens.inkStrong, textAlign: "left", writingDirection: ltr ? "ltr" : "rtl", textDecorationLine: strike ? "line-through" : "none" }}
        numberOfLines={ltr ? 1 : undefined}
      >
        {value}
      </AppText>
    </View>
  );
}

function EntryList({ items }: { items: PageEntry[] }) {
  const fonts = useFontSet();
  return (
    <View style={{ marginHorizontal: 16, paddingBottom: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: tokens.line }}>
      {items.map((item, index) => (
        <View key={`${item.title}-${index}`} style={{ gap: 2, paddingStart: 10, borderStartWidth: 2, borderStartColor: "#e3e3e3" }}>
          <AppText style={{ fontSize: 14, fontFamily: fonts.semibold, color: tokens.inkStrong }}>{item.title}</AppText>
          {item.body ? <AppText style={{ fontSize: 13, lineHeight: 19, color: tokens.ink }}>{item.body}</AppText> : null}
        </View>
      ))}
    </View>
  );
}

function SheetAction({ label, onPress }: { label: string; onPress: () => void }) {
  const fonts = useFontSet();
  return (
    <Pressable onPress={onPress} style={{ height: 50, paddingHorizontal: 20, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: tokens.line }}>
      <AppText style={{ fontSize: 16, fontFamily: fonts.medium, color: tokens.inkStrong }}>{label}</AppText>
    </Pressable>
  );
}
