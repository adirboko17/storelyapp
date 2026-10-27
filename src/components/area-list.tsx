import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Pressable, SectionList, View } from "react-native";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { AnalyticsHome, ReportsLibrary } from "@/components/analytics";
import { PopupsHome } from "@/components/popups";
import { BrowseList } from "@/components/browse";
import { Icon } from "@/components/icon";
import { LiveView } from "@/components/live-view";
import { NotificationSettings } from "@/components/notification-settings";
import { OrderRow } from "@/components/rows";
import { Chips, FlatRow, SearchBar, SectionLabel, SheetEmpty, Thumb } from "@/components/shell";
import { AppText, Badge, ErrorNote, LoadingBlock, refreshControl } from "@/components/ui";
import { formatCount, formatIls, hebrewDay, hebrewTime } from "@/lib/format";
import { INTEGRATIONS, SEGMENTS, type AreaKey } from "@/lib/menu";
import {
  loadAttribution,
  loadCampaigns,
  loadConnections,
  loadEvents,
  loadReviews,
  loadUsers,
  revokeConnection,
  useStoreCall,
  type ReviewRow,
} from "@/lib/remote";
import { customerCountLabel, inSegment, orderStats, segmentRule } from "@/lib/segments";
import { useStoreData } from "@/lib/store-data";
import { sortedOrders, type CheckoutRecord, type OrderRecord } from "@/lib/snapshot";
import { useFontSet } from "@/theme/fonts";
import { TAB_SPACE, tokens } from "@/theme/tokens";

function href(key: string, id: string) {
  return `/more/area/${key}/${encodeURIComponent(id)}` as Href;
}

function Line({ title, meta }: { title: string; meta?: string }) {
  const fonts = useFontSet();
  return (
    <View style={{ gap: 4 }}>
      <AppText style={{ fontFamily: fonts.semibold }} numberOfLines={1}>{title}</AppText>
      {meta ? <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }} numberOfLines={2}>{meta}</AppText> : null}
    </View>
  );
}

function useQueryState() {
  const [query, setQuery] = useState("");
  return { query, setQuery };
}

function match(query: string, text: string) {
  const needle = query.trim().toLowerCase();
  return !needle || text.toLowerCase().includes(needle);
}

export function AreaList({ area }: { area: AreaKey }) {
  if (area === "returns") return <Returns />;
  if (area === "abandoned") return <Abandoned />;
  if (area === "inventory") return <Inventory />;
  if (area === "reviews") return <Reviews />;
  if (area === "gift-cards") return <GiftCards />;
  if (area === "segments") return <Segments />;
  if (area === "growth" || area === "attribution") return <Channels mode={area} />;
  if (area === "integrations") return <Integrations />;
  if (area === "messages") return <Messages />;
  if (area === "automations") return <Automations />;
  if (area === "campaigns") return <Campaigns />;
  if (area === "popups") return <Popups />;
  if (area === "posts") return <Posts />;
  if (area === "events") return <Events />;
  if (area === "live") return <LiveView />;
  if (area === "analytics") return <AnalyticsHome />;
  if (area === "reports") return <ReportsLibrary />;
  if (area === "store") return <StoreLink />;
  if (area === "general") return <General />;
  if (area === "notifications") return <NotificationSettings />;
  if (area === "shipping") return <Shipping />;
  if (area === "policies") return <Policies />;
  if (area === "users") return <Users />;
  return <Connections />;
}

type ReturnTab = "all" | "partial" | "refunded";

const RETURN_TABS: { id: ReturnTab; label: string }[] = [
  { id: "all", label: "הכל" },
  { id: "partial", label: "הוחזר חלקית" },
  { id: "refunded", label: "הוחזר" },
];

function isReturn(order: OrderRecord) {
  return order.pay === "refunded" || order.pay === "partially_refunded" || (order.refunded != null && order.refunded > 0);
}

