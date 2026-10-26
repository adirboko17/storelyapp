import { ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { AppText, Badge, Card } from "@/components/ui";
import { formatCount, formatIls } from "@/lib/format";
import { PRODUCT_BADGE, knownBadge } from "@/lib/orders";
import { useAllowed, useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { tokens } from "@/theme/tokens";

export default function ProductScreen() {
  const fonts = useFontSet();
  const { id } = useLocalSearchParams<{ id: string }>();
  const allowed = useAllowed("products.read");
  const { snapshot, error } = useStoreData();
  const product = snapshot?.products?.find((item) => item.id === id);
  if (!allowed) return <Message text="אין הרשאה למסך הזה." />;
  if (!product) return <Message text={error || "המוצר לא נמצא."} />;
  const badge = knownBadge(PRODUCT_BADGE, product.status);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <AppText style={{ fontFamily: fonts.bold, fontSize: 24, color: tokens.inkStrong }}>{product.title || ""}</AppText>
      {badge ? <Badge {...badge} /> : null}
      <Card>
        <View style={{ padding: 16, gap: 8 }}>
          {product.price != null ? <Line label="מחיר" value={formatIls(product.price)} /> : null}
          {product.compareAt != null ? <Line label="מחיר לפני" value={formatIls(product.compareAt)} /> : null}
          {product.stock != null ? <Line label="מלאי" value={product.stock === 0 ? "אזל" : formatCount(product.stock)} /> : null}
          {product.sku ? <Line label="מק״ט" value={product.sku} /> : null}
          {product.barcode ? <Line label="ברקוד" value={product.barcode} /> : null}
          {product.variant ? <Line label="וריאנט" value={product.variant} /> : null}
          {product.vendor ? <Line label="ספק" value={product.vendor} /> : null}
          {product.category ? <Line label="קטגוריה" value={product.category} /> : null}
        </View>
      </Card>
      {product.description ? (
        <Card>
          <View style={{ padding: 16 }}>
            <AppText style={{ lineHeight: 22 }}>{product.description}</AppText>
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <AppText style={{ width: 88, color: tokens.inkSecondary }}>{label}</AppText>
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
