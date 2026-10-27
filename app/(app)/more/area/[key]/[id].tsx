import { useLocalSearchParams } from "expo-router";
import { AreaDetail } from "@/components/area-detail";
import { CategoryEditor, CategoryPage } from "@/components/category-editor";
import { PopupEditor } from "@/components/popups";
import { QuizScreen } from "@/components/quiz-editor";
import { EventEditor, PostEditor } from "@/components/content-editor";
import { DetailScreen } from "@/components/detail";
import { SheetEmpty } from "@/components/shell";
import { LoadingBlock } from "@/components/ui";
import { allows } from "@/lib/access";
import { SEGMENTS, areaByKey, type AreaKey } from "@/lib/menu";
import { reportById } from "@/lib/reports";
import { useStoreData } from "@/lib/store-data";

export default function AreaDetailScreen() {
  const params = useLocalSearchParams<{ key: string; id: string }>();
  const key = typeof params.key === "string" ? params.key : "";
  const id = decodeURIComponent(typeof params.id === "string" ? params.id : "");
  const area = areaByKey(key);
  const { access, loading } = useStoreData();
  const segmentName = key === "segments" ? SEGMENTS.find((item) => item.id === id)?.name : undefined;
  const title = segmentName ?? (key === "reports" ? reportById(id)?.name ?? area?.label ?? "פרטים" : key === "abandoned" ? "עגלה נטושה" : key === "users" ? (id === "new" ? "הוספת משתמש" : "עריכת משתמש") : key === "policies" ? (id === "new" ? "פוליסה חדשה" : "פוליסה") : key === "shipping" ? "משלוח" : area?.label ?? "פרטים");
  if (!area) return <DetailScreen title="פרטים"><SheetEmpty text="המסך לא נמצא." /></DetailScreen>;
  const allowed = area.settings ? Boolean(access?.settings) : area.permission ? allows(access, area.permission) : true;
  if (area.key === "collections" && id === "new") {
    if (loading) return <LoadingBlock />;
    if (!allowed) return <DetailScreen title="הוספת קטגוריה"><SheetEmpty text="אין הרשאה למסך הזה." /></DetailScreen>;
    return <CategoryEditor />;
  }
  if (area.key === "collections") {
    if (loading) return <LoadingBlock />;
    if (!allowed) return <DetailScreen title="קטגוריה"><SheetEmpty text="אין הרשאה למסך הזה." /></DetailScreen>;
    return <CategoryPage id={id} />;
  }
  if (area.key === "popups") {
    if (loading) return <LoadingBlock />;
    if (!allowed) return <DetailScreen title="פופאפים"><SheetEmpty text="אין הרשאה למסך הזה." /></DetailScreen>;
    if (id === "quiz") return <QuizScreen />;
    return <PopupEditor id={id} />;
  }
  if (area.key === "posts" || area.key === "events") {
    if (loading) return <LoadingBlock />;
    if (!allowed) return <DetailScreen title={area.label}><SheetEmpty text="אין הרשאה למסך הזה." /></DetailScreen>;
    return area.key === "posts" ? <PostEditor id={id === "new" ? null : id} /> : <EventEditor id={id === "new" ? null : id} />;
  }
  return (
    <DetailScreen title={title} scroll={false}>
      {loading ? <LoadingBlock /> : allowed ? <AreaDetail area={area.key as AreaKey} id={id} /> : <SheetEmpty text="אין הרשאה למסך הזה." />}
    </DetailScreen>
  );
}
