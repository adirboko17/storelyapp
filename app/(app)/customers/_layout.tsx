import { Stack } from "expo-router";
import { tokens } from "@/theme/tokens";

const options = { headerShown: false, contentStyle: { backgroundColor: tokens.card } } as const;

export default function CustomersLayout() {
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