function inReturnTab(order: OrderRecord, tab: ReturnTab) {
  if (tab === "refunded") return order.pay === "refunded";
  if (tab === "partial") return isReturn(order) && order.pay !== "refunded";
  return true;
}

function Returns() {
  const router = useRouter();
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<ReturnTab>("all");
  const [oldest, setOldest] = useState(false);
  const orders = snapshot?.orders;
  const sections = useMemo(() => {
    const needle = query.trim().replaceAll("#", "").toLowerCase();
    const sorted = sortedOrders((orders ?? []).filter(isReturn));
    const list = (oldest ? sorted.reverse() : sorted).filter((order) => {
      if (!inReturnTab(order, tab)) return false;
      if (!needle) return true;
      return String(order.number).includes(needle) || (order.customerName ?? "").toLowerCase().includes(needle);
    });
    const groups: { title: string; data: OrderRecord[] }[] = [];
    list.forEach((order) => {
      const title = hebrewDay(order.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.title === title) last.data.push(order);
      else groups.push({ title, data: [order] });
    });
    return groups;
  }, [orders, query, tab, oldest]);

  if (loading) return <LoadingBlock />;
  return (
    <View style={{ flex: 1, backgroundColor: tokens.card }}>
      <SearchBar value={query} onChange={setQuery} placeholder="חיפוש" onSort={() => setOldest(!oldest)} sortActive={oldest} />
      <Chips items={RETURN_TABS} value={tab} onChange={setTab} />
      {error ? <ErrorNote text={error} /> : null}
      <SectionList
        style={{ flex: 1 }}
        sections={sections}
        keyExtractor={(order) => String(order.number)}
        stickySectionHeadersEnabled
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: TAB_SPACE + 12 }}
        refreshControl={refreshControl(refreshing, () => void refresh())}
        keyboardShouldPersistTaps="handled"
        renderSectionHeader={({ section }) => <SectionLabel text={section.title} />}
        renderItem={({ item }) => <OrderRow refund order={item} onPress={() => router.push(`/orders/${item.number}` as Href)} />}
        ListEmptyComponent={error ? undefined : (
          <SheetEmpty icon="orders" text={!orders ? "הסנאפשוט לא כולל הזמנות." : query.trim() ? "אין תוצאות לחיפוש" : tab === "all" ? "אין החזרות עדיין" : "אין החזרות בסינון הזה"} />
        )}
      />
    </View>
  );
}

type CartTab = "open" | "recovered";

const CART_TABS: { id: CartTab; label: string }[] = [
  { id: "open", label: "לא הושלמו" },
  { id: "recovered", label: "שוחזרו" },
];

const OPEN_BADGE = { label: "לא שוחזרה", background: "#ffd6a4", color: "#5e4200" };
const DONE_BADGE = { label: "שוחזרה", background: "#cdfee1", color: "#0c5132" };
const UNSENT_BADGE = { label: "המייל לא נשלח", background: "#ffd6a4", color: "#5e4200" };
const SENT_BADGE = { label: "נשלח מייל", background: "#e0f0ff", color: "#00527c" };

function cartCount(cart: CheckoutRecord) {
  if (!cart.lines) return undefined;
  return cart.lines.reduce((sum, line) => sum + (line.quantity ?? 1), 0);
}

function sortedCarts(carts: CheckoutRecord[]) {
  return [...carts].sort((a, b) => {
    const at = Date.parse(a.updatedAt ?? "");
    const bt = Date.parse(b.updatedAt ?? "");
    if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return bt - at;
    return b.id.localeCompare(a.id);
  });
}

