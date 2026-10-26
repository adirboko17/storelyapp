import { useLocalSearchParams } from "expo-router";
import { AreaList } from "@/components/area-list";
import { NightScreen, SheetEmpty } from "@/components/shell";
import { LoadingBlock } from "@/components/ui";
import { allows } from "@/lib/access";
import { MENU, areaByKey, type AreaKey } from "@/lib/menu";
import { useStoreData } from "@/lib/store-data";

export default function AreaScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const area = areaByKey(typeof key === "string" ? key : "");
  const { access, loading } = useStoreData();
  const group = MENU.find((item) => item.items.some((entry) => entry.key === area?.key));
  const options = group?.items
    .filter((item) => (item.settings ? Boolean(access?.settings) : item.permission ? allows(access, item.permission) : true))
    .map((item) => ({ label: item.label, href: `/more/area/${item.key}`, active: item.key === area?.key }));
  if (!area) return <NightScreen title="מודול"><SheetEmpty text="המסך לא נמצא." /></NightScreen>;
  const allowed = area.settings ? Boolean(access?.settings) : area.permission ? allows(access, area.permission) : true;
  return (
    <NightScreen title={area.label} options={options}>
      {loading ? <LoadingBlock /> : allowed ? <AreaList area={area.key as AreaKey} /> : <SheetEmpty text="אין הרשאה למסך הזה." />}
    </NightScreen>
  );
}
