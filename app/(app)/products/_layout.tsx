import { Stack } from "expo-router";
import { tokens } from "@/theme/tokens";

export default function ProductsLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.card } }} />;
}
