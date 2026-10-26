import { Stack } from "expo-router";
import { tokens } from "@/theme/tokens";
import { useFontSet } from "@/theme/fonts";

export default function OrdersLayout() {
  const fonts = useFontSet();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tokens.card },
        headerTintColor: tokens.inkStrong,
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 15, color: tokens.inkStrong },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: tokens.canvas },
        headerBackTitle: "חזרה",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: "הזמנה" }} />
    </Stack>
  );
}
