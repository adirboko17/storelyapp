import { Stack } from "expo-router";
import { tokens } from "@/theme/tokens";

export default function MoreLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.canvas } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="discounts" />
      <Stack.Screen name="sale" />
    </Stack>
  );
}
