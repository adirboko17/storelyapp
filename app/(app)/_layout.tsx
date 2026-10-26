import { View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { AnimatedTabsContainer, MenuOverlay, MenuProvider } from "@/components/menu-motion";
import { FloatingTabBar } from "@/components/tab-bar";
import { HeaderProvider, SharedTabsHeader } from "@/components/tab-header";
import { useAllowed, StoreDataProvider } from "@/lib/store-data";
import { useSession } from "@/lib/session";
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
  const orders = useAllowed("orders.read");
  const products = useAllowed("products.read");
  const customers = useAllowed("customers.read");
  const allowed = (name: string) => {
    if (name === "orders") return orders;
    if (name === "products") return products;
    if (name === "customers") return customers;
    return true;
  };
  return (
    <MenuProvider>
      <HeaderProvider>
        <View style={{ flex: 1, backgroundColor: tokens.night }}>
          <AnimatedTabsContainer>
            <SharedTabsHeader />
          </AnimatedTabsContainer>
          <View style={{ flex: 1 }}>
            <Tabs
              detachInactiveScreens={false}
              tabBar={(props) => <FloatingTabBar {...props} allowed={allowed} />}
              screenOptions={{ headerShown: false, animation: "none", sceneStyle: { backgroundColor: tokens.night } }}
            >
              <Tabs.Screen name="index" options={{ title: "בית" }} />
              <Tabs.Screen name="orders" options={{ title: "הזמנות", lazy: false, href: orders ? undefined : null }} />
              <Tabs.Screen name="products" options={{ title: "מוצרים", lazy: false, href: products ? undefined : null }} />
              <Tabs.Screen name="customers" options={{ title: "לקוחות", lazy: false, href: customers ? undefined : null }} />
              <Tabs.Screen name="more" options={{ title: "תפריט" }} />
              <Tabs.Screen name="search" options={{ title: "חיפוש" }} />
            </Tabs>
          </View>
          <MenuOverlay />
        </View>
      </HeaderProvider>
    </MenuProvider>
  );
}
