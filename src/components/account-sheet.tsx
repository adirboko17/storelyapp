import { Image, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/icon";
import { AppText } from "@/components/ui";
import type { Membership } from "@/lib/session";
import { useFontSet } from "@/theme/fonts";
import { tokens } from "@/theme/tokens";

export function AccountSheet({
  visible,
  email,
  title,
  storeId,
  memberships,
  onClose,
  onSelect,
  onSignOut,
}: {
  visible: boolean;
  email: string;
  title: string;
  storeId: string | null;
  memberships: Membership[];
  onClose: () => void;
  onSelect: (storeId: string) => void;
  onSignOut: () => void;
}) {
  const insets = useSafeAreaInsets();
  const fonts = useFontSet();
  const stores = [...memberships].sort((a, b) => Number(b.storeId === storeId) - Number(a.storeId === storeId));
  const rows = stores.length
    ? stores
    : [{ storeId: storeId ?? "current", displayName: title, memberName: "", logoUrl: "" }];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", paddingTop: insets.top + 64, paddingHorizontal: 16 }}>
        <View style={{ backgroundColor: "#ffffff", borderRadius: 28, paddingVertical: 8, direction: "rtl", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}>
          {rows.map((store) => {
            const current = store.storeId === storeId;
            const name = current ? title : store.displayName;
            return (
              <Pressable
                key={store.storeId}
                onPress={() => {
                  if (!current) onSelect(store.storeId);
                }}
                style={{ minHeight: 64, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <StoreMark logoUrl={store.logoUrl} />
                <View style={{ flex: 1, alignItems: "flex-start", gap: 2 }}>
                  <AppText style={{ fontFamily: fonts.semibold, fontSize: 16, color: tokens.inkStrong, maxWidth: "100%" }} numberOfLines={1}>{name}</AppText>
                  {email ? <AppText style={{ color: tokens.inkSecondary, fontSize: 13, writingDirection: "ltr", maxWidth: "100%" }} numberOfLines={1}>{email}</AppText> : null}
                </View>
                {current ? <Icon name="check" size={16} color={tokens.inkStrong} strokeWidth={2} /> : null}
              </Pressable>
            );
          })}
          <View style={{ height: 1, backgroundColor: tokens.line, marginHorizontal: 16, marginTop: 4 }} />
          <Pressable onPress={onSignOut} style={{ height: 52, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }}>
              <Icon name="logout" size={20} color={tokens.inkStrong} strokeWidth={1.7} />
            </View>
            <AppText style={{ fontFamily: fonts.medium, fontSize: 16, color: tokens.inkStrong }}>התנתקות</AppText>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

function StoreMark({ logoUrl }: { logoUrl: string }) {
  if (logoUrl) {
    return (
      <View style={{ width: 40, height: 40, borderRadius: 20, overflow: "hidden", backgroundColor: "#f6f1fb", alignItems: "center", justifyContent: "center" }}>
        <Image source={{ uri: logoUrl }} style={{ width: 32, height: 32 }} resizeMode="contain" accessibilityIgnoresInvertColors />
      </View>
    );
  }
  return (
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#b03bd1", alignItems: "center", justifyContent: "center" }}>
      <Icon name="user" size={22} color="#ffffff" strokeWidth={1.7} />
    </View>
  );
}
