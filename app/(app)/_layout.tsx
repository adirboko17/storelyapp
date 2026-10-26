import { Redirect, Tabs } from "expo-router";
import { Icon, type IconName } from "@/components/icon";
import { useAllowed, StoreDataProvider } from "@/lib/store-data";
import { useSession } from "@/lib/session";
import { useFontSet } from "@/theme/fonts";
import { tokens } from "@/theme/tokens";

export default function AppLayout() {
  const { phase } = useSession();
  if (phase !== "ready") {
    if (phase === "pick-store") return <Redirect href="/pick-store" />;
    if (phase === "no-store") return <Redirect href="/no-store" />;
    if (phase === "blocked") return <Redirect href="/blocked" />;
    return <Redirect href="/login" />;
  }
  return (
    <StoreDataProvider>
      <AppTabs />
    </StoreDataProvider>
  );
}

function AppTabs() {
  const fonts = useFontSet();
  const orders = useAllowed("orders.read");
  const products = useAllowed("products.read");
  const customers = useAllowed("customers.read");
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: tokens.card, borderTopColor: tokens.line, borderTopWidth: 1 },
        tabBarActiveTintColor: tokens.inkStrong,
        tabBarInactiveTintColor: tokens.inkSecondary,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "בית", tabBarIcon: icon("home") }} />
      <Tabs.Screen name="orders" options={{ title: "הזמנות", href: orders ? undefined : null, tabBarIcon: icon("orders") }} />
      <Tabs.Screen name="products" options={{ title: "מוצרים", href: products ? undefined : null, tabBarIcon: icon("tag") }} />
      <Tabs.Screen name="customers" options={{ title: "לקוחות", href: customers ? undefined : null, tabBarIcon: icon("user") }} />
      <Tabs.Screen name="more" options={{ title: "עוד", tabBarIcon: icon("menu") }} />
    </Tabs>
  );
}

function icon(name: IconName) {
  return ({ color }: { color: unknown }) => <Icon name={name} color={typeof color === "string" ? color : tokens.ink} size={20} />;
}