function CheckoutRow({ cart, onPress }: { cart: CheckoutRecord; onPress: () => void }) {
  const fonts = useFontSet();
  const count = cartCount(cart);
  const items = count == null ? "" : count === 1 ? "פריט אחד" : `${formatCount(count)} פריטים`;
  const meta = [items, hebrewTime(cart.updatedAt), cart.name].filter(Boolean).join(" • ");
  return (
    <FlatRow onPress={onPress}>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <AppText style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong, writingDirection: "ltr" }} numberOfLines={1}>{`#${cart.id}`}</AppText>
          {cart.total != null ? <AppText style={{ fontSize: 15, color: tokens.inkStrong, writingDirection: "ltr" }}>{formatIls(cart.total)}</AppText> : null}
        </View>
        {meta ? <AppText style={{ color: tokens.inkSecondary, fontSize: 14 }} numberOfLines={1}>{meta}</AppText> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
          <Badge {...(cart.recovered ? DONE_BADGE : OPEN_BADGE)} />
          <Badge {...(cart.reminded ? SENT_BADGE : UNSENT_BADGE)} />
        </View>
      </View>
    </FlatRow>
  );
}

function Abandoned() {
  const router = useRouter();
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<CartTab>("open");
  const [oldest, setOldest] = useState(false);
  const carts = snapshot?.checkouts;
  const sections = useMemo(() => {
    const needle = query.trim().replaceAll("#", "").toLowerCase();
    const sorted = sortedCarts(carts ?? []);
    const list = (oldest ? sorted.reverse() : sorted).filter((cart) => {
      if (tab === "open" && cart.recovered) return false;
      if (tab === "recovered" && !cart.recovered) return false;
      if (!needle) return true;
      return `${cart.id} ${cart.name ?? ""} ${cart.email ?? ""} ${cart.phone ?? ""}`.toLowerCase().includes(needle);
    });
    const groups: { title: string; data: CheckoutRecord[] }[] = [];
    list.forEach((cart) => {
      const title = hebrewDay(cart.updatedAt);
      const last = groups[groups.length - 1];
      if (last && last.title === title) last.data.push(cart);
      else groups.push({ title, data: [cart] });
    });
    return groups;
  }, [carts, query, tab, oldest]);

  if (loading) return <LoadingBlock />;
  return (
    <View style={{ flex: 1, backgroundColor: tokens.card }}>
      <SearchBar value={query} onChange={setQuery} placeholder="חיפוש" onSort={() => setOldest(!oldest)} sortActive={oldest} />
      <Chips items={CART_TABS} value={tab} onChange={setTab} />
      {error ? <ErrorNote text={error} /> : null}
      <SectionList
        style={{ flex: 1 }}
        sections={sections}
        keyExtractor={(cart) => cart.id}
        stickySectionHeadersEnabled
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: TAB_SPACE + 12 }}
        refreshControl={refreshControl(refreshing, () => void refresh())}
        keyboardShouldPersistTaps="handled"
        renderSectionHeader={({ section }) => <SectionLabel text={section.title} />}
        renderItem={({ item }) => <CheckoutRow cart={item} onPress={() => router.push(href("abandoned", item.id))} />}
        ListEmptyComponent={error ? undefined : (
          <SheetEmpty icon="orders" text={!carts ? "הסנאפשוט לא כולל עגלות נטושות." : query.trim() ? "אין תוצאות לחיפוש" : tab === "open" ? "אין עגלות פתוחות" : "אין עגלות ששוחזרו"} />
        )}
      />
    </View>
  );
}

function Inventory() {
  const router = useRouter();
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const { query, setQuery } = useQueryState();
  const products = snapshot?.products;
  const rows = (products ?? []).filter((product) => product.stock != null).sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
  const visible = rows.filter((product) => match(query, `${product.title ?? ""} ${product.sku ?? ""}`));
  const missing = products ? products.every((product) => product.stock == null) : false;
  return (
    <BrowseList
      query={query}
      onQuery={setQuery}
      placeholder="חיפוש מלאי"
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      error={error}
      data={products && !missing ? visible : []}
      empty={!products || missing ? "הסנאפשוט לא כולל מלאי." : "אין מוצרים עדיין"}
      keyExtractor={(product) => product.id}
      onPress={(product) => router.push(`/products/${product.id}` as Href)}
      renderItem={(product) => <Line title={product.title || ""} meta={product.stock === 0 ? "אזל" : `מלאי ${formatCount(product.stock ?? 0)}`} />}
    />
  );
}

