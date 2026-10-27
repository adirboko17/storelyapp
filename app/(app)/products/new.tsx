import { View } from "react-native";
import { ProductEditor } from "@/components/product-editor";
import { DetailHeader, SheetEmpty } from "@/components/shell";
import { useAllowed } from "@/lib/store-data";
import { tokens } from "@/theme/tokens";

export default function NewProductScreen() {
  const allowed = useAllowed("products.create");
  if (!allowed) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.card }}>
        <DetailHeader title="מוצר חדש" />
        <SheetEmpty icon="tag" text="אין הרשאה להוסיף מוצרים." />
      </View>
    );
  }
  return <ProductEditor product={null} />;
}
