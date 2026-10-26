import { Stack } from "expo-router";
import { useFontSet } from "@/theme/fonts";
import { tokens } from "@/theme/tokens";

export default function CustomersLayout() {
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
      <Stack.Screen name="[id]" options={{ title: "לקוח" }} />
    </Stack>
  );
}
