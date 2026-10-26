import { useState, type ReactNode } from "react";
import { Linking, Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Print from "expo-print";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/icon";
import { DetailHeader, RoundButton, SheetEmpty, Thumb } from "@/components/shell";
import { AppText, Badge, ErrorNote } from "@/components/ui";
import { formatCount, formatIls, hebrewDate, hebrewTime } from "@/lib/format";
import { CUSTOMER_STATUS_LABEL, FULFILLMENT_BADGE, ORDER_STATUS_ACTIONS, PAY_BADGE, knownBadge, statusAlreadyApplied, type OrderPatch } from "@/lib/orders";
import { isOpenOrder, productImage, type CustomerRecord, type OrderRecord, type ProductRecord } from "@/lib/snapshot";
import { useSession } from "@/lib/session";
import { useAllowed, useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { TAB_SPACE, tokens } from "@/theme/tokens";

type Action = { id: string; label: string; patch: OrderPatch };

const PAID: Action = { id: "paid", label: "סימון כשולמה", patch: { pay: "paid", comment: "ההזמנה סומנה כשולמה." } };
const GAP = 8;

function availableActions(order: OrderRecord): Action[] {
  const status = ORDER_STATUS_ACTIONS.filter((action) => !statusAlreadyApplied(order, action.patch));
  return order.pay === "pending" ? [...status, PAID] : status;
}

function primaryAction(order: OrderRecord, actions: Action[]) {
  const pick = (id: string) => actions.find((action) => action.id === id);
  if (order.fulfillment !== "fulfilled") return pick("sent") ?? actions[0];
  if (order.customerStatus === "sent") return pick("transit") ?? pick("delivered");
  if (order.customerStatus === "transit") return pick("delivered");
  return undefined;
}

function dayTitle(value: string | undefined) {
  if (!value) return "ללא תאריך";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "ללא תאריך";
  return new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", timeZone: "Asia/Jerusalem" }).format(date);
}

function orderOrdinal(order: OrderRecord, orders: OrderRecord[] | undefined) {
  if (!order.customerId || !orders) return undefined;
  const mine = orders
    .filter((item) => item.customerId === order.customerId)
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || a.number - b.number);
  const index = mine.findIndex((item) => item.number === order.number);
  if (index < 0) return undefined;
  return index === 0 ? "הזמנה ראשונה" : `הזמנה ${formatCount(index + 1)}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function slipHtml(order: OrderRecord, storeName: string, customer?: CustomerRecord) {
  const lines = (order.lines ?? []).map((line) => `
    <tr><td>${escapeHtml(line.title ?? "")}${line.variant ? `<div class="muted">${escapeHtml(line.variant)}</div>` : ""}${line.sku ? `<div class="muted">מק״ט: ${escapeHtml(line.sku)}</div>` : ""}</td>
    <td class="num">${line.quantity ?? 1}</td>
    <td class="num">${line.unitPrice != null ? escapeHtml(formatIls(line.unitPrice * (line.quantity ?? 1))) : ""}</td></tr>`).join("");
  const address = customer ? [customer.street, customer.city, customer.zip].filter(Boolean).map((part) => escapeHtml(String(part))).join("<br/>") : "";
  return `<html dir="rtl"><head><meta charset="utf-8"/><style>
    body{font-family:-apple-system,Arial,sans-serif;padding:24px;color:#303030}
    h1{font-size:22px;margin:0 0 4px} .muted{color:#616161;font-size:12px}
    table{width:100%;border-collapse:collapse;margin-top:16px} td,th{padding:8px 0;border-bottom:1px solid #e3e3e3;text-align:right;vertical-align:top}
    .num{text-align:left;white-space:nowrap} .total{font-weight:700;font-size:16px}
  </style></head><body>
    <div class="muted">${escapeHtml(storeName)}</div>
    <h1>הזמנה #${order.number}</h1>
    <div class="muted">${escapeHtml(hebrewDate(order.createdAt))}</div>
    ${order.customerName || address ? `<p><b>${escapeHtml(order.customerName ?? customer?.name ?? "")}</b><br/>${address}</p>` : ""}
    <table><tr><th>פריט</th><th class="num">כמות</th><th class="num">סכום</th></tr>${lines}</table>
    ${order.total != null ? `<p class="total">סה״כ: ${escapeHtml(formatIls(order.total))}</p>` : ""}
    ${order.note ? `<p class="muted">${escapeHtml(order.note)}</p>` : ""}
  </body></html>`;
}

export default function OrderScreen() {
  const fonts = useFontSet();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const number = Number(id);
  const allowed = useAllowed("orders.read");
  const canUpdate = useAllowed("orders.update");
  const { snapshot, error, updateOrder } = useStoreData();
  const { storeName } = useSession();
  const [pending, setPending] = useState("");
  const [actionError, setActionError] = useState("");
  const [menu, setMenu] = useState(false);
  const [compact, setCompact] = useState(false);
  const [comment, setComment] = useState("");
  const [copied, setCopied] = useState(false);
  const order = snapshot?.orders?.find((item) => item.number === number);

  async function apply(action: Action) {
    setMenu(false);
    setPending(action.id);
    setActionError("");
    const next = await updateOrder(number, action.patch);
    setPending("");
    if (next) setActionError(next);
  }

  async function sendComment() {
    const text = comment.trim();
    if (!text || pending) return;
    setPending("comment");
    setActionError("");
    const next = await updateOrder(number, { comment: text });
    setPending("");
    if (next) setActionError(next);
    else setComment("");
  }

  if (!allowed) return <Screen title="הזמנה"><SheetEmpty icon="orders" text="אין הרשאה למסך הזה." /></Screen>;
  if (!order) return <Screen title="הזמנה"><SheetEmpty icon="orders" text={error || "ההזמנה לא נמצאה."} /></Screen>;

  const current = order;
  const closed = Boolean(order.fulfillment) && !isOpenOrder(order);
  const fulfillment = knownBadge(FULFILLMENT_BADGE, order.fulfillment);
  const pay = knownBadge(PAY_BADGE, order.pay);
  const customerStatus = order.customerStatus ? CUSTOMER_STATUS_LABEL[order.customerStatus] ?? order.customerStatus : undefined;
  const actions = canUpdate ? availableActions(order) : [];
  const primary = primaryAction(order, actions);
  const itemCount = order.lines?.reduce((sum, line) => sum + (line.quantity ?? 1), 0) ?? 0;
  const subtotal = order.lines?.length ? order.lines.reduce((sum, line) => sum + (line.unitPrice ?? 0) * (line.quantity ?? 1), 0) : undefined;
  const customer = order.customerId ? snapshot?.customers?.find((person) => person.id === order.customerId) : undefined;
  const customerOrders = customer ? snapshot?.orders?.filter((item) => item.customerId === customer.id).length : undefined;
  const address = customer ? [customer.street, customer.city, customer.zip].filter((part): part is string => Boolean(part)) : [];
  const ordinal = orderOrdinal(order, snapshot?.orders);
  const timeline = [...(order.timeline ?? [])].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
  const days: { title: string; entries: typeof timeline }[] = [];
  for (const entry of timeline) {
    const title = dayTitle(entry.at);
    const last = days[days.length - 1];
    if (last && last.title === title) last.entries.push(entry);
    else days.push({ title, entries: [entry] });
  }

  async function copyAddress() {
    await Clipboard.setStringAsync([current.customerName ?? customer?.name, ...address].filter(Boolean).join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function print() {
    try {
      await Print.printAsync({ html: slipHtml(current, storeName, customer) });
    } catch {
      // The user closed the print dialog.
    }
  }

  return (
    <Screen
      title={compact ? `#${order.number}` : ""}
      actions={(
        <>
          <RoundButton icon="print" onPress={() => void print()} />
          {actions.length ? <RoundButton icon="dots" onPress={() => setMenu(true)} /> : null}
        </>
      )}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: tokens.field }}
        contentContainerStyle={{ paddingBottom: TAB_SPACE + insets.bottom + 12, gap: GAP }}
        scrollEventThrottle={32}
        onScroll={(event) => {
          const next = event.nativeEvent.contentOffset.y > 56;
          if (next !== compact) setCompact(next);
        }}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      >
        <Block>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <AppText style={{ fontFamily: fonts.bold, fontSize: 26, color: tokens.inkStrong, writingDirection: "ltr" }}>{`#${order.number}`}</AppText>
            {closed ? <Badge label="בארכיון" background="#e3e3e3" color="#303030" /> : null}
          </View>
          {order.createdAt || order.channel ? (
            <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }}>{[hebrewDate(order.createdAt), order.channel].filter(Boolean).join(" • ")}</AppText>
          ) : null}
        </Block>

        {order.customerName || customer ? (
          <Block>
            <BlockTitle title="לקוח" />
            <Pressable
              disabled={!customer}
              onPress={() => customer && router.push(`/customers/${customer.id}`)}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, opacity: pressed ? 0.6 : 1 })}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <AppText style={{ fontSize: 15, color: tokens.inkStrong }}>{order.customerName || customer?.name || ""}</AppText>
                {customerOrders ? <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>{customerOrders === 1 ? "הזמנה אחת" : `${formatCount(customerOrders)} הזמנות`}</AppText> : null}
              </View>
              {customer ? <Icon name="forward" size={16} color="#b5b5b5" strokeWidth={2} /> : null}
            </Pressable>
            {customer?.email || customer?.phone ? (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                <OutlineButton icon="mail" label="פרטי אימייל" disabled={!customer?.email} onPress={() => customer?.email && void Linking.openURL(`mailto:${customer.email}`)} />
                <OutlineButton icon="phone" label="פרטי טלפון" disabled={!customer?.phone} onPress={() => customer?.phone && void Linking.openURL(`tel:${customer.phone.replace(/[^\d+]/g, "")}`)} />
              </View>
            ) : null}
            {address.length ? (
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 4 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText style={{ fontSize: 12, color: tokens.inkSecondary }}>כתובת ברירת מחדל</AppText>
                  {address.map((part) => <AppText key={part} style={{ fontSize: 15, color: tokens.inkStrong }}>{part}</AppText>)}
                </View>
                <Pressable onPress={() => void copyAddress()} hitSlop={10}>
                  <Icon name={copied ? "check" : "copy"} size={18} color={tokens.inkSecondary} strokeWidth={1.8} />
                </Pressable>
              </View>
            ) : null}
          </Block>
        ) : null}

        {order.lines?.length ? (
          <Block>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <StatusPill icon={order.fulfillment === "fulfilled" ? "box" : "clock"} label={fulfillment?.label ?? "לא נשלח"} tone={order.fulfillment === "fulfilled" ? "plain" : "warn"} />
              {order.fulfillment === "fulfilled" ? <AppText style={{ color: tokens.inkSecondary, fontSize: 14, writingDirection: "ltr" }}>{`#${order.number}-F1`}</AppText> : null}
              <View style={{ flex: 1 }} />
              {actions.length ? <Dots onPress={() => setMenu(true)} /> : null}
            </View>
            {order.createdAt || order.shippingName ? (
              <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }}>{[hebrewDate(order.createdAt), order.shippingName].filter(Boolean).join(" • ")}</AppText>
            ) : null}
            {order.lines.map((line, index) => (
              <LineItem key={`${line.productId ?? line.title ?? "line"}-${index}`} line={line} products={snapshot?.products} onPress={line.productId ? () => router.push(`/products/${line.productId}`) : undefined} />
            ))}
            {order.carrier || order.tracking || customerStatus ? (
              <View style={{ gap: 6, paddingTop: 4 }}>
                {customerStatus ? <Pair label="סטטוס ללקוח" value={customerStatus} /> : null}
                {order.carrier ? <Pair label="חברת שילוח" value={order.carrier} /> : null}
                {order.tracking ? <Pair label="מספר מעקב" value={order.tracking} ltr /> : null}
              </View>
            ) : null}
            {primary ? (
              <Pressable
                disabled={pending !== ""}
                onPress={() => void apply(primary)}
                style={({ pressed }) => ({ height: 44, borderRadius: 12, backgroundColor: tokens.inkStrong, alignItems: "center", justifyContent: "center", marginTop: 4, opacity: pressed || pending ? 0.75 : 1 })}
              >
                <AppText style={{ color: "#ffffff", fontFamily: fonts.semibold, fontSize: 15 }}>{pending === primary.id ? "מעדכן…" : primary.label}</AppText>
              </Pressable>
            ) : null}
          </Block>
        ) : null}

        <Block>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <StatusPill icon="receipt" label={pay?.label ?? "תשלום"} tone={order.pay === "pending" ? "warn" : "plain"} />
            <View style={{ flex: 1 }} />
            {actions.length ? <Dots onPress={() => setMenu(true)} /> : null}
          </View>
          {subtotal != null ? <Money caption={itemCount === 1 ? "פריט אחד" : `${formatCount(itemCount)} פריטים`} label="סכום ביניים" value={formatIls(subtotal)} /> : null}
          {order.discountCode || order.discountAmount ? (
            <Money caption="הנחה" label={order.discountCode ?? ""} value={order.discountAmount != null ? `-${formatIls(order.discountAmount)}` : ""} />
          ) : null}
          {order.shippingName || order.shippingAmount != null ? (
            <Money caption="משלוח" label={order.shippingName ?? ""} value={order.shippingAmount != null ? formatIls(order.shippingAmount) : ""} />
          ) : null}
          {order.total != null ? (
            <>
              <Divider />
              <Money label="סה״כ" value={formatIls(order.total)} strong />
              <Divider />
              <Money label={order.pay === "pending" ? "יתרה לתשלום" : "שולם"} value={formatIls(order.total)} />
            </>
          ) : null}
          {order.refunded != null && order.refunded > 0 ? <Money label="הוחזר" value={`-${formatIls(order.refunded)}`} /> : null}
        </Block>

        <View style={{ backgroundColor: tokens.card }}>
          {order.tags?.length ? (
            <ListRow>
              <Icon name="tag" size={18} color={tokens.inkStrong} strokeWidth={1.8} />
              <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {order.tags.map((tag) => <Badge key={tag} label={tag} background="#ebebeb" color="#303030" />)}
              </View>
            </ListRow>
          ) : null}
          {ordinal ? (
            <ListRow>
              <AppText style={{ flex: 1, fontSize: 15, color: tokens.inkStrong }}>פרטי המרה</AppText>
              <AppText style={{ fontSize: 14, color: tokens.inkSecondary }}>{ordinal}</AppText>
            </ListRow>
          ) : null}
          {order.channel ? (
            <ListRow>
              <AppText style={{ flex: 1, fontSize: 15, color: tokens.inkStrong }}>ערוץ מכירה</AppText>
              <AppText style={{ fontSize: 14, color: tokens.inkSecondary }}>{order.channel}</AppText>
            </ListRow>
          ) : null}
          {order.note ? (
            <View style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 4 }}>
              <AppText style={{ fontSize: 15, fontFamily: fonts.semibold, color: tokens.inkStrong }}>הערות</AppText>
              <AppText style={{ fontSize: 14, color: tokens.ink }}>{order.note}</AppText>
            </View>
          ) : null}
        </View>

        {actionError ? <ErrorNote text={actionError} /> : null}
        {error ? <ErrorNote text={error} /> : null}

        <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
          <View style={{ gap: 2 }}>
            <AppText style={{ fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong }}>ציר זמן</AppText>
            <AppText style={{ fontSize: 12, color: tokens.inkSecondary }}>רק אתה וצוות החנות רואים הערות</AppText>
          </View>
          {canUpdate ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1, minHeight: 40, borderRadius: 10, backgroundColor: tokens.card, borderWidth: 1, borderColor: tokens.line, paddingHorizontal: 12, justifyContent: "center" }}>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder="השאר הערה…"
                  placeholderTextColor="#8a8a8a"
                  multiline
                  editable={pending === ""}
                  style={{ fontFamily: fonts.regular, fontSize: 15, color: tokens.inkStrong, textAlign: "right", writingDirection: "rtl", paddingVertical: 8 }}
                />
              </View>
              <Pressable disabled={!comment.trim() || pending !== ""} onPress={() => void sendComment()} hitSlop={8} style={{ transform: [{ scaleX: -1 }], opacity: comment.trim() ? 1 : 0.4 }}>
                <Icon name="send" size={20} color={tokens.inkStrong} strokeWidth={1.8} />
              </Pressable>
            </View>
          ) : null}
          {days.length ? (
            <View>
              {days.map((day) => (
                <View key={day.title}>
                  <AppText style={{ fontSize: 13, fontFamily: fonts.semibold, color: tokens.inkSecondary, paddingStart: 22, paddingVertical: 8 }}>{day.title}</AppText>
                  {day.entries.map((entry, index) => (
                    <View key={`${entry.at ?? "at"}-${index}`} style={{ flexDirection: "row", gap: 12 }}>
                      <View style={{ width: 10, alignItems: "center" }}>
                        <View style={{ position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: "#d4d4d4" }} />
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#4a4a4a", marginTop: 26 }} />
                      </View>
                      <View style={{ flex: 1, paddingVertical: 10, gap: 2 }}>
                        {entry.at ? <AppText style={{ fontSize: 12, color: tokens.inkSecondary }}>{hebrewTime(entry.at)}</AppText> : null}
                        <AppText style={{ fontSize: 15, color: tokens.inkStrong }}>{entry.text}</AppText>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <AppText style={{ fontSize: 14, color: tokens.inkSecondary }}>אין עדיין אירועים בהזמנה הזו.</AppText>
          )}
        </View>
      </ScrollView>

      <Modal visible={menu} transparent animationType="slide" onRequestClose={() => setMenu(false)}>
        <Pressable onPress={() => setMenu(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: tokens.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) + 8, direction: "rtl" }}>
            <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "#d4d4d4", marginBottom: 8 }} />
            {actions.map((action) => (
              <Pressable key={action.id} onPress={() => void apply(action)} style={{ height: 50, paddingHorizontal: 20, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: tokens.line }}>
                <AppText style={{ fontSize: 16, fontFamily: fonts.medium, color: tokens.inkStrong }}>{action.label}</AppText>
              </Pressable>
            ))}
          </View>
        </Pressable>
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

function Block({ children }: { children: ReactNode }) {
  return <View style={{ backgroundColor: tokens.card, paddingHorizontal: 16, paddingVertical: 14, gap: 10 }}>{children}</View>;
}

function BlockTitle({ title }: { title: string }) {
  const fonts = useFontSet();
  return <AppText style={{ fontFamily: fonts.semibold, fontSize: 16, color: tokens.inkStrong }}>{title}</AppText>;
}

function Dots({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      <Icon name="dots" size={20} color={tokens.inkStrong} strokeWidth={2.4} />
    </Pressable>
  );
}

function StatusPill({ icon, label, tone }: { icon: IconName; label: string; tone: "plain" | "warn" }) {
  const fonts = useFontSet();
  const warn = tone === "warn";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 30, paddingHorizontal: 10, borderRadius: 8, backgroundColor: warn ? "#ffeb78" : "#ebebeb" }}>
      <Icon name={icon} size={16} color={warn ? "#4f4700" : tokens.inkStrong} strokeWidth={1.8} />
      <AppText style={{ fontFamily: fonts.semibold, fontSize: 14, color: warn ? "#4f4700" : tokens.inkStrong }}>{label}</AppText>
    </View>
  );
}