function Reviews() {
  const router = useRouter();
  const [status, setStatus] = useState<"pending" | "published" | "rejected">("pending");
  const { query, setQuery } = useQueryState();
  const load = useCallback((storeId: string) => loadReviews(storeId, status), [status]);
  const remote = useStoreCall(load);
  const rows = (remote.data ?? []).filter((review) => match(query, `${review.productTitle} ${review.name} ${review.body}`));
  return (
    <BrowseList
      query={query}
      onQuery={setQuery}
      placeholder="חיפוש ביקורות"
      loading={remote.loading}
      refreshing={remote.refreshing}
      onRefresh={() => void remote.refresh()}
      error={remote.error}
      data={rows}
      empty="אין ביקורות בסטטוס הזה"
      keyExtractor={(review) => review.id}
      onPress={(review) => router.push(href("reviews", review.id))}
      header={<ReviewTabs status={status} onChange={setStatus} />}
      renderItem={(review) => <Line title={review.productTitle} meta={`${review.name} · ${review.rating}/5`} />}
    />
  );
}

function ReviewTabs({ status, onChange }: { status: ReviewRow["status"]; onChange: (status: "pending" | "published" | "rejected") => void }) {
  const options = [
    { id: "pending" as const, label: "ממתינות" },
    { id: "published" as const, label: "פורסמו" },
    { id: "rejected" as const, label: "נדחו" },
  ];
  return (
    <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 12 }}>
      {options.map((option) => (
        <Pressable key={option.id} onPress={() => onChange(option.id)} style={{ height: 32, borderRadius: 8, paddingHorizontal: 12, justifyContent: "center", backgroundColor: status === option.id ? tokens.inkStrong : tokens.card, borderWidth: 1, borderColor: tokens.line }}>
          <AppText style={{ color: status === option.id ? "#fff" : tokens.ink, fontSize: 13 }}>{option.label}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

function GiftCards() {
  const router = useRouter();
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const { query, setQuery } = useQueryState();
  const rows = snapshot?.giftCards;
  const visible = (rows ?? []).filter((card) => match(query, `${card.code} ${card.customer ?? ""}`));
  return (
    <BrowseList
      query={query}
      onQuery={setQuery}
      placeholder="חיפוש כרטיסים"
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      error={error}
      data={rows ? visible : []}
      empty={rows ? "אין כרטיסי מתנה עדיין" : "הסנאפשוט לא כולל כרטיסי מתנה."}
      keyExtractor={(card) => card.code}
      onPress={(card) => router.push(href("gift-cards", card.code))}
      renderItem={(card) => <Line title={card.code} meta={[card.balance != null ? formatIls(card.balance) : "", card.customer].filter(Boolean).join(" · ")} />}
    />
  );
}

function Segments() {
  const router = useRouter();
  const fonts = useFontSet();
  const { snapshot, loading, error, refreshing, refresh } = useStoreData();
  const customers = snapshot?.customers;
  const orders = snapshot?.orders;
  const stats = useMemo(() => (orders ? orderStats(orders) : null), [orders]);
  const counts = useMemo(() => {
    if (!customers || !stats) return null;
    return new Map(SEGMENTS.map((segment) => [segment.id, customers.filter((customer) => inSegment(segment, customer, stats)).length]));
  }, [customers, stats]);
  return (
    <BrowseList
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      error={error}
      data={customers ? [...SEGMENTS] : []}
      empty={customers ? "אין פלחים" : "הסנאפשוט לא כולל לקוחות."}
      keyExtractor={(item) => item.id}
      onPress={(item) => router.push(href("segments", item.id))}
      renderItem={(item) => {
        const count = counts?.get(item.id);
        const share = count != null && customers?.length ? Math.round((count / customers.length) * 100) : null;
        const size = count == null ? "" : share != null && count > 0 ? `${customerCountLabel(count)} · ${share}% מהלקוחות` : customerCountLabel(count);
        return (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1, gap: 3 }}>
              <AppText style={{ fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong }} numberOfLines={1}>{item.name}</AppText>
              {size ? <AppText style={{ fontSize: 14, color: tokens.ink }}>{size}</AppText> : null}
              <AppText style={{ fontSize: 13, color: tokens.inkSecondary }} numberOfLines={2}>{segmentRule(item)}</AppText>
            </View>
            <Icon name="forward" size={16} color="#b5b5b5" strokeWidth={2} />
          </View>
        );
      }}
    />
  );
}

function Channels({ mode }: { mode: "growth" | "attribution" }) {
  const remote = useStoreCall(loadAttribution);
  const rows = [...(remote.data ?? [])].sort((a, b) => mode === "growth" ? b.sales - a.sales : b.visits - a.visits);
  const sales = rows.reduce((sum, row) => sum + row.sales, 0);
  const orders = rows.reduce((sum, row) => sum + row.orders, 0);
  const visits = rows.reduce((sum, row) => sum + row.visits, 0);
  return (
    <BrowseList
      loading={remote.loading}
      refreshing={remote.refreshing}
      onRefresh={() => void remote.refresh()}
      error={remote.error}
      data={rows}
      empty="אין ערוצי ייחוס עדיין"
      keyExtractor={(row) => `${row.channel}-${row.type}`}
      header={remote.data ? <Line title={formatIls(sales)} meta={`${formatCount(orders)} הזמנות · ${formatCount(visits)} ביקורים`} /> : undefined}
      renderItem={(row) => <Line title={row.channel} meta={`${formatCount(row.visits)} ביקורים · ${formatCount(row.orders)} הזמנות · ${formatIls(row.sales)}`} />}
    />
  );
}

function Integrations() {
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const connected = new Set(snapshot?.marketing?.connected ?? []);
  const present = snapshot?.marketing?.connected;
  return (
    <BrowseList
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      error={error}
      data={present ? [...INTEGRATIONS] : []}
      empty={present ? "אין אינטגרציות" : "הסנאפשוט לא כולל אינטגרציות."}
      keyExtractor={(item) => item.key}
      renderItem={(item) => <Line title={item.name} meta={connected.has(item.key) ? `מחובר · ${item.detail}` : item.detail} />}
    />
  );
}

function Messages() {
  const router = useRouter();
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const { query, setQuery } = useQueryState();
  const marketing = snapshot?.marketing;
  const emails = marketing?.emails;
  const sms = marketing?.sms;
  const rows = [
    ...(emails ?? []).map((item) => ({ id: `email:${item.id}`, title: item.name || item.subject || "מייל", meta: item.subject })),
    ...(sms ?? []).map((item) => ({ id: `sms:${item.id}`, title: item.name || "SMS", meta: item.text })),
  ].filter((item) => match(query, `${item.title} ${item.meta ?? ""}`));
  const missing = !marketing || (emails == null && sms == null);
  return (
    <BrowseList
      query={query}
      onQuery={setQuery}
      placeholder="חיפוש הודעות"
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      error={error}
      data={missing ? [] : rows}
      empty={missing ? "הסנאפשוט לא כולל מיילים ו-SMS." : "אין הודעות עדיין"}
      keyExtractor={(item) => item.id}
      onPress={(item) => router.push(href("messages", item.id))}
      renderItem={(item) => <Line title={item.title} meta={item.meta} />}
    />
  );
}

function Automations() {
  const router = useRouter();
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const rows = snapshot?.marketing?.flows;
  return (
    <BrowseList
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      error={error}
      data={rows ?? []}
      empty={rows ? "אין אוטומציות עדיין" : "הסנאפשוט לא כולל אוטומציות."}
      keyExtractor={(item) => item.id}
      onPress={(item) => router.push(href("automations", item.id))}
      renderItem={(item) => <Line title={item.name} meta={[item.trigger, item.on === false ? "כבויה" : item.on ? "פעילה" : ""].filter(Boolean).join(" · ")} />}
    />
  );
}

function Campaigns() {
  const router = useRouter();
  const remote = useStoreCall(loadCampaigns);
  return (
    <BrowseList
      loading={remote.loading}
      refreshing={remote.refreshing}
      onRefresh={() => void remote.refresh()}
      error={remote.error}
      data={remote.data ?? []}
      empty="אין קמפיינים עדיין"
      keyExtractor={(item) => item.id}
      onPress={(item) => router.push(href("campaigns", item.id))}
      renderItem={(item) => <Line title={item.name} meta={[campaignStatus(item.status), item.audience].filter(Boolean).join(" · ")} />}
    />
  );
}

function campaignStatus(status: string) {
  if (status === "scheduled") return "מתוזמן";
  if (status === "cancelled") return "בוטל";
  if (status === "sending" || status === "sent") return "שליחה חסומה";
  if (status === "draft") return "טיוטה";
  return status;
}

function Popups() {
  return <PopupsHome />;
}

function Posts() {
  const fonts = useFontSet();
  const router = useRouter();
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const { query, setQuery } = useQueryState();
  const [tab, setTab] = useState<"all" | "visible" | "hidden">("all");
  const rows = snapshot?.posts;
  const visible = (rows ?? []).filter((post) => {
    if (tab === "visible" && post.visible === false) return false;
    if (tab === "hidden" && post.visible !== false) return false;
    return match(query, `${post.title ?? ""} ${post.excerpt ?? ""} ${post.author ?? ""} ${post.blog ?? ""}`);
  });
  return (
    <BrowseList
      query={query}
      onQuery={setQuery}
      placeholder="חיפוש פוסטים"
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      error={error}
      data={rows ? visible : []}
      empty={!rows ? "הסנאפשוט לא כולל פוסטים." : tab === "all" ? "אין פוסטים עדיין. לחצו על + כדי לכתוב פוסט." : "אין פוסטים בסינון הזה"}
      keyExtractor={(post) => post.id}
      onPress={(post) => router.push(href("posts", post.id))}
      header={<Chips items={[{ id: "all", label: "הכל" }, { id: "visible", label: "גלוי" }, { id: "hidden", label: "מוסתר" }]} value={tab} onChange={setTab} />}
      renderItem={(post) => {
        const shown = post.visible !== false;
        return (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Thumb uri={post.image?.startsWith("https://") ? post.image : undefined} size={52} />
            <View style={{ flex: 1, gap: 3 }}>
              <AppText style={{ fontFamily: fonts.semibold, fontSize: 16, color: tokens.inkStrong }} numberOfLines={1}>{post.title || "פוסט"}</AppText>
              {post.excerpt ? <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }} numberOfLines={2}>{post.excerpt}</AppText> : null}
              {post.blog ? <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }} numberOfLines={1}>{post.blog}</AppText> : null}
            </View>
            <Badge label={shown ? "גלוי" : "מוסתר"} background={shown ? "#cdfee1" : "#e3e3e3"} color={shown ? "#0c5132" : "#616161"} />
          </View>
        );
      }}
    />
  );
}

