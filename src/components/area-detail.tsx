import { useCallback, useMemo, useState, type ReactNode } from "react";
import { FlatList, Linking, Pressable, ScrollView, Share, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { FactList } from "@/components/browse";
import { PolicyEditor, ShippingEditor, UserEditor } from "@/components/settings";
import { Icon } from "@/components/icon";
import { CustomerRow } from "@/components/rows";
import { SearchBar, Thumb } from "@/components/shell";
import { AppText, Badge, EmptyState, ErrorNote, LoadingBlock, PrimaryButton } from "@/components/ui";
import { checkoutLabel, formatCount, formatIls, hebrewDate, hebrewWhen } from "@/lib/format";
import { SEGMENTS, type AreaKey } from "@/lib/menu";
import { ReportView } from "@/components/analytics";
import { AutomationView, MessageView } from "@/components/marketing-screens";
import {
  decideReview,
  loadReviews,
  useStoreCall,
} from "@/lib/remote";
import { inSegment, orderStats, segmentRule } from "@/lib/segments";
import { type OrderLine, type ProductRecord } from "@/lib/snapshot";
import { useAllowed, useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { TAB_SPACE, tokens } from "@/theme/tokens";

function Page({ children }: { children: ReactNode }) {
  return <ScrollView style={{ flex: 1, backgroundColor: tokens.card }} contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: TAB_SPACE + 20 }}>{children}</ScrollView>;
}

export function AreaDetail({ area, id }: { area: AreaKey; id: string }) {
  if (area === "abandoned") return <CheckoutDetail id={id} />;
  if (area === "gift-cards") return <GiftDetail id={id} />;
  if (area === "segments") return <SegmentDetail id={id} />;
  if (area === "messages") return <MessageView id={id} />;
  if (area === "automations") return <AutomationView id={id} />;
  if (area === "policies") return <PolicyEditor id={id} />;
  if (area === "shipping") return <ShippingEditor id={id} />;
  if (area === "reviews") return <ReviewDetail id={id} />;
  if (area === "reports") return <ReportView id={id} />;
  if (area === "users") return <UserEditor id={id} />;
  return <EmptyState text="אין פרטים למסך הזה." />;
}

function sameProduct(title: string, name: string) {
  return title === name || title.startsWith(`${name}-`) || title.startsWith(`${name} `) || title.startsWith(`${name}|`);
}

function checkoutProduct(products: ProductRecord[] | undefined, line: OrderLine) {
  if (!products?.length) return undefined;
  const byId = line.productId ? products.find((product) => product.id === line.productId) : undefined;
  if (byId?.media?.[0]) return byId;
  const title = line.title?.trim() ?? "";
  if (!title) return byId;
  const byTitle = products
    .filter((product) => {
      const name = product.title?.trim() ?? "";
      return name.length > 0 && sameProduct(title, name);
    })
    .sort((left, right) => (right.title?.length ?? 0) - (left.title?.length ?? 0))[0];
  return byTitle ?? byId;
}

const checkoutKey = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function recoveryLink(hostname: string | undefined, checkoutId: string) {
  const host = (hostname ?? "").trim().replace(/^https?:\/\//i, "").split("/")[0]?.trim() ?? "";
  if (!host || !checkoutKey.test(checkoutId)) return "";
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) || host.endsWith(".localhost");
  return `${local ? "http" : "https"}://${host}/checkout?recover=${checkoutId}`;
}

