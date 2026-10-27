import { useState } from "react";
import { View, type TextLayoutEvent } from "react-native";
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

export function OrderRow({ order, onPress, onLongPress, refund = false }: { order: OrderRecord; onPress: () => void; onLongPress?: () => void; refund?: boolean }) {
  const fonts = useFontSet();
  const closed = !refund && Boolean(order.fulfillment) && !isOpenOrder(order);
  const fulfillment = knownBadge(FULFILLMENT_BADGE, order.fulfillment);
  const pay = knownBadge(PAY_BADGE, order.pay);
  const amount = refund && order.refunded != null ? order.refunded : order.total;
  const items = itemCount(order);
  const meta = [
    order.customerName,
    items != null ? (items === 1 ? "פריט אחד" : `${formatCount(items)} פריטים`) : "",
    hebrewTime(order.createdAt),
  ].filter(Boolean).join(" • ");
  return (
    <FlatRow onPress={onPress} onLongPress={onLongPress}>
      <View style={{ gap: 4, opacity: closed ? 0.62 : 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <AppText style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong }}>#{order.number}</AppText>
          {amount != null ? <AppText style={{ fontSize: 15, color: tokens.inkStrong, writingDirection: "ltr" }}>{formatIls(amount)}</AppText> : null}
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

function ProductName({ title }: { title: string }) {
  const fonts = useFontSet();
  const [rest, setRest] = useState<string | null>(null);
  const first = rest == null ? title : title.slice(0, title.length - rest.length).trimEnd();
  function measure(event: TextLayoutEvent) {
    const lines = event.nativeEvent.lines;
    const opening = lines[0]?.text ?? "";
    if (lines.length <= 1 || !opening || !title.startsWith(opening)) {
      setRest("");
      return;
    }
    setRest(title.slice(opening.length).trim());
  }
  return (
    <View>
      <AppText style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: tokens.inkStrong }} onTextLayout={rest == null ? measure : undefined}>{first}</AppText>
      {rest ? <AppText style={{ fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, color: tokens.inkStrong }}>{rest}</AppText> : null}
    </View>
  );
}

export function ProductRow({ product, onPress, onLongPress }: { product: ProductRecord; onPress: () => void; onLongPress?: () => void }) {
  const badge = knownBadge(PRODUCT_BADGE, product.status);
  const empty = product.stock != null && product.stock <= 0;
  const title = product.title?.trim() || "ללא שם";
  return (
    <FlatRow onPress={onPress} onLongPress={onLongPress}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <Thumb uri={product.media?.[0]} />
        <View style={{ flex: 1, gap: 3 }}>
          <ProductName key={title} title={title} />
          {product.stock != null ? (
            <AppText style={{ fontSize: 13, color: empty ? tokens.negative : tokens.inkSecondary }}>{`${formatCount(Math.max(0, product.stock))} במלאי`}</AppText>
          ) : product.variant ? <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>{product.variant}</AppText> : null}
        </View>
        {badge ? <Badge {...badge} /> : null}
      </View>
    </FlatRow>
  );
}

export function CustomerRow({ person, spent, onPress, onLongPress }: { person: CustomerRecord; spent?: number; onPress: () => void; onLongPress?: () => void }) {
  const fonts = useFontSet();
  const place = [person.city, "ישראל"].filter(Boolean).join(", ");
  const orders = person.orders != null ? (person.orders === 1 ? "הזמנה אחת" : `${formatCount(person.orders)} הזמנות`) : "";
  const meta = [spent != null ? formatIls(spent) : "", orders].filter(Boolean).join(" • ");
  return (
    <FlatRow onPress={onPress} onLongPress={onLongPress}>
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