function Events() {
  const fonts = useFontSet();
  const router = useRouter();
  const remote = useStoreCall(loadEvents);
  const refreshEvents = remote.refresh;
  const { query, setQuery } = useQueryState();
  const [tab, setTab] = useState<"all" | "draft" | "open" | "ended">("all");
  const opened = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!opened.current) {
      opened.current = true;
      return;
    }
    void refreshEvents();
  }, [refreshEvents]));
  const rows = (remote.data ?? []).filter((item) => {
    if (tab === "draft" && item.status !== "draft") return false;
    if (tab === "open" && item.status !== "open" && item.status !== "full") return false;
    if (tab === "ended" && item.status !== "ended" && item.status !== "cancelled") return false;
    return match(query, `${item.title} ${item.short} ${item.date}`);
  });
  return (
    <BrowseList
      query={query}
      onQuery={setQuery}
      placeholder="חיפוש אירועים"
      loading={remote.loading}
      refreshing={remote.refreshing}
      onRefresh={() => void remote.refresh()}
      error={remote.error}
      data={remote.data ? rows : []}
      empty={tab === "all" ? "אין אירועים עדיין. לחצו על + כדי להוסיף אירוע." : "אין אירועים בסינון הזה"}
      keyExtractor={(item) => item.id}
      onPress={(item) => router.push(href("events", item.id))}
      header={<Chips items={[{ id: "all", label: "הכל" }, { id: "open", label: "פתוח" }, { id: "draft", label: "טיוטה" }, { id: "ended", label: "הסתיים" }]} value={tab} onChange={setTab} />}
      renderItem={(item) => {
        const badge = eventBadge(item.status);
        const when = [item.date.split("-").reverse().join("."), item.price > 0 ? `₪${item.price}` : "חינם"].filter(Boolean).join(" · ");
        return (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Thumb uri={item.image || undefined} size={52} />
            <View style={{ flex: 1, gap: 3 }}>
              <AppText style={{ fontFamily: fonts.semibold, fontSize: 16, color: tokens.inkStrong }} numberOfLines={1}>{item.title}</AppText>
              <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }} numberOfLines={1}>{when}</AppText>
            </View>
            <Badge label={badge.label} background={badge.background} color={badge.color} />
          </View>
        );
      }}
    />
  );
}

