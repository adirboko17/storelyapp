import { Stack } from "expo-router";
import { useFontSet } from "@/theme/fonts";
import { tokens } from "@/theme/tokens";

export default function DiscountsLayout() {
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
      <Stack.Screen name="index" options={{ title: "הנחות" }} />
      <Stack.Screen name="[id]" options={{ title: "הנחה" }} />
    </Stack>
  );
}
