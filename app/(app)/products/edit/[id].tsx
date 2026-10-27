import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ProductEditor } from "@/components/product-editor";
import { DetailHeader, SheetEmpty } from "@/components/shell";
import { LoadingBlock } from "@/components/ui";
import { useAllowed, useStoreData } from "@/lib/store-data";
import { tokens } from "@/theme/tokens";

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const allowed = useAllowed("products.update");
  const { snapshot, loading, error } = useStoreData();
  const product = snapshot?.products?.find((item) => item.id === id);
  if (allowed && product) return <ProductEditor key={product.id} product={product} />;
  return (
    <View style={{ flex: 1, backgroundColor: tokens.card }}>
      <DetailHeader title="עריכת מוצר" />
      {!allowed ? <SheetEmpty icon="tag" text="אין הרשאה לערוך מוצרים." /> : loading ? <LoadingBlock /> : <SheetEmpty icon="tag" text={error || "המוצר לא נמצא."} />}
    </View>
  );
}
