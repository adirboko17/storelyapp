import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { DetailScreen, InfoRow, Section } from "@/components/detail";
import { OrderRow } from "@/components/rows";
import { SheetEmpty, initials } from "@/components/shell";
import { AppText } from "@/components/ui";
import { formatCount, formatIls, hebrewDate } from "@/lib/format";
import { sortedOrders } from "@/lib/snapshot";
import { useAllowed, useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { tokens } from "@/theme/tokens";

export default function CustomerScreen() {
  const fonts = useFontSet();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const allowed = useAllowed("customers.read");
  const canOrders = useAllowed("orders.read");
  const { snapshot, error } = useStoreData();
  const person = snapshot?.customers?.find((item) => item.id === id);
  if (!allowed) return <DetailScreen title="לקוח"><SheetEmpty icon="user" text="אין הרשאה למסך הזה." /></DetailScreen>;
  if (!person) return <DetailScreen title="לקוח"><SheetEmpty icon="user" text={error || "הלקוח לא נמצא."} /></DetailScreen>;
  const address = [person.street, person.city, person.zip].filter(Boolean).join(", ");
  const orders = canOrders && snapshot?.orders ? sortedOrders(snapshot.orders).filter((order) => order.customerId === person.id) : undefined;
  const spent = orders?.reduce((sum, order) => sum + (order.total ?? 0), 0);
  const name = person.name || person.email || "לקוח";

  return (
    <DetailScreen title={name}>
      <View style={{ alignItems: "center", gap: 8, paddingTop: 8, paddingBottom: 4 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#e3e3e3", alignItems: "center", justifyContent: "center" }}>
          <AppText style={{ fontFamily: fonts.bold, fontSize: 22, color: tokens.inkStrong }}>{initials(name)}</AppText>
        </View>
        <AppText style={{ fontFamily: fonts.bold, fontSize: 20, color: tokens.inkStrong }}>{name}</AppText>
        {person.city ? <AppText style={{ color: tokens.inkSecondary }}>{person.city}</AppText> : null}
      </View>
      {orders ? (
        <View style={{ flexDirection: "row", marginHorizontal: 12, marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: tokens.line }}>
          <Stat label="הזמנות" value={formatCount(orders.length)} />
          <View style={{ width: 1, backgroundColor: tokens.line }} />
          <Stat label="סך הכל הוצא" value={formatIls(spent ?? 0)} />
        </View>
      ) : null}
      <Section title="פרטי קשר">
        <InfoRow label="אימייל" value={person.email} ltr />
        <InfoRow label="טלפון" value={person.phone} ltr />
        <InfoRow label="כתובת" value={address} />
        <InfoRow label="לקוח מאז" value={hebrewDate(person.createdAt)} />
        <InfoRow label="דיוור" value={person.subscribed == null ? undefined : person.subscribed ? "מנוי" : "לא מנוי"} />
      </Section>
      {person.note || person.tags?.length ? (
        <Section title="הערות ותגיות">
          {person.note ? <AppText style={{ color: tokens.ink }}>{person.note}</AppText> : null}
          {person.tags?.length ? <AppText style={{ color: tokens.inkSecondary }}>{person.tags.join(" · ")}</AppText> : null}
        </Section>
      ) : null}
      {orders && orders.length ? (
        <View style={{ marginTop: 16 }}>
          <AppText style={{ paddingHorizontal: 16, paddingBottom: 6, fontFamily: fonts.bold, fontSize: 15, color: tokens.inkStrong }}>הזמנות</AppText>
          <View style={{ borderTopWidth: 1, borderTopColor: tokens.line }}>
            {orders.map((order) => <OrderRow key={order.number} order={order} onPress={() => router.push(`/orders/${order.number}`)} />)}
          </View>
        </View>
      ) : null}
    </DetailScreen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const fonts = useFontSet();
  return (
    <View style={{ flex: 1, padding: 14, gap: 2 }}>
      <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }}>{label}</AppText>
      <AppText style={{ fontFamily: fonts.bold, fontSize: 17, color: tokens.inkStrong, writingDirection: "ltr", textAlign: "right" }}>{value}</AppText>
    </View>
  );
}