function OutlineButton({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  const fonts = useFontSet();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#d4d4d4", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: disabled ? 0.4 : pressed ? 0.6 : 1 })}
    >
      <Icon name={icon} size={17} color={tokens.inkStrong} strokeWidth={1.8} />
      <AppText style={{ fontFamily: fonts.medium, fontSize: 14, color: tokens.inkStrong }}>{label}</AppText>
    </Pressable>
  );
}

function LineItem({ line, products, onPress }: { line: NonNullable<OrderRecord["lines"]>[number]; products?: ProductRecord[]; onPress?: () => void }) {
  const fonts = useFontSet();
  const product = line.productId ? products?.find((item) => item.id === line.productId) : undefined;
  const compareAt = product?.compareAt != null && line.unitPrice != null && product.compareAt > line.unitPrice ? product.compareAt : undefined;
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", gap: 12, paddingVertical: 4, opacity: pressed ? 0.6 : 1 })}>
      <Thumb uri={productImage(products, line.productId)} size={64} />
      <View style={{ flex: 1, gap: 3 }}>
        {line.title ? <AppText style={{ fontFamily: fonts.bold, fontSize: 15, color: tokens.inkStrong }} numberOfLines={3}>{line.title}</AppText> : null}
        {line.variant ? <AppText style={{ color: tokens.ink, fontSize: 14 }}>{line.variant}</AppText> : null}
        {line.sku ? <AppText style={{ color: tokens.ink, fontSize: 13 }}>{`מק״ט: ${line.sku}`}</AppText> : null}
        {line.unitPrice != null ? (
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <AppText style={{ color: tokens.ink, fontSize: 14 }}>{formatIls(line.unitPrice)}</AppText>
            {compareAt != null ? <AppText style={{ color: tokens.inkSecondary, fontSize: 13, textDecorationLine: "line-through" }}>{formatIls(compareAt)}</AppText> : null}
          </View>
        ) : null}
      </View>
      {line.quantity != null ? <AppText style={{ fontFamily: fonts.semibold, fontSize: 17, color: tokens.inkStrong, writingDirection: "ltr", alignSelf: "center" }}>{`× ${line.quantity}`}</AppText> : null}
    </Pressable>
  );
}

function Money({ caption, label, value, strong = false }: { caption?: string; label: string; value: string; strong?: boolean }) {
  const fonts = useFontSet();
  const weight = strong ? fonts.bold : fonts.regular;
  return (
    <View style={{ gap: 1 }}>
      {caption ? <AppText style={{ fontSize: 12, color: tokens.inkSecondary }}>{caption}</AppText> : null}
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-end" }}>
        <AppText style={{ flex: 1, fontSize: 15, color: tokens.inkStrong, fontFamily: weight }}>{label}</AppText>
        <AppText style={{ fontSize: 15, color: tokens.inkStrong, fontFamily: weight, writingDirection: "ltr" }}>{value}</AppText>
      </View>
    </View>
  );
}

function Pair({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <AppText style={{ flex: 1, fontSize: 14, color: tokens.inkSecondary }}>{label}</AppText>
      <AppText style={{ fontSize: 14, color: tokens.inkStrong, writingDirection: ltr ? "ltr" : "rtl" }}>{value}</AppText>
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: tokens.line, marginVertical: 2 }} />;
}

function ListRow({ children }: { children: ReactNode }) {
  return <View style={{ minHeight: 50, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: tokens.line }}>{children}</View>;
}