function eventBadge(status: string) {
  if (status === "open") return { label: "פתוח", background: "#e3f1df", color: "#0c5132" };
  if (status === "full") return { label: "מלא", background: "#fff1e3", color: "#5e4200" };
  if (status === "cancelled") return { label: "בוטל", background: "#fde8e6", color: "#8a1f11" };
  if (status === "ended") return { label: "הסתיים", background: "#f1f1f1", color: "#4a4a4a" };
  return { label: status === "draft" ? "טיוטה" : status || "טיוטה", background: "#f1f1f1", color: "#4a4a4a" };
}

function StoreLink() {
  const { snapshot, loading, error } = useStoreData();
  const host = snapshot?.hostname?.trim();
  const url = host ? (host.startsWith("http") ? host : `https://${host}`) : "";
  return (
    <BrowseList
      loading={loading}
      error={error}
      data={url ? [{ id: url, title: host ?? url }] : []}
      empty={snapshot ? "הסנאפשוט לא כולל כתובת לחנות." : "טוען…"}
      keyExtractor={(item) => item.id}
      onPress={(item) => void import("react-native").then(({ Linking }) => Linking.openURL(item.id))}
      renderItem={(item) => <Line title="פתיחת החנות" meta={item.title} />}
    />
  );
}

function General() {
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const contact = snapshot?.shipping?.contact;
  const rows = [
    snapshot?.name ? { id: "name", title: "שם החנות", meta: snapshot.name } : null,
    snapshot?.hostname ? { id: "host", title: "כתובת", meta: snapshot.hostname } : null,
    snapshot?.currency ? { id: "currency", title: "מטבע", meta: snapshot.currency } : null,
    contact?.email ? { id: "email", title: "אימייל", meta: contact.email } : null,
    contact?.phone ? { id: "phone", title: "טלפון", meta: contact.phone } : null,
    contact?.city ? { id: "city", title: "עיר", meta: [contact.street, contact.city].filter(Boolean).join(", ") } : null,
  ].filter((item): item is { id: string; title: string; meta: string } => Boolean(item));
  return (
    <BrowseList
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      error={error}
      data={rows}
      empty="אין פרטים כלליים בסנאפשוט."
      keyExtractor={(item) => item.id}
      renderItem={(item) => <Line title={item.title} meta={item.meta} />}
    />
  );
}

