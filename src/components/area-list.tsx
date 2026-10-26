import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { BrowseList } from "@/components/browse";
import { LiveView } from "@/components/live-view";
import { AppText } from "@/components/ui";
import { formatCount, formatIls, hebrewWhen } from "@/lib/format";
import { INTEGRATIONS, SEGMENTS, type AreaKey } from "@/lib/menu";
import { PAY_BADGE, knownBadge } from "@/lib/orders";
import { REPORTS } from "@/lib/reports";
import {
  loadAttribution,
  loadCampaigns,
  loadConnections,
  loadEvents,
  loadPopups,
  loadReviews,
  loadTraffic,
  loadUsers,
  revokeConnection,
  useStoreCall,
  type ReviewRow,
} from "@/lib/remote";
import { useStoreData } from "@/lib/store-data";
import type { OrderRecord } from "@/lib/snapshot";
import { useFontSet } from "@/theme/fonts";
import { tokens } from "@/theme/tokens";

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
  if (area === "analytics") return <Traffic />;
  if (area === "reports") return <Reports />;
  if (area === "store") return <StoreLink />;
  if (area === "general") return <General />;
  if (area === "shipping") return <Shipping />;
  if (area === "policies") return <Policies />;
  if (area === "users") return <Users />;
  return <Connections />;
}

function Returns() {
  const router = useRouter();
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const { query, setQuery } = useQueryState();
  const orders = snapshot?.orders;
  const rows = (orders ?? []).filter((order) => order.pay === "refunded" || order.pay === "partially_refunded" || (order.refunded != null && order.refunded > 0));
  const visible = rows.filter((order) => match(query, `${order.number} ${order.customerName ?? ""}`));
  return (
    <BrowseList
      query={query}
      onQuery={setQuery}
      placeholder="חיפוש החזרות"
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      error={error}
      data={orders ? visible : []}
      empty={orders ? "אין החזרות עדיין" : "הסנאפשוט לא כולל הזמנות."}
      keyExtractor={(order) => String(order.number)}
      onPress={(order) => router.push(`/orders/${order.number}` as Href)}
      renderItem={(order) => <Line title={`הזמנה ${order.number}`} meta={returnMeta(order)} />}
    />
  );
}

function returnMeta(order: OrderRecord) {
  const pay = knownBadge(PAY_BADGE, order.pay)?.label;
  const amount = order.refunded != null ? formatIls(order.refunded) : order.total != null ? formatIls(order.total) : "";
  return [order.customerName, pay, amount].filter(Boolean).join(" · ");
}

