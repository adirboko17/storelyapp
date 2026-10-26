import { useMemo, useState } from "react";
import { PanResponder, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import { LAND_HEIGHT, LAND_MASK, LAND_WIDTH } from "@/lib/land-mask";

export type GlobeSpot = { key: string; lat: number; lon: number; color: string };

const DEG = Math.PI / 180;
const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const CELLS = 7000;
const HEX_RADIUS = Math.sqrt((4 * Math.PI) / CELLS) * 0.5;
const TILT = 22;
const HEX_COS = [0, 1, 2, 3, 4, 5].map((k) => Math.cos(((k * 60 + 30) * Math.PI) / 180) * HEX_RADIUS);
const HEX_SIN = [0, 1, 2, 3, 4, 5].map((k) => Math.sin(((k * 60 + 30) * Math.PI) / 180) * HEX_RADIUS);

function tenth(value: number) {
  return Math.round(value * 10) / 10;
}

function decodeMask() {
  const bytes = new Uint8Array(Math.floor((LAND_MASK.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of LAND_MASK) {
    if (char === "=") break;
    buffer = ((buffer << 6) | BASE64.indexOf(char)) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[index++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes;
}

let cells: { lat: Float32Array; lon: Float32Array } | null = null;

function landCells() {
  if (cells) return cells;
  const mask = decodeMask();
  const lats: number[] = [];
  const lons: number[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < CELLS; i++) {
    const y = 1 - (2 * (i + 0.5)) / CELLS;
    const lat = Math.asin(y) / DEG;
    const lon = ((((i * golden) / DEG) % 360) + 360) % 360 - 180;
    const row = Math.min(LAND_HEIGHT - 1, Math.max(0, Math.floor(90 - lat)));
    const col = Math.min(LAND_WIDTH - 1, Math.floor(lon + 180));
    const bit = row * LAND_WIDTH + col;
    if (mask[bit >> 3] & (1 << (bit & 7))) {
      lats.push(lat);
      lons.push(lon);
    }
  }
  cells = { lat: Float32Array.from(lats), lon: Float32Array.from(lons) };
  return cells;
}

function nearestCell(lat: number, lon: number) {
  const { lat: lats, lon: lons } = landCells();
  const sinA = Math.sin(lat * DEG);
  const cosA = Math.cos(lat * DEG);
  let best = -1;
  let bestDot = -2;
  for (let i = 0; i < lats.length; i++) {
    const dot = sinA * Math.sin(lats[i] * DEG) + cosA * Math.cos(lats[i] * DEG) * Math.cos((lons[i] - lon) * DEG);
    if (dot > bestDot) {
      bestDot = dot;
      best = i;
    }
  }
  return best;
}

function hexPaths(size: number, centerLon: number, colored: Map<number, string>) {
  const { lat: lats, lon: lons } = landCells();
  const radius = size / 2;
  const sin0 = Math.sin(TILT * DEG);
  const cos0 = Math.cos(TILT * DEG);
  const base: string[] = [];
  const extra = new Map<string, string[]>();
  for (let i = 0; i < lats.length; i++) {
    const phi = lats[i] * DEG;
    const lambda = (lons[i] - centerLon) * DEG;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    const sinL = Math.sin(lambda);
    const cosL = Math.cos(lambda);
    const depth = sinPhi * sin0 + cosPhi * cosL * cos0;
    if (depth < 0.06) continue;
    const px = cosPhi * sinL;
    const py = sinPhi * cos0 - cosPhi * cosL * sin0;
    const ex = cosL;
    const ey = sinL * sin0;
    const nx = -sinPhi * sinL;
    const ny = cosPhi * cos0 + sinPhi * cosL * sin0;
    let d = "";
    for (let k = 0; k < 6; k++) {
      const c = HEX_COS[k];
      const s = HEX_SIN[k];
      d += (k ? "L" : "M") + tenth(radius + (px + c * ex + s * nx) * radius) + " " + tenth(radius - (py + c * ey + s * ny) * radius);
    }
    d += "Z";
    const color = colored.get(i);
    if (color) {
      const list = extra.get(color) ?? [];
      list.push(d);
      extra.set(color, list);
    } else {
      base.push(d);
    }
  }
  return { base: base.join(""), extra: [...extra.entries()].map(([color, list]) => ({ color, d: list.join("") })) };
}

function project(lat: number, lon: number, centerLon: number, radius: number) {
  const phi = lat * DEG;
  const lambda = (lon - centerLon) * DEG;
  const sin0 = Math.sin(TILT * DEG);
  const cos0 = Math.cos(TILT * DEG);
  const depth = Math.sin(phi) * sin0 + Math.cos(phi) * Math.cos(lambda) * cos0;
  if (depth <= 0.05) return null;
  const x = Math.cos(phi) * Math.sin(lambda);
  const y = Math.sin(phi) * cos0 - Math.cos(phi) * Math.cos(lambda) * sin0;
  return { x: radius + x * radius, y: radius - y * radius };
}

function pinPath(x: number, y: number) {
  return `M${x} ${y}C${x - 2} ${y - 4} ${x - 8} ${y - 9} ${x - 8} ${y - 15}A8 8 0 1 1 ${x + 8} ${y - 15}C${x + 8} ${y - 9} ${x + 2} ${y - 4} ${x} ${y}Z`;
}

export function Globe({
  size,
  spots,
  pin,
  initialLon = 30,
}: {
  size: number;
  spots: GlobeSpot[];
  pin?: { lat: number; lon: number } | null;
  initialLon?: number;
}) {
  const [lon, setLon] = useState(initialLon);
  const [responder] = useState(() => {
    const motion = { lon: initialLon, start: initialLon };
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) > 4 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 4 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        motion.start = motion.lon;
      },
      onPanResponderMove: (_, gesture) => {
        motion.lon = motion.start - gesture.dx * 0.5;
        setLon(motion.lon);
      },
    });
  });

  const colored = useMemo(() => {
    const map = new Map<number, string>();
    for (const spot of spots) {
      const index = nearestCell(spot.lat, spot.lon);
      if (index >= 0 && !map.has(index)) map.set(index, spot.color);
    }
    return map;
  }, [spots]);

  const paths = useMemo(() => hexPaths(size, lon, colored), [size, lon, colored]);
  const radius = size / 2;
  const pad = size * 0.08;
  const outer = size + pad * 2;
  const pinPoint = pin ? project(pin.lat, pin.lon, lon, radius) : null;

  return (
    <View style={{ width: outer, height: outer, alignSelf: "center" }} {...responder.panHandlers}>
      <Svg width={outer} height={outer}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0.84" stopColor="#bdf5df" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#bdf5df" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="sphere" cx="45%" cy="40%" r="60%">
            <Stop offset="0" stopColor="#ffffff" />
            <Stop offset="0.75" stopColor="#e6f4fb" />
            <Stop offset="1" stopColor="#cbe5f6" />
          </RadialGradient>
          <LinearGradient id="land" x1="0" y1="0" x2="0.4" y2="1">
            <Stop offset="0" stopColor="#8ee8b8" />
            <Stop offset="0.5" stopColor="#5fd6c4" />
            <Stop offset="1" stopColor="#56b9ec" />
          </LinearGradient>
          <LinearGradient id="pin" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#a47bff" />
            <Stop offset="1" stopColor="#6a3df0" />
          </LinearGradient>
        </Defs>
        <Circle cx={outer / 2} cy={outer / 2} r={outer / 2} fill="url(#glow)" />
        <Circle cx={outer / 2} cy={outer / 2} r={radius} fill="url(#sphere)" />
        <Path d={paths.base} fill="url(#land)" translateX={pad} translateY={pad} />
        {paths.extra.map((group) => <Path key={group.color} d={group.d} fill={group.color} translateX={pad} translateY={pad} />)}
        {pinPoint ? (
          <>
            <Path d={pinPath(pinPoint.x + pad, pinPoint.y + pad)} fill="url(#pin)" stroke="#ffffff" strokeWidth={1.2} />
            <Circle cx={pinPoint.x + pad} cy={pinPoint.y + pad - 15} r={3} fill="#ffffff" />
          </>
        ) : null}
      </Svg>
    </View>
  );
}

const PLACES: Record<string, [number, number]> = {
  "israel": [31.4, 34.9], "ישראל": [31.4, 34.9],
  "tel aviv": [32.08, 34.78], "תל אביב": [32.08, 34.78], "תל אביב-יפו": [32.08, 34.78],
  "jerusalem": [31.77, 35.21], "ירושלים": [31.77, 35.21],
  "haifa": [32.79, 34.99], "חיפה": [32.79, 34.99],
  "petah tikva": [32.09, 34.88], "פתח תקווה": [32.09, 34.88],
  "rishon lezion": [31.96, 34.8], "ראשון לציון": [31.96, 34.8],
  "netanya": [32.33, 34.86], "נתניה": [32.33, 34.86],
  "ashdod": [31.8, 34.65], "אשדוד": [31.8, 34.65],
  "beersheba": [31.25, 34.79], "beer sheva": [31.25, 34.79], "באר שבע": [31.25, 34.79],
  "eilat": [29.56, 34.95], "אילת": [29.56, 34.95],
  "united states": [39.8, -98.6], "ארצות הברית": [39.8, -98.6],
  "canada": [56, -106], "קנדה": [56, -106],
  "united kingdom": [54, -2], "בריטניה": [54, -2],
  "germany": [51, 10], "גרמניה": [51, 10],
  "france": [46.6, 2.4], "צרפת": [46.6, 2.4],
  "netherlands": [52.2, 5.3], "הולנד": [52.2, 5.3],
  "spain": [40, -4], "ספרד": [40, -4],
  "italy": [42.8, 12.5], "איטליה": [42.8, 12.5],
  "greece": [39, 22], "יוון": [39, 22],
  "cyprus": [35, 33], "קפריסין": [35, 33],
  "turkey": [39, 35], "türkiye": [39, 35], "טורקיה": [39, 35],
  "poland": [52, 19], "פולין": [52, 19],
  "ukraine": [49, 32], "אוקראינה": [49, 32],
  "russia": [61, 105], "רוסיה": [61, 105],
  "united arab emirates": [24, 54], "איחוד האמירויות": [24, 54],
  "jordan": [31, 36], "ירדן": [31, 36],
  "egypt": [26.8, 30.8], "מצרים": [26.8, 30.8],
  "india": [22, 79], "הודו": [22, 79],
  "australia": [-25, 134], "אוסטרליה": [-25, 134],
  "brazil": [-10, -52], "ברזיל": [-10, -52],
};

export function placeCoordinates(label: string | undefined): [number, number] | null {
  if (!label) return null;
  const parts = label.split(/[·,•|/]/).map((part) => part.trim().toLowerCase()).filter((part) => part && part !== "none");
  for (const part of [...parts].reverse()) {
    const found = PLACES[part];
    if (found) return found;
  }
  return null;
}