function Shipping() {
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const shipping = snapshot?.shipping;
  const rows = [
    ...(shipping?.profiles ?? []).map((profile) => ({ id: profile.id, title: profile.name || "פרופיל משלוח", meta: "פרופיל" })),
    ...(shipping?.rules ?? []).map((rule) => ({ id: rule.id, title: rule.name || "כלל החזרה", meta: [rule.days, rule.fee].filter(Boolean).join(" · ") })),
    shipping?.localDelivery != null ? { id: "local", title: "משלוח מקומי", meta: shipping.localDelivery ? "פעיל" : "כבוי" } : null,
    shipping?.pickup != null ? { id: "pickup", title: "איסוף עצמי", meta: shipping.pickup ? "פעיל" : "כבוי" } : null,
    shipping?.estimates != null ? { id: "estimates", title: "הערכת זמני משלוח", meta: shipping.estimates ? "פעילה" : "כבויה" } : null,
  ].filter((item): item is { id: string; title: string; meta: string } => Boolean(item));
  return (
    <BrowseList
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      error={error}
      data={shipping ? rows : []}
      empty={shipping ? "אין הגדרות משלוח עדיין" : "הסנאפשוט לא כולל משלוחים."}
      keyExtractor={(item) => item.id}
      renderItem={(item) => <Line title={item.title} meta={item.meta} />}
    />
  );
}

