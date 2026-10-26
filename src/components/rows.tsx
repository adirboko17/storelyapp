import { View } from "react-native";
import { FlatRow, Thumb } from "@/components/shell";
import { AppText, Badge } from "@/components/ui";
import { formatCount, formatIls, hebrewTime } from "@/lib/format";
import { FULFILLMENT_BADGE, PAY_BADGE, PRODUCT_BADGE, knownBadge } from "@/lib/orders";
import { isOpenOrder, itemCount, type CustomerRecord, type OrderRecord, type ProductRecord } from "@/lib/snapshot";
import { useFontSet } from "@/theme/fonts";
import { tokens } from "@/theme/tokens";

export const ORDER_SWITCH = [
  { label: "הזמנות", href: "/orders" },
  { label: "החזרות והחזרים כספיים", href: "/more/area/returns" },
  { label: "עגלות נטושות", href: "/more/area/abandoned" },
];

export const PRODUCT_SWITCH = [
  { label: "מוצרים", href: "/products" },
  { label: "קטגוריות", href: "/more/area/collections" },
  { label: "מלאי", href: "/more/area/inventory" },
  { label: "ביקורות", href: "/more/area/reviews" },
  { label: "כרטיסי מתנה", href: "/more/area/gift-cards" },
];

export const CUSTOMER_SWITCH = [
  { label: "לקוחות", href: "/customers" },
  { label: "פלחים", href: "/more/area/segments" },
];

export function OrderRow({ order, onPress }: { order: OrderRecord; onPress: () => void }) {
  const fonts = useFontSet();
  const closed = Boolean(order.fulfillment) && !isOpenOrder(order);
  const fulfillment = knownBadge(FULFILLMENT_BADGE, order.fulfillment);
  const pay = knownBadge(PAY_BADGE, order.pay);
  const items = itemCount(order);
  const meta = [
    order.customerName,
    items != null ? (items === 1 ? "פריט אחד" : `${formatCount(items)} פריטים`) : "",
    hebrewTime(order.createdAt),
  ].filter(Boolean).join(" • ");
  return (
    <FlatRow onPress={onPress}>
      <View style={{ gap: 4, opacity: closed ? 0.62 : 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <AppText style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong }}>#{order.number}</AppText>
          {order.total != null ? <AppText style={{ fontSize: 15, color: tokens.inkStrong, writingDirection: "ltr" }}>{formatIls(order.total)}</AppText> : null}
        </View>
        {meta ? <AppText style={{ color: tokens.inkSecondary, fontSize: 14 }} numberOfLines={1}>{meta}</AppText> : null}
        <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
          {closed ? <Badge label="בארכיון" background="#e3e3e3" color="#303030" /> : (
            <>
              {fulfillment ? <Badge {...fulfillment} /> : null}
              {pay ? <Badge {...pay} /> : null}
            </>
          )}
        </View>
        {order.shippingName ? <AppText style={{ color: tokens.ink, fontSize: 13 }} numberOfLines={1}>{order.shippingName}</AppText> : null}
      </View>
    </FlatRow>
  );
}

export function ProductRow({ product, onPress }: { product: ProductRecord; onPress: () => void }) {
  const fonts = useFontSet();
  const badge = knownBadge(PRODUCT_BADGE, product.status);
  const empty = product.stock != null && product.stock <= 0;
  return (
    <FlatRow onPress={onPress}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Thumb uri={product.media?.[0]} />
        <View style={{ flex: 1, gap: 3 }}>
          <AppText style={{ fontFamily: fonts.bold, fontSize: 15, color: tokens.inkStrong }} numberOfLines={2}>{product.title || "ללא שם"}</AppText>
          {product.stock != null ? (
            <AppText style={{ fontSize: 13, color: empty ? tokens.negative : tokens.inkSecondary }}>{`${formatCount(Math.max(0, product.stock))} במלאי`}</AppText>
          ) : product.variant ? <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>{product.variant}</AppText> : null}
        </View>
        {badge ? <Badge {...badge} /> : null}
      </View>
    </FlatRow>
  );
}

export function CustomerRow({ person, spent, onPress }: { person: CustomerRecord; spent?: number; onPress: () => void }) {
  const fonts = useFontSet();
  const place = [person.city, "ישראל"].filter(Boolean).join(", ");
  const orders = person.orders != null ? (person.orders === 1 ? "הזמנה אחת" : `${formatCount(person.orders)} הזמנות`) : "";
  const meta = [spent != null ? formatIls(spent) : "", orders].filter(Boolean).join(" • ");
  return (
    <FlatRow onPress={onPress}>
      <View style={{ gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <AppText style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong }} numberOfLines={1}>{person.name || person.email || "ללא שם"}</AppText>
          {person.subscribed != null ? (
            <Badge label={person.subscribed ? "מנוי לדיוור" : "לא מנוי"} background={person.subscribed ? tokens.activeBg : tokens.neutralBg} color={person.subscribed ? tokens.activeText : tokens.ink} />
          ) : null}
        </View>
        <AppText style={{ fontSize: 14, color: tokens.inkSecondary }} numberOfLines={1}>{place}</AppText>
        {meta ? <AppText style={{ fontSize: 14, color: tokens.inkSecondary }}>{meta}</AppText> : null}
      </View>
    </FlatRow>
  );
}
