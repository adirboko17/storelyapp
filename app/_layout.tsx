import { useEffect } from "react";
import { View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LoadingBlock } from "@/components/ui";
import { SessionProvider, useSession } from "@/lib/session";
import { FontGate } from "@/theme/fonts";
import { tokens } from "@/theme/tokens";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export const unstable_settings = { initialRouteName: "(app)" };

function RootNavigator() {
  const session = useSession();
  const segments = useSegments();
  const router = useRouter();
  const group = segments[0];
  const screen = (segments as string[])[1];
  const booting = session.phase === "booting" || session.phase === "resolving";

  useEffect(() => {
    if (booting) return;
    if (session.phase === "unconfigured" || session.phase === "signed-out") {
      if (group !== "(auth)" || screen !== "login") router.replace("/login");
      return;
    }
    if (session.phase === "no-store") {
      if (screen !== "no-store") router.replace("/no-store");
      return;
    }
    if (session.phase === "blocked") {
      if (screen !== "blocked") router.replace("/blocked");
      return;
    }
    if (session.phase === "pick-store") {
      if (screen !== "pick-store") router.replace("/pick-store");
      return;
    }
    if (session.phase === "ready" && group === "(auth)" && screen !== "pick-store") router.replace("/");
  }, [booting, group, router, screen, session.phase]);

  if (booting) return <LoadingBlock label="טוען את הניהול…" />;

  const dark = group === "(auth)" && screen === "login";
  return (
    <View style={{ flex: 1, direction: "rtl", backgroundColor: dark ? tokens.login : tokens.canvas }}>
      {group === "(auth)" ? <StatusBar style={dark ? "light" : "dark"} /> : null}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.canvas } }} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <FontGate>
        <SplashReady>
          <SessionProvider>
            <RootNavigator />
          </SessionProvider>
        </SplashReady>
      </FontGate>
    </SafeAreaProvider>
  );
}

function SplashReady({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);
  return children;
}
