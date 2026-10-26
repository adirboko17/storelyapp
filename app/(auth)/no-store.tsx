import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText, PrimaryButton } from "@/components/ui";
import { useSession } from "@/lib/session";
import { useFontSet } from "@/theme/fonts";
import { cardShadow, tokens } from "@/theme/tokens";

export default function NoStoreScreen() {
  const insets = useSafeAreaInsets();
  const fonts = useFontSet();
  const { signOut } = useSession();
  return (
    <View style={{ flex: 1, backgroundColor: tokens.canvas, paddingTop: insets.top + 24, paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}>
      <View style={[cardShadow, { padding: 20, gap: 12 }]}>
        <AppText style={{ fontFamily: fonts.bold, fontSize: 22, color: tokens.inkStrong }}>אין לך חנות פעילה</AppText>
        <AppText style={{ color: tokens.inkSecondary, lineHeight: 22 }}>החשבון הזה לא משויך לחנות פעילה. פנו לבעל החנות.</AppText>
        <PrimaryButton label="התנתקות" onPress={() => void signOut()} />
      </View>
    </View>
  );
}
