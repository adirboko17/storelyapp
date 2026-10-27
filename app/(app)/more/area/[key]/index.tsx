import { Alert, Pressable } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { AreaList } from "@/components/area-list";
import { CategoriesScreen } from "@/components/categories";
import { Icon } from "@/components/icon";
import { CUSTOMER_SWITCH, ORDER_SWITCH, PRODUCT_SWITCH } from "@/components/rows";
import { NightScreen, SheetEmpty } from "@/components/shell";
import { LoadingBlock } from "@/components/ui";
import { allows } from "@/lib/access";
import { MENU, areaByKey, type AreaKey } from "@/lib/menu";
import { useStoreData } from "@/lib/store-data";
import { tokens } from "@/theme/tokens";

export default function AreaScreen() {
  const router = useRouter();
  const { key } = useLocalSearchParams<{ key: string }>();
  const area = areaByKey(typeof key === "string" ? key : "");
  const { access, loading } = useStoreData();
  const group = MENU.find((item) => item.items.some((entry) => entry.key === area?.key));
  const href = `/more/area/${area?.key ?? ""}`;
  const preset = [PRODUCT_SWITCH, ORDER_SWITCH, CUSTOMER_SWITCH].find((list) => list.some((item) => item.href === href));
  const options = preset
    ? preset.map((item) => ({ ...item, active: item.href === href }))
    : group?.items
      .filter((item) => (item.settings ? Boolean(access?.settings) : item.permission ? allows(access, item.permission) : true))
      .map((item) => ({ label: item.label, href: `/more/area/${item.key}`, active: item.key === area?.key }));
  if (!area) return <NightScreen title="מודול"><SheetEmpty text="המסך לא נמצא." /></NightScreen>;
  const allowed = area.settings ? Boolean(access?.settings) : area.permission ? allows(access, area.permission) : true;
  if (area.key === "collections") return <CategoriesScreen title={area.label} options={options ?? []} allowed={allowed} loading={loading} />;
  const create = area.key === "posts" ? "פוסט" : area.key === "events" ? "אירוע" : "";
  const canCreate = Boolean(create) && !loading && allowed && allows(access, "content.update");
  const addPopup = area.key === "popups" && !loading && allowed;
  return (
    <NightScreen
      title={area.label}
      options={options}
      actions={canCreate || addPopup ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={addPopup ? "הוספת פופאפ" : `הוספת ${create}`}
          onPress={() => {
            if (addPopup) {
              Alert.alert("הוספת פופאפ", "הוספת פופאפ אפשרית רק דרך העורך של האתר.", [{ text: "הבנתי" }]);
              return;
            }
            router.push(`/more/area/${area.key}/new` as Href);
          }}
          hitSlop={6}
          style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: tokens.nightRaised, opacity: pressed ? 0.55 : 1 })}
        >
          <Icon name="plus" size={18} color="#ffffff" strokeWidth={2} />
        </Pressable>
      ) : undefined}
    >
      {loading ? <LoadingBlock /> : allowed ? <AreaList area={area.key as AreaKey} /> : <SheetEmpty text="אין הרשאה למסך הזה." />}
    </NightScreen>
  );
}
