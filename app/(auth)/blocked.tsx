import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText, PrimaryButton, QuietButton } from "@/components/ui";
import { useSession } from "@/lib/session";
import { useFontSet } from "@/theme/fonts";
import { cardShadow, tokens } from "@/theme/tokens";

export default function BlockedScreen() {
  const insets = useSafeAreaInsets();
  const fonts = useFontSet();
  const { error, refreshMemberships, signOut } = useSession();
  return (
    <View style={{ flex: 1, backgroundColor: tokens.canvas, paddingTop: insets.top + 24, paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}>
      <View style={[cardShadow, { padding: 20, gap: 12 }]}>
        <AppText style={{ fontFamily: fonts.bold, fontSize: 22, color: tokens.inkStrong }}>לא הצלחנו לטעון את החנויות</AppText>
        <AppText style={{ color: tokens.negative, lineHeight: 22 }}>{error || "הקריאה נדחתה."}</AppText>
        <PrimaryButton label="נסו שוב" onPress={() => void refreshMemberships()} />
        <QuietButton label="התנתקות" onPress={() => void signOut()} />
      </View>
    </View>
  );
}
