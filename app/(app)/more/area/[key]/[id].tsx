import { useLayoutEffect } from "react";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { AreaDetail } from "@/components/area-detail";
import { AppText } from "@/components/ui";
import { allows } from "@/lib/access";
import { areaByKey, type AreaKey } from "@/lib/menu";
import { reportById } from "@/lib/reports";
import { useStoreData } from "@/lib/store-data";
import { tokens } from "@/theme/tokens";
import { View } from "react-native";

export default function AreaDetailScreen() {
  const params = useLocalSearchParams<{ key: string; id: string }>();
  const key = typeof params.key === "string" ? params.key : "";
  const rawId = typeof params.id === "string" ? params.id : "";
  const id = decodeURIComponent(rawId);
  const area = areaByKey(key);
  const navigation = useNavigation();
  const { access, loading } = useStoreData();
  const title = key === "reports" ? reportById(id)?.name ?? area?.label ?? "פרטים" : area?.label ?? "פרטים";
  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);
  if (!area) return <Denied text="המסך לא נמצא." />;
  if (loading) return null;
  const allowed = area.settings ? Boolean(access?.settings) : area.permission ? allows(access, area.permission) : true;
  if (!allowed) return <Denied text="אין הרשאה למסך הזה." />;
  return <AreaDetail area={area.key as AreaKey} id={id} />;
}

function Denied({ text }: { text: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: tokens.canvas, padding: 16 }}>
      <AppText style={{ color: tokens.inkSecondary }}>{text}</AppText>
    </View>
  );
}