function Policies() {
  const router = useRouter();
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const rows = snapshot?.policies;
  return (
    <BrowseList
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      error={error}
      data={rows ?? []}
      empty={rows ? "אין פוליסות עדיין" : "הסנאפשוט לא כולל פוליסות."}
      keyExtractor={(item) => item.id}
      onPress={(item) => router.push(href("policies", item.id))}
      renderItem={(item) => <Line title={item.title} />}
    />
  );
}

function Users() {
  const fonts = useFontSet();
  const router = useRouter();
  const remote = useStoreCall(loadUsers);
  return (
    <BrowseList
      loading={remote.loading}
      refreshing={remote.refreshing}
      onRefresh={() => void remote.refresh()}
      error={remote.error}
      data={remote.data ?? []}
      empty="אין משתמשים"
      keyExtractor={(user) => user.userId}
      onPress={(user) => router.push(href("users", user.userId))}
      header={(
        <Pressable onPress={() => router.push(href("users", "new"))} style={{ marginHorizontal: 12, marginBottom: 8, height: 44, borderRadius: 8, backgroundColor: tokens.inkStrong, alignItems: "center", justifyContent: "center" }}>
          <AppText style={{ color: "#fff", fontFamily: fonts.semibold }}>הוספת משתמש</AppText>
        </Pressable>
      )}
      renderItem={(user) => <Line title={user.name} meta={[user.roleName, user.status === "active" ? "פעיל" : user.status].filter(Boolean).join(" · ")} />}
    />
  );
}

function Connections() {
  const remote = useStoreCall(loadConnections);
  const [busy, setBusy] = useState("");
  const [problem, setProblem] = useState("");
  const rows = useMemo(() => remote.data ?? [], [remote.data]);
  return (
    <BrowseList
      loading={remote.loading}
      refreshing={remote.refreshing}
      onRefresh={() => void remote.refresh()}
      error={remote.error || problem}
      data={rows}
      empty="אין חיבורי AI עדיין"
      keyExtractor={(item) => item.id}
      onPress={(item) => {
        if (!remote.storeId || busy) return;
        Alert.alert("ביטול חיבור", item.name, [
          { text: "השארה", style: "cancel" },
          {
            text: "ביטול החיבור",
            style: "destructive",
            onPress: () => {
              const storeId = remote.storeId;
              if (!storeId) return;
              setBusy(item.id);
              setProblem("");
              void revokeConnection(storeId, item.id)
                .then(() => remote.refresh())
                .catch((caught: unknown) => setProblem(caught instanceof Error ? caught.message : "לא הצלחנו לבטל את החיבור."))
                .finally(() => setBusy(""));
            },
          },
        ]);
      }}
      renderItem={(item) => <Line title={item.name} meta={busy === item.id ? "מבטל…" : "ביטול חיבור"} />}
    />
  );
}
