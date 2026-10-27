import { Stack } from "expo-router";
import { tokens } from "@/theme/tokens";

const options = { headerShown: false, contentStyle: { backgroundColor: tokens.card } } as const;

export default function ProductsLayout() {
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ gestureEnabled: false }} />
      <Stack.Screen name="new" options={{ gestureEnabled: false }} />
      <Stack.Screen name="edit/[id]" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
