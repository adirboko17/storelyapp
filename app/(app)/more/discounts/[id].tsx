import { useLocalSearchParams } from "expo-router";
import { DiscountEditor } from "@/components/discount-editor";
import { DetailScreen } from "@/components/detail";
import { SheetEmpty } from "@/components/shell";
import { useAllowed, useStoreData } from "@/lib/store-data";

export default function DiscountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const allowed = useAllowed("discounts.read");
  const { snapshot, error } = useStoreData();
  const discount = snapshot?.discounts?.find((item) => item.id === id);
  if (!allowed) return <DetailScreen title="הנחה"><SheetEmpty icon="discount" text="אין הרשאה למסך הזה." /></DetailScreen>;
  if (!discount) return <DetailScreen title="הנחה"><SheetEmpty icon="discount" text={error || "ההנחה לא נמצאה."} /></DetailScreen>;
  return <DiscountEditor record={discount} />;
}
