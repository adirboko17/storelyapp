import { useLayoutEffect } from "react";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { AreaList } from "@/components/area-list";
import { AppText } from "@/components/ui";
import { allows } from "@/lib/access";
import { areaByKey, type AreaKey } from "@/lib/menu";
import { useStoreData } from "@/lib/store-data";
import { tokens } from "@/theme/tokens";
import { View } from "react-native";

export default function AreaScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const area = areaByKey(typeof key === "string" ? key : "");
  const navigation = useNavigation();
  const { access, loading } = useStoreData();
  useLayoutEffect(() => {
    navigation.setOptions({ title: area?.label ?? "מודול" });
  }, [area, navigation]);
  if (!area) return <Denied text="המסך לא נמצא." />;
  if (loading) return null;
  const allowed = area.settings ? Boolean(access?.settings) : area.permission ? allows(access, area.permission) : true;
  if (!allowed) return <Denied text="אין הרשאה למסך הזה." />;
  return <AreaList area={area.key as AreaKey} />;
}

function Denied({ text }: { text: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: tokens.canvas, padding: 16 }}>
      <AppText style={{ color: tokens.inkSecondary }}>{text}</AppText>
    </View>
  );
}
