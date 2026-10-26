import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { AppText, Badge, Card, ErrorNote } from "@/components/ui";
import { formatIls, hebrewDate, hebrewWhen } from "@/lib/format";
import { CUSTOMER_STATUS_LABEL, FULFILLMENT_BADGE, ORDER_STATUS_ACTIONS, PAY_BADGE, knownBadge, statusAlreadyApplied, type OrderPatch } from "@/lib/orders";
import { useAllowed, useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { tokens } from "@/theme/tokens";

export default function OrderScreen() {
  const fonts = useFontSet();
  const { id } = useLocalSearchParams<{ id: string }>();
  const number = Number(id);
  const allowed = useAllowed("orders.read");
  const canUpdate = useAllowed("orders.update");
  const { snapshot, error, updateOrder } = useStoreData();
  const [pending, setPending] = useState("");
  const [actionError, setActionError] = useState("");
  const order = snapshot?.orders?.find((item) => item.number === number);

  async function apply(key: string, patch: OrderPatch) {
    setPending(key);
    setActionError("");
    const next = await updateOrder(number, patch);
    setPending("");
    if (next) setActionError(next);
  }

  if (!allowed) return <Message text="אין הרשאה למסך הזה." />;
  if (!order) return <Message text={error || "ההזמנה לא נמצאה."} />;

  const fulfillment = knownBadge(FULFILLMENT_BADGE, order.fulfillment);
  const pay = knownBadge(PAY_BADGE, order.pay);
  const customerStatus = order.customerStatus ? CUSTOMER_STATUS_LABEL[order.customerStatus] ?? order.customerStatus : undefined;
  const actions = ORDER_STATUS_ACTIONS.filter((action) => !statusAlreadyApplied(order, action.patch));
  const showPaid = order.pay === "pending";

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
      <AppText style={{ fontFamily: fonts.bold, fontSize: 24, color: tokens.inkStrong, writingDirection: "ltr", textAlign: "right" }}>#{order.number}</AppText>
      {order.createdAt ? <AppText style={{ color: tokens.inkSecondary }}>{hebrewDate(order.createdAt)}</AppText> : null}
      <Card>
        <View style={{ padding: 16, gap: 8 }}>
          {order.customerName ? <Line label="לקוח" value={order.customerName} /> : null}
          {order.channel ? <Line label="ערוץ" value={order.channel} /> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {fulfillment ? <Badge {...fulfillment} /> : null}
            {pay ? <Badge {...pay} /> : null}
          </View>
          {customerStatus ? <Line label="סטטוס ללקוח" value={customerStatus} /> : null}
        </View>
      </Card>
      {order.lines ? (
        <Card>
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
            <AppText style={{ fontFamily: fonts.bold, fontSize: 15 }}>פריטים</AppText>
          </View>
          {order.lines.length === 0 ? <AppText style={{ padding: 16, color: tokens.inkSecondary }}>אין פריטים</AppText> : null}
          {order.lines.map((line, index) => (
            <View key={`${line.productId ?? line.title ?? "line"}-${index}`} style={{ borderTopWidth: 1, borderTopColor: tokens.line, paddingHorizontal: 16, paddingVertical: 12, gap: 2 }}>
              {line.title ? <AppText style={{ fontFamily: fonts.semibold }}>{line.title}</AppText> : null}
              {line.variant ? <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }}>{line.variant}</AppText> : null}
              {line.sku ? <AppText style={{ color: tokens.inkSecondary, fontSize: 13, writingDirection: "ltr", textAlign: "right" }}>{line.sku}</AppText> : null}
              <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }}>
                {line.quantity != null ? `כמות ${line.quantity}` : ""}
                {line.quantity != null && line.unitPrice != null ? " · " : ""}
                {line.unitPrice != null ? formatIls(line.unitPrice) : ""}
              </AppText>
            </View>
          ))}
        </Card>
      ) : null}
      <Card>
        <View style={{ padding: 16, gap: 8 }}>
          {order.discountCode ? <Line label="הנחה" value={order.discountCode} /> : null}
          {order.discountAmount != null ? <Line label="סכום הנחה" value={formatIls(order.discountAmount)} /> : null}
          {order.shippingName ? <Line label="משלוח" value={order.shippingName} /> : null}
          {order.shippingAmount != null ? <Line label="דמי משלוח" value={formatIls(order.shippingAmount)} /> : null}
          {order.total != null ? <Line label="סה״כ" value={formatIls(order.total)} strong /> : null}
          {order.refunded != null && order.refunded > 0 ? <Line label="הוחזר" value={formatIls(order.refunded)} /> : null}
          {order.carrier ? <Line label="שליח" value={order.carrier} /> : null}
          {order.tracking ? <Line label="מעקב" value={order.tracking} /> : null}
          {order.note ? <Line label="הערה" value={order.note} /> : null}
        </View>
      </Card>
      {order.timeline && order.timeline.length > 0 ? (
        <Card>
          <View style={{ padding: 16, gap: 12 }}>
            <AppText style={{ fontFamily: fonts.bold, fontSize: 15 }}>ציר זמן</AppText>
            {order.timeline.map((entry, index) => (
              <View key={`${entry.at ?? "at"}-${index}`}>
                <AppText>{entry.text}</AppText>
                {entry.at ? <AppText style={{ color: tokens.inkSecondary, fontSize: 12 }}>{hebrewWhen(entry.at)}</AppText> : null}
              </View>
            ))}
          </View>
        </Card>
      ) : null}
      {canUpdate ? (
        <Card>
          <View style={{ padding: 16, gap: 8 }}>
            <AppText style={{ fontFamily: fonts.bold, fontSize: 15 }}>עדכון סטטוס</AppText>
            {showPaid ? (
              <ActionButton label={pending === "paid" ? "מעדכן…" : "סימון כשולמה"} disabled={pending !== ""} onPress={() => void apply("paid", { pay: "paid", comment: "ההזמנה סומנה כשולמה." })} />
            ) : null}
            {actions.map((action) => (
              <ActionButton
                key={action.id}
                label={pending === action.id ? "מעדכן…" : action.label}
                disabled={pending !== ""}
                onPress={() => void apply(action.id, action.patch)}
              />
            ))}
            {actionError ? <AppText style={{ color: tokens.negative, fontSize: 13 }}>{actionError}</AppText> : null}
          </View>
        </Card>
      ) : null}
      {error ? <ErrorNote text={error} /> : null}
    </ScrollView>
  );
}

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  const fonts = useFontSet();
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <AppText style={{ width: 96, color: tokens.inkSecondary }}>{label}</AppText>
      <AppText style={{ flex: 1, fontFamily: strong ? fonts.bold : fonts.regular, color: tokens.inkStrong }}>{value}</AppText>
    </View>
  );
}

function ActionButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  const fonts = useFontSet();
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ height: 40, borderRadius: 8, backgroundColor: tokens.inkStrong, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.7 : 1 }}>
      <AppText style={{ color: "#ffffff", fontFamily: fonts.semibold, fontSize: 14 }}>{label}</AppText>
    </Pressable>
  );
}

function Message({ text }: { text: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: tokens.canvas, padding: 16 }}>
      <AppText style={{ color: tokens.inkSecondary }}>{text}</AppText>
    </View>
  );
}
