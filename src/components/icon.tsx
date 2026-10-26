import Svg, { Path } from "react-native-svg";
import { tokens } from "@/theme/tokens";

const ICONS = {
  home: "M3.5 9 10 3.8 16.5 9v7a1 1 0 0 1-1 1H12v-5H8v5H4.5a1 1 0 0 1-1-1z",
  orders: "M3.5 5.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2zM3.5 11H7l1 2h4l1-2h3.5",
  tag: "M3.5 4.5v5l7 7 6-6-7-7h-5a1 1 0 0 0-1 1zM7 7h.01",
  user: "M10 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 16.5c.7-3 3-4.5 6-4.5s5.3 1.5 6 4.5",
  menu: "M3.5 6h13M3.5 10h13M3.5 14h13",
  search: "M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM17 17l-3.5-3.5",
  chevron: "M12 6l-4 4 4 4",
  logout: "M8 4.5H4.5v11H8M11 6.5 14.5 10 11 13.5M14.5 10H7.5",
  discount: "M7.5 12.5l5-5M8 8h.01M12 12h.01M10 2.8l1.9 1.4 2.3-.1.7 2.2 1.9 1.3-.8 2.2.8 2.2-1.9 1.3-.7 2.2-2.3-.1L10 17.2l-1.9-1.4-2.3.1-.7-2.2-1.9-1.3.8-2.2-.8-2.2 1.9-1.3.7-2.2 2.3.1z",
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 18,
  color = tokens.ink,
  strokeWidth = 1.6,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path d={ICONS[name]} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
