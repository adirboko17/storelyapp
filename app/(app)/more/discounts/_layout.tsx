import { Stack } from "expo-router";
import { tokens } from "@/theme/tokens";

export default function DiscountsLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.card } }} />;
}
