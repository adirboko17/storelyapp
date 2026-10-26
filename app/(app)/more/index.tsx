import { Pressable, ScrollView, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Icon } from "@/components/icon";
import { AppText, MenuBar } from "@/components/ui";
import { allows } from "@/lib/access";
import { MENU, type AreaItem } from "@/lib/menu";
import { useSession } from "@/lib/session";
import { useAllowed, useStoreData, useStoreTitle } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { cardShadow, tokens } from "@/theme/tokens";

export default function MoreScreen() {
  const fonts = useFontSet();
  const router = useRouter();
  const title = useStoreTitle();
  const { email, memberships, storeId, signOut } = useSession();
  const { access } = useStoreData();
  const discounts = useAllowed("discounts.read");
  const member = memberships.find((item) => item.storeId === storeId);
  const name = access?.name?.trim() || member?.memberName || "";
  const mail = access?.email?.trim() || email;
  const open = (item: AreaItem) => {
    if (item.settings) return Boolean(access?.settings);
    if (item.permission) return allows(access, item.permission);
    return true;
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.canvas }}>
      <MenuBar />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={[cardShadow, { padding: 16, gap: 4 }]}>
          {name ? <AppText style={{ fontFamily: fonts.bold, fontSize: 18, color: tokens.inkStrong }}>{name}</AppText> : null}
          {mail ? <AppText style={{ color: tokens.inkSecondary, writingDirection: "ltr", textAlign: "right" }}>{mail}</AppText> : null}
          <AppText style={{ color: tokens.inkSecondary, marginTop: 6 }}>{title}</AppText>
        </View>
        {MENU.map((group) => {
          const items = group.items.filter(open);
          const showDiscounts = group.title === "שיווק" && discounts;
          if (!items.length && !showDiscounts) return null;
          return (
            <View key={group.title} style={{ gap: 8 }}>
              <AppText style={{ color: tokens.inkSecondary, fontSize: 13, fontFamily: fonts.semibold }}>{group.title}</AppText>
              {items.map((item) => (
                <Pressable key={item.key} onPress={() => router.push(`/more/area/${item.key}` as Href)} style={[cardShadow, { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 }]}>
                  <AppText style={{ flex: 1, fontFamily: fonts.semibold }}>{item.label}</AppText>
                  <Icon name="chevron" color={tokens.inkSecondary} />
                </Pressable>
              ))}
              {showDiscounts ? (
                <Pressable onPress={() => router.push("/more/discounts")} style={[cardShadow, { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 }]}>
                  <Icon name="discount" color={tokens.ink} />
                  <AppText style={{ flex: 1, fontFamily: fonts.semibold }}>הנחות</AppText>
                  <Icon name="chevron" color={tokens.inkSecondary} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
        {memberships.length > 1 ? (
          <Pressable onPress={() => router.push("/pick-store")} style={[cardShadow, { minHeight: 52, paddingHorizontal: 14, justifyContent: "center" }]}>
            <AppText style={{ fontFamily: fonts.semibold }}>החלפת חנות</AppText>
          </Pressable>
        ) : null}
        <Pressable onPress={() => void signOut()} style={[cardShadow, { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 }]}>
          <Icon name="logout" color={tokens.ink} />
          <AppText style={{ fontFamily: fonts.semibold }}>התנתקות</AppText>
        </Pressable>
      </ScrollView>
    </View>
  );
}
