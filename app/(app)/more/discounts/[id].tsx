import { ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { AppText, Badge, Card } from "@/components/ui";
import { formatCount, formatIls } from "@/lib/format";
import { DISCOUNT_KIND, DISCOUNT_STATUS, knownBadge } from "@/lib/orders";
import { useAllowed, useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { tokens } from "@/theme/tokens";

export default function DiscountScreen() {
  const fonts = useFontSet();
  const { id } = useLocalSearchParams<{ id: string }>();
  const allowed = useAllowed("discounts.read");
  const { snapshot, error } = useStoreData();
  const discount = snapshot?.discounts?.find((item) => item.id === id);
  if (!allowed) return <Message text="אין הרשאה למסך הזה." />;
  if (!discount) return <Message text={error || "ההנחה לא נמצאה."} />;
  const badge = knownBadge(DISCOUNT_STATUS, discount.status);
  const kind = discount.kind ? DISCOUNT_KIND[discount.kind] ?? discount.kind : undefined;
  const value = discount.value == null ? undefined : discount.valueType === "fixed" ? formatIls(discount.value) : discount.valueType === "pct" ? `${discount.value}%` : String(discount.value);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <AppText style={{ fontFamily: fonts.bold, fontSize: 24, color: tokens.inkStrong }}>{discount.code || discount.title || ""}</AppText>
      {badge ? <Badge {...badge} /> : null}
      <Card>
        <View style={{ padding: 16, gap: 8 }}>
          {discount.title && discount.title !== discount.code ? <Line label="כותרת" value={discount.title} /> : null}
          {kind ? <Line label="סוג" value={kind} /> : null}
          {value ? <Line label="ערך" value={value} /> : null}
          {discount.method ? <Line label="אופן" value={discount.method === "auto" ? "אוטומטית" : discount.method === "code" ? "קוד" : discount.method} /> : null}
          {discount.uses != null ? <Line label="שימושים" value={formatCount(discount.uses)} /> : null}
          {discount.start ? <Line label="התחלה" value={discount.start} /> : null}
          {discount.hasEnd && discount.end ? <Line label="סיום" value={discount.end} /> : null}
        </View>
      </Card>
    </ScrollView>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <AppText style={{ width: 72, color: tokens.inkSecondary }}>{label}</AppText>
      <AppText style={{ flex: 1, color: tokens.inkStrong }}>{value}</AppText>
    </View>
  );
}

function Message({ text }: { text: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: tokens.canvas, padding: 16 }}>
      <AppText style={{ color: tokens.inkSecondary }}>{text}</AppText>
    </View>
  );
}
