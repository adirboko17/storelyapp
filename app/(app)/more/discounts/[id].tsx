import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { DetailScreen, InfoRow, Section } from "@/components/detail";
import { SheetEmpty } from "@/components/shell";
import { AppText, Badge } from "@/components/ui";
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
  if (!allowed) return <DetailScreen title="הנחה"><SheetEmpty icon="discount" text="אין הרשאה למסך הזה." /></DetailScreen>;
  if (!discount) return <DetailScreen title="הנחה"><SheetEmpty icon="discount" text={error || "ההנחה לא נמצאה."} /></DetailScreen>;
  const badge = knownBadge(DISCOUNT_STATUS, discount.status);
  const kind = discount.kind ? DISCOUNT_KIND[discount.kind] ?? discount.kind : undefined;
  const value = discount.value == null ? undefined : discount.valueType === "fixed" ? formatIls(discount.value) : discount.valueType === "pct" ? `${discount.value}%` : String(discount.value);
  const title = discount.code || discount.title || "הנחה";
  return (
    <DetailScreen title={title}>
      <View style={{ paddingHorizontal: 16, paddingTop: 4, gap: 8 }}>
        <AppText style={{ fontFamily: fonts.bold, fontSize: 20, color: tokens.inkStrong }}>{title}</AppText>
        {badge ? <Badge {...badge} /> : null}
      </View>
      <Section title="פרטים">
        <InfoRow label="כותרת" value={discount.title && discount.title !== discount.code ? discount.title : undefined} />
        <InfoRow label="סוג" value={kind} />
        <InfoRow label="ערך" value={value} ltr />
        <InfoRow label="אופן" value={discount.method === "auto" ? "אוטומטית" : discount.method === "code" ? "קוד" : discount.method} />
        <InfoRow label="שימושים" value={discount.uses != null ? formatCount(discount.uses) : undefined} />
      </Section>
      <Section title="תוקף">
        <InfoRow label="התחלה" value={discount.start || "לא הוגדר"} />
        <InfoRow label="סיום" value={discount.hasEnd && discount.end ? discount.end : "ללא תאריך סיום"} />
      </Section>
    </DetailScreen>
  );
}
