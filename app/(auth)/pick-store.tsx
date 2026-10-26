import { Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/ui";
import { useSession } from "@/lib/session";
import { useFontSet } from "@/theme/fonts";
import { cardShadow, tokens } from "@/theme/tokens";

export default function PickStoreScreen() {
  const insets = useSafeAreaInsets();
  const fonts = useFontSet();
  const { memberships, selectStore } = useSession();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: tokens.canvas }} contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 12 }}>
      <AppText style={{ fontFamily: fonts.bold, fontSize: 22, color: tokens.inkStrong }}>בחירת חנות</AppText>
      <AppText style={{ color: tokens.inkSecondary, marginBottom: 4 }}>החשבון משויך לכמה חנויות פעילות.</AppText>
      {memberships.map((store) => (
        <Pressable key={store.storeId} onPress={() => void selectStore(store.storeId)} style={[cardShadow, { paddingHorizontal: 16, paddingVertical: 16 }]}>
          <AppText style={{ fontFamily: fonts.semibold, fontSize: 16, color: tokens.inkStrong }}>{store.displayName}</AppText>
        </Pressable>
      ))}
    </ScrollView>
  );
}