function CheckoutDetail({ id }: { id: string }) {
  const fonts = useFontSet();
  const router = useRouter();
  const { snapshot, loading } = useStoreData();
  const [copied, setCopied] = useState("");
  if (loading) return <LoadingBlock />;
  const item = snapshot?.checkouts?.find((checkout) => checkout.id === id);
  if (!item) return <EmptyState text="העגלה לא נמצאה." />;
  const products = snapshot?.products;
  const email = item.email?.trim() ?? "";
  const person = email ? snapshot?.customers?.find((customer) => customer.email?.trim().toLowerCase() === email.toLowerCase()) : undefined;
  const count = (item.lines ?? []).reduce((sum, line) => sum + (line.quantity ?? 1), 0);
  const items = !item.lines ? "" : count === 1 ? "פריט אחד" : `${formatCount(count)} פריטים`;
  const priced = (item.lines ?? []).filter((line) => line.unitPrice != null);
  const fromLines = priced.length ? priced.reduce((sum, line) => sum + (line.unitPrice ?? 0) * (line.quantity ?? 1), 0) : undefined;
  const subtotal = item.subtotal ?? fromLines;
  const address = [item.name, item.street, [item.city, item.zip].filter(Boolean).join(" "), item.city || item.street ? "ישראל" : "", item.phone].filter(Boolean);
  const when = hebrewDate(item.updatedAt);
  const link = recoveryLink(snapshot?.hostname, item.id);

  async function copy(value: string, key: string) {
    await Clipboard.setStringAsync(value);
    setCopied(key);
    setTimeout(() => setCopied((current) => (current === key ? "" : current)), 1200);
  }

  async function sendLink() {
    if (!link) return;
    try {
      await Share.share({ message: `אפשר להמשיך את ההזמנה מכאן:\n${link}` });
    } catch {
      // The share sheet closes when the merchant dismisses it.
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: tokens.field }} contentContainerStyle={{ paddingBottom: TAB_SPACE + 24, gap: 8 }}>
      {!item.recovered ? (
        <View style={{ marginHorizontal: 12, marginTop: 12, borderRadius: 14, backgroundColor: "#d8f3fb", padding: 14, gap: 10 }}>
          <AppText style={{ fontSize: 15, color: "#0b3b4b" }}>שלחו ללקוח את הקישור הזה כדי לשחזר את העגלה</AppText>
          {link ? (
            <View style={{ minHeight: 40, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.6)", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <AppText style={{ flex: 1, fontSize: 14, color: "#0b3b4b", writingDirection: "ltr" }} numberOfLines={1}>{link}</AppText>
              <Pressable accessibilityLabel="העתקת קישור" hitSlop={6} onPress={() => void copy(link, "link")}>
                <Icon name={copied === "link" ? "check" : "copy"} size={16} color="#0b3b4b" strokeWidth={1.7} />
              </Pressable>
            </View>
          ) : (
            <AppText style={{ fontSize: 14, color: "#0b3b4b" }}>לחנות עדיין אין כתובת, אז אין קישור לשלוח.</AppText>
          )}
          {link ? (
            <Pressable
              accessibilityLabel="שליחת קישור ללקוח"
              onPress={() => void sendLink()}
              style={({ pressed }) => ({ alignSelf: "flex-start", height: 32, borderRadius: 10, backgroundColor: pressed ? "#93dbf0" : "#a8e4f5", paddingHorizontal: 12, justifyContent: "center" })}
            >
              <AppText style={{ fontFamily: fonts.semibold, fontSize: 14, color: "#0b3b4b" }}>שליחת קישור ללקוח</AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={{ backgroundColor: tokens.card, paddingHorizontal: 16, paddingVertical: 16, gap: 8 }}>
        <AppText style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, color: tokens.inkStrong, writingDirection: "ltr" }}>{checkoutLabel(item.id)}</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Badge label={item.recovered ? "שוחזרה" : "לא שוחזרה"} background={item.recovered ? "#cdfee1" : "#ffd6a4"} color={item.recovered ? "#0c5132" : "#5e4200"} />
          <Badge label={item.reminded ? "נשלח מייל" : "המייל לא נשלח"} background={item.reminded ? "#e0f0ff" : "#ffd6a4"} color={item.reminded ? "#00527c" : "#5e4200"} />
        </View>
        {when ? <AppText style={{ fontSize: 14, color: tokens.inkSecondary }}>{`ישראל, ${when}`}</AppText> : null}
      </View>

      <View style={{ backgroundColor: tokens.card, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
        <AppText style={{ fontFamily: fonts.semibold, fontSize: 16, color: tokens.inkStrong, paddingBottom: 8 }}>פרטי העגלה</AppText>
        {(item.lines ?? []).map((line, index) => {
          const product = checkoutProduct(products, line);
          return (
            <CheckoutLine
              key={`${line.productId ?? line.title ?? "line"}-${index}`}
              line={line}
              image={product?.media?.[0]}
              onPress={product ? () => router.push(`/products/${product.id}` as Href) : undefined}
            />
          );
        })}
        {!item.lines?.length ? <EmptyState text="אין פריטים בעגלה." /> : null}
        <View style={{ paddingTop: 12, gap: 6 }}>
          <MoneyLine label="סכום ביניים" detail={items} value={subtotal != null ? formatIls(subtotal) : "—"} />
          <MoneyLine label="משלוח" value={item.shippingAmount != null ? formatIls(item.shippingAmount) : "—"} />
          <MoneyLine label="סה״כ" value={item.total != null ? formatIls(item.total) : "—"} strong />
        </View>
        <View style={{ marginTop: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: tokens.line, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <AppText style={{ flex: 1, fontSize: 15, color: tokens.inkStrong }}>לתשלום על ידי הלקוח</AppText>
          <AppText style={{ fontFamily: fonts.semibold, fontSize: 15, color: tokens.inkStrong, writingDirection: "ltr" }}>{item.total != null ? formatIls(item.total) : "—"}</AppText>
        </View>
      </View>

      <View style={{ backgroundColor: tokens.card, paddingHorizontal: 16, paddingVertical: 16, gap: 16 }}>
        <View style={{ gap: 4 }}>
          <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>לקוח</AppText>
          {person ? (
            <Pressable onPress={() => router.push(`/customers/${person.id}` as Href)}>
              <AppText style={{ fontSize: 16, color: tokens.link, textDecorationLine: "underline" }}>{item.name || person.name || email}</AppText>
            </Pressable>
          ) : (
            <AppText style={{ fontSize: 16, color: tokens.inkStrong }}>{item.name || "ללא שם"}</AppText>
          )}
          <AppText style={{ fontSize: 14, color: tokens.inkSecondary }}>{person?.orders ? (person.orders === 1 ? "הזמנה אחת" : `${formatCount(person.orders)} הזמנות`) : "אין הזמנות"}</AppText>
        </View>

        <View style={{ gap: 4 }}>
          <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>פרטי קשר</AppText>
          {email ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable style={{ flex: 1 }} onPress={() => void Linking.openURL(`mailto:${email}`)}>
                <AppText style={{ fontSize: 16, color: tokens.link, writingDirection: "ltr" }} numberOfLines={1}>{email}</AppText>
              </Pressable>
              <Pressable accessibilityLabel="העתקת אימייל" hitSlop={6} onPress={() => void copy(email, "email")}>
                <Icon name={copied === "email" ? "check" : "copy"} size={16} color={tokens.inkSecondary} strokeWidth={1.7} />
              </Pressable>
            </View>
          ) : <AppText style={{ fontSize: 15, color: tokens.inkSecondary }}>אין אימייל</AppText>}
          {item.phone ? (
            <Pressable onPress={() => void Linking.openURL(`tel:${item.phone}`)}>
              <AppText style={{ fontSize: 15, color: tokens.inkStrong, writingDirection: "ltr" }}>{item.phone}</AppText>
            </Pressable>
          ) : null}
          <AppText style={{ fontSize: 14, color: tokens.inkSecondary }}>{person ? "לקוח רשום" : "אין חשבון"}</AppText>
        </View>

        {address.length ? (
          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <AppText style={{ flex: 1, fontSize: 13, color: tokens.inkSecondary }}>כתובת למשלוח</AppText>
              <Pressable accessibilityLabel="העתקת כתובת" hitSlop={6} onPress={() => void copy(address.join("\n"), "address")}>
                <Icon name={copied === "address" ? "check" : "copy"} size={16} color={tokens.inkSecondary} strokeWidth={1.7} />
              </Pressable>
            </View>
            {address.map((line) => <AppText key={line} style={{ fontSize: 15, color: tokens.inkStrong }}>{line}</AppText>)}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function CheckoutLine({ line, image, onPress }: { line: OrderLine; image?: string; onPress?: () => void }) {
  const fonts = useFontSet();
  const qty = line.quantity ?? 1;
  const each = line.unitPrice;
  const sum = each != null ? each * qty : undefined;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#f2f2f2" }}>
      <Thumb uri={image} size={44} />
      <View style={{ flex: 1, gap: 4 }}>
        <Pressable disabled={!onPress} onPress={onPress}>
          <AppText style={{ fontSize: 15, color: tokens.inkStrong, textDecorationLine: onPress ? "underline" : "none" }}>{line.title || "פריט"}</AppText>
        </Pressable>
        {line.variant ? (
          <View style={{ alignSelf: "flex-start", height: 22, borderRadius: 6, backgroundColor: tokens.neutralBg, paddingHorizontal: 8, justifyContent: "center" }}>
            <AppText style={{ fontSize: 12, color: tokens.inkStrong }}>{line.variant}</AppText>
          </View>
        ) : null}
        {each != null ? <AppText style={{ fontSize: 13, color: tokens.inkSecondary, writingDirection: "ltr" }}>{`${formatIls(each)} × ${formatCount(qty)}`}</AppText> : null}
      </View>
      {sum != null ? <AppText style={{ fontFamily: fonts.medium, fontSize: 15, color: tokens.inkStrong, writingDirection: "ltr" }}>{formatIls(sum)}</AppText> : null}
    </View>
  );
}

function MoneyLine({ label, detail, value, strong = false }: { label: string; detail?: string; value: string; strong?: boolean }) {
  const fonts = useFontSet();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 26 }}>
      <AppText style={{ width: 108, fontFamily: strong ? fonts.bold : fonts.regular, fontSize: 14, color: tokens.inkStrong }}>{label}</AppText>
      <AppText style={{ flex: 1, fontSize: 13, color: tokens.inkSecondary }} numberOfLines={2}>{detail ?? ""}</AppText>
      <AppText style={{ fontFamily: strong ? fonts.bold : fonts.regular, fontSize: 14, color: tokens.inkStrong, writingDirection: "ltr" }}>{value}</AppText>
    </View>
  );
}

function GiftDetail({ id }: { id: string }) {
  const { snapshot, loading } = useStoreData();
  if (loading) return <LoadingBlock />;
  const item = snapshot?.giftCards?.find((card) => card.code === id);
  if (!item) return <EmptyState text="הכרטיס לא נמצא." />;
  return (
    <Page>
      <FactList rows={[
        { label: "קוד", value: item.code },
        { label: "ערך", value: item.value != null ? formatIls(item.value) : undefined },
        { label: "יתרה", value: item.balance != null ? formatIls(item.balance) : undefined },
        { label: "לקוח", value: item.customer },
        { label: "תוקף", value: item.expires },
        { label: "הערה", value: item.note },
      ]} />
    </Page>
  );
}

function SegmentDetail({ id }: { id: string }) {
  const router = useRouter();
  const fonts = useFontSet();
  const { snapshot, loading } = useStoreData();
  const [query, setQuery] = useState("");
  const segment = SEGMENTS.find((item) => item.id === id);
  const customers = snapshot?.customers;
  const orders = snapshot?.orders;
  const stats = useMemo(() => orderStats(orders ?? []), [orders]);
  const members = useMemo(() => {
    if (!segment || !customers || !orders) return [];
    return customers.filter((customer) => inSegment(segment, customer, stats));
  }, [segment, customers, orders, stats]);
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((person) => `${person.name ?? ""} ${person.email ?? ""} ${person.phone ?? ""} ${person.city ?? ""}`.toLowerCase().includes(needle));
  }, [members, query]);
  if (loading) return <LoadingBlock />;
  if (!segment) return <EmptyState text="הפלח לא נמצא." />;
  if (!customers || !orders) return <EmptyState text="הסנאפשוט לא כולל את הלקוחות או ההזמנות של הפלח." />;
  const share = customers.length ? Math.round((members.length / customers.length) * 100) : 0;
  return (
    <View style={{ flex: 1, backgroundColor: tokens.card }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 2, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <AppText style={{ fontFamily: fonts.bold, fontSize: 20, color: tokens.inkStrong }}>{formatCount(members.length)}</AppText>
          <AppText style={{ fontSize: 14, color: tokens.inkSecondary }}>{`${members.length === 1 ? "לקוח" : "לקוחות"} · ${share}%`}</AppText>
        </View>
        <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>{segmentRule(segment)}</AppText>
      </View>
      <SearchBar value={query} onChange={setQuery} placeholder="חיפוש בפלח" />
      <FlatList
        style={{ flex: 1, marginTop: 8 }}
        data={shown}
        keyExtractor={(person) => person.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: TAB_SPACE + 12 }}
        renderItem={({ item }) => (
          <CustomerRow person={item} spent={stats.get(item.id)?.spent ?? 0} onPress={() => router.push(`/customers/${item.id}` as Href)} />
        )}
        ListEmptyComponent={<EmptyState text={query.trim() ? "אין תוצאות לחיפוש" : "אף לקוח לא עונה על התנאים."} />}
      />
    </View>
  );
}

function ReviewDetail({ id }: { id: string }) {
  const canUpdate = useAllowed("products.update");
  const load = useCallback(async (storeId: string) => {
    for (const status of ["pending", "published", "rejected"] as const) {
      const rows = await loadReviews(storeId, status);
      const found = rows.find((review) => review.id === id);
      if (found) return found;
    }
    return null;
  }, [id]);
  const remote = useStoreCall(load);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  if (remote.loading) return <LoadingBlock />;
  if (remote.error) return <ErrorNote text={remote.error} />;
  const review = remote.data;
  if (!review) return <EmptyState text="הביקורת לא נמצאה." />;
  const current = review;
  const decide = async (decision: "approve" | "reject") => {
    if (!remote.storeId || busy) return;
    setBusy(true);
    setProblem("");
    try {
      await decideReview(remote.storeId, current.id, decision);
      await remote.refresh();
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : "לא הצלחנו לעדכן את הביקורת.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <FactList rows={[
        { label: "מוצר", value: review.productTitle },
        { label: "שם", value: review.name },
        { label: "דירוג", value: `${review.rating}/5` },
        { label: "תאריך", value: hebrewWhen(review.createdAt) },
        { label: "תוכן", value: review.body },
      ]} />
      {problem ? <ErrorNote text={problem} /> : null}
      {canUpdate && current.status === "pending" ? (
        <View style={{ gap: 8 }}>
          <PrimaryButton label="אישור הביקורת" disabled={busy} onPress={() => void decide("approve")} />
          <PrimaryButton label="דחיית הביקורת" disabled={busy} onPress={() => void decide("reject")} />
        </View>
      ) : null}
    </Page>
  );
}

