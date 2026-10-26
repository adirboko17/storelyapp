import { useLocalSearchParams } from "expo-router";
import { AreaDetail } from "@/components/area-detail";
import { CategoryEditor } from "@/components/category-editor";
import { DetailScreen } from "@/components/detail";
import { SheetEmpty } from "@/components/shell";
import { LoadingBlock } from "@/components/ui";
import { allows } from "@/lib/access";
import { areaByKey, type AreaKey } from "@/lib/menu";
import { reportById } from "@/lib/reports";
import { useStoreData } from "@/lib/store-data";

export default function AreaDetailScreen() {
  const params = useLocalSearchParams<{ key: string; id: string }>();
  const key = typeof params.key === "string" ? params.key : "";
  const id = decodeURIComponent(typeof params.id === "string" ? params.id : "");
  const area = areaByKey(key);
  const { access, loading } = useStoreData();
  const title = key === "reports" ? reportById(id)?.name ?? area?.label ?? "פרטים" : key === "users" && id === "new" ? "הוספת משתמש" : area?.label ?? "פרטים";
  if (!area) return <DetailScreen title="פרטים"><SheetEmpty text="המסך לא נמצא." /></DetailScreen>;
  const allowed = area.settings ? Boolean(access?.settings) : area.permission ? allows(access, area.permission) : true;
  if (area.key === "collections" && id === "new") {
    if (loading) return <LoadingBlock />;
    if (!allowed) return <DetailScreen title="הוספת קטגוריה"><SheetEmpty text="אין הרשאה למסך הזה." /></DetailScreen>;
    return <CategoryEditor />;
  }
  return (
    <DetailScreen title={title} scroll={false}>
      {loading ? <LoadingBlock /> : allowed ? <AreaDetail area={area.key as AreaKey} id={id} /> : <SheetEmpty text="אין הרשאה למסך הזה." />}
    </DetailScreen>
  );
}
