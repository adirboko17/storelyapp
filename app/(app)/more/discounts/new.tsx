import { useLocalSearchParams } from "expo-router";
import { DiscountEditor } from "@/components/discount-editor";
import { DetailScreen } from "@/components/detail";
import { SheetEmpty } from "@/components/shell";
import { discountKind } from "@/lib/discounts";
import { useAllowed } from "@/lib/store-data";

export default function NewDiscountScreen() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const allowed = useAllowed("discounts.read");
  if (!allowed) return <DetailScreen title="הנחה חדשה"><SheetEmpty icon="discount" text="אין הרשאה למסך הזה." /></DetailScreen>;
  return <DiscountEditor record={null} kind={discountKind(typeof kind === "string" ? kind : undefined)} />;
}
