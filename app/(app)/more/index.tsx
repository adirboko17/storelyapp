import { useRouter, type Href } from "expo-router";
import { AppMenu } from "@/components/app-menu";
import { useStatusBar } from "@/components/shell";

export default function MenuScreen() {
  useStatusBar("light");
  const router = useRouter();
  return <AppMenu onDismiss={() => router.navigate("/" as Href)} />;
}
