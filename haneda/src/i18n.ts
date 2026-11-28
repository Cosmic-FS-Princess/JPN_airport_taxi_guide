// Haneda-specific UI strings (English + Japanese) merged with shared strings.
import { createI18n, type CommonKey, type Lang, type Text } from "../../src/shared/i18n.ts";

export type { Lang, Text };

const EXTRA = {
  title: { en: "Haneda Taxi Guide", ja: "羽田タキシーガイド" },
  eyebrow: { en: "RJTT · Tokyo Haneda", ja: "RJTT · 東京国際空港" },
  search: { en: "Search stand, e.g. 61, 110, T3", ja: "スポット検索（例: 61、110、T3）" },
  groupT1: { en: "Terminal 1 side", ja: "第1ターミナル側" },
  groupT2: { en: "Terminal 2 side", ja: "第2ターミナル側" },
  groupT3: { en: "Terminal 3 side (Intl)", ja: "第3ターミナル側（国際線）" },
  footer: {
    en: "Taxi logic after Kono_Hana, “Tokyo International (Haneda) departure & arrival taxi overview” (bilibili). Runway thresholds from X-Plane Custom Data (Navigraph AIRAC); taxiway geometry © OpenStreetMap contributors (ODbL); background map: GSI Tiles, Geospatial Information Authority of Japan. For flight simulation only — ATC instructions always take precedence.",
    ja: "タキシーの考え方は Kono_Hana「東京国際空港（羽田）出発・到着タキシー概要」（bilibili）に基づきます。滑走路進入端は X-Plane Custom Data（Navigraph AIRAC）、誘導路形状は © OpenStreetMap contributors（ODbL）、背景地図は地理院タイル（国土地理院）。フライトシミュレーター専用です。常に管制指示が優先されます。",
  },
  mapLabel: { en: "RJTT taxiway map", ja: "RJTT 誘導路マップ" },
  rwyA: { en: "Runway A", ja: "A滑走路" },
  rwyB: { en: "Runway B", ja: "B滑走路" },
  rwyC: { en: "Runway C", ja: "C滑走路" },
  rwyD: { en: "Runway D", ja: "D滑走路" },
} satisfies Record<string, Text>;

export type ExtraKey = keyof typeof EXTRA;
export type Key = ExtraKey | CommonKey;

const i18n = createI18n(EXTRA);
export const { getLang, setLang, t, tx } = i18n;
export default i18n;
