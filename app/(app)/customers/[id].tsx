import { Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppText, Badge, Card } from "@/components/ui";
import { allows } from "@/lib/access";
import { formatCount, formatIls, hebrewDate, hebrewWhen } from "@/lib/format";
import { FULFILLMENT_BADGE, knownBadge } from "@/lib/orders";
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
  const { snapshot, access, error } = useStoreData();
  const person = snapshot?.customers?.find((item) => item.id === id);
  if (!allowed) return <Message text="אין הרשאה למסך הזה." />;
  if (!person) return <Message text={error || "הלקוח לא נמצא."} />;
  const address = [person.street, person.city, person.zip].filter(Boolean).join(", ");
  const orders = canOrders && allows(access, "orders.read") && snapshot?.orders
    ? sortedOrders(snapshot.orders).filter((order) => order.customerId === person.id)
    : undefined;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
      <AppText style={{ fontFamily: fonts.bold, fontSize: 24, color: tokens.inkStrong }}>{person.name || ""}</AppText>
      <Card>
        <View style={{ padding: 16, gap: 8 }}>
          {person.email ? <Line label="אימייל" value={person.email} /> : null}
          {person.phone ? <Line label="טלפון" value={person.phone} /> : null}
          {address ? <Line label="כתובת" value={address} /> : null}
          {person.orders != null ? <Line label="הזמנות" value={formatCount(person.orders)} /> : null}
          {person.createdAt ? <Line label="נוצר" value={hebrewDate(person.createdAt)} /> : null}
          {person.note ? <Line label="הערה" value={person.note} /> : null}
          {person.tags && person.tags.length > 0 ? <Line label="תגיות" value={person.tags.join(", ")} /> : null}
        </View>
      </Card>
      {orders ? (
        <Card>
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
            <AppText style={{ fontFamily: fonts.bold, fontSize: 15 }}>הזמנות</AppText>
          </View>
          {orders.length === 0 ? <AppText style={{ padding: 16, color: tokens.inkSecondary }}>אין הזמנות עדיין</AppText> : null}
          {orders.map((order) => {
            const badge = knownBadge(FULFILLMENT_BADGE, order.fulfillment);
            return (
              <Pressable key={order.number} onPress={() => router.push(`/orders/${order.number}`)} style={{ borderTopWidth: 1, borderTopColor: tokens.line, paddingHorizontal: 16, paddingVertical: 12, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <AppText style={{ fontFamily: fonts.semibold, writingDirection: "ltr" }}>#{order.number}</AppText>
                  <AppText style={{ flex: 1, color: tokens.inkSecondary, fontSize: 13 }}>{order.createdAt ? hebrewWhen(order.createdAt) : ""}</AppText>
                  {order.total != null ? <AppText>{formatIls(order.total)}</AppText> : null}
                </View>
                {badge ? <Badge {...badge} /> : null}
              </Pressable>
            );
          })}
        </Card>
      ) : null}
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