function Abandoned() {
  const router = useRouter();
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const { query, setQuery } = useQueryState();
  const rows = snapshot?.checkouts;
  const visible = (rows ?? []).filter((item) => match(query, `${item.name ?? ""} ${item.email ?? ""} ${item.phone ?? ""}`));
  return (
    <BrowseList
      query={query}
      onQuery={setQuery}
      placeholder="חיפוש עגלות"
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      error={error}
      data={rows ? visible : []}
      empty={rows ? "אין עגלות נטושות עדיין" : "הסנאפשוט לא כולל עגלות נטושות."}
      keyExtractor={(item) => item.id}
      onPress={(item) => router.push(href("abandoned", item.id))}
      renderItem={(item) => <Line title={item.name || item.email || "עגלה"} meta={[hebrewWhen(item.updatedAt), item.total != null ? formatIls(item.total) : "", item.recovered ? "שוחזרה" : ""].filter(Boolean).join(" · ")} />}
    />
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
  const { snapshot, loading, error, refreshing, refresh } = useStoreData();
  return (
    <BrowseList
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      error={error}
      data={snapshot?.customers ? [...SEGMENTS] : []}
      empty={snapshot?.customers ? "אין פלחים" : "הסנאפשוט לא כולל לקוחות."}
      keyExtractor={(item) => item.id}
      onPress={(item) => router.push(href("segments", item.id))}
      renderItem={(item) => <Line title={item.name} meta={item.subOnly ? "רק מנויים לדיוור" : `לפחות ${formatCount(item.minOrders)} הזמנות`} />}
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
  const router = useRouter();
  const remote = useStoreCall(loadPopups);
  return (
    <BrowseList
      loading={remote.loading}
      refreshing={remote.refreshing}
      onRefresh={() => void remote.refresh()}
      error={remote.error}
      data={remote.data ?? []}
      empty="אין פופאפים עדיין"
      keyExtractor={(item) => item.id}
      onPress={(item) => router.push(href("popups", item.id))}
      renderItem={(item) => <Line title={item.name} meta={[popupStatus(item.status), `${formatCount(item.leads)} לידים`].join(" · ")} />}
    />
  );
}

function popupStatus(status: string) {
  if (status === "active") return "פעיל";
  if (status === "paused") return "מושהה";
  if (status === "draft") return "טיוטה";
  return status;
}

function Posts() {
  const router = useRouter();
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const { query, setQuery } = useQueryState();
  const rows = snapshot?.posts;
  const visible = (rows ?? []).filter((post) => match(query, `${post.title ?? ""} ${post.excerpt ?? ""}`));
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
      empty={rows ? "אין פוסטים עדיין" : "הסנאפשוט לא כולל פוסטים."}
      keyExtractor={(post) => post.id}
      onPress={(post) => router.push(href("posts", post.id))}
      renderItem={(post) => <Line title={post.title || "פוסט"} meta={[post.blog, post.visible === false ? "מוסתר" : ""].filter(Boolean).join(" · ")} />}
    />
  );
}

function Events() {
  const router = useRouter();
  const remote = useStoreCall(loadEvents);
  return (
    <BrowseList
      loading={remote.loading}
      refreshing={remote.refreshing}
      onRefresh={() => void remote.refresh()}
      error={remote.error}
      data={remote.data ?? []}
      empty="אין אירועים עדיין"
      keyExtractor={(item) => item.id}
      onPress={(item) => router.push(href("events", item.id))}
      renderItem={(item) => <Line title={item.title} meta={[item.date, eventStatus(item.status)].filter(Boolean).join(" · ")} />}
    />
  );
}

function eventStatus(status: string) {
  if (status === "open") return "פתוח";
  if (status === "full") return "מלא";
  if (status === "ended") return "הסתיים";
  if (status === "cancelled") return "בוטל";
  if (status === "draft") return "טיוטה";
  return status;
}

function Traffic() {
  const remote = useStoreCall(loadTraffic);
  const traffic = remote.data;
  const rows = traffic ? [
    { id: "visitors", title: "מבקרים כעת", meta: formatCount(traffic.now.visitors) },
    { id: "visits", title: "ביקורים היום", meta: formatCount(traffic.today.visits) },
    { id: "orders", title: "הזמנות היום", meta: formatCount(traffic.today.orders) },
    { id: "sales", title: "מכירות היום", meta: formatIls(traffic.today.sales) },
    { id: "carts", title: "עגלות", meta: formatCount(traffic.now.carts) },
    { id: "checkouts", title: "הגיעו לקופה", meta: formatCount(traffic.now.checkouts) },
    { id: "purchased", title: "רכשו", meta: formatCount(traffic.now.purchased) },
    ...traffic.now.locations.map((place) => ({ id: place.label, title: place.label, meta: formatCount(place.count) })),
  ] : [];
  return (
    <BrowseList
      loading={remote.loading}
      refreshing={remote.refreshing}
      onRefresh={() => void remote.refresh()}
      error={remote.error}
      data={rows}
      empty="אין נתוני תנועה"
      keyExtractor={(item) => item.id}
      renderItem={(item) => <Line title={item.title} meta={item.meta} />}
    />
  );
}

function Reports() {
  const router = useRouter();
  const { query, setQuery } = useQueryState();
  const rows = REPORTS.filter((report) => match(query, `${report.name} ${report.category}`));
  return (
    <BrowseList
      query={query}
      onQuery={setQuery}
      placeholder="חיפוש דוחות"
      data={[...rows]}
      empty="אין דוחות"
      keyExtractor={(report) => report.id}
      onPress={(report) => router.push(href("reports", report.id))}
      renderItem={(report) => <Line title={report.name} meta={report.category} />}
    />
  );
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
