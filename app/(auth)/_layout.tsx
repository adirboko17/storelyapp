import { Stack } from "expo-router";
import { tokens } from "@/theme/tokens";

export const unstable_settings = { initialRouteName: "login" };

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.canvas } }} />;
}
