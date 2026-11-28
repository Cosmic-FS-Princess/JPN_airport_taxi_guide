// Kansai-specific UI strings (English + Japanese) merged with shared strings.
import { createI18n, type CommonKey, type Lang, type Text } from "../../src/shared/i18n.ts";

export type { Lang, Text };

const EXTRA = {
  title: { en: "Kansai Taxi Guide", ja: "関西タキシーガイド" },
  eyebrow: { en: "RJBB · Kansai International", ja: "RJBB · 関西国際空港" },
  search: { en: "Search stand, e.g. 20, 88, 205, T2", ja: "スポット検索（例: 20、88、205、T2）" },
  groupT1: { en: "Terminal 1", ja: "第1ターミナル" },
  groupT2: { en: "Terminal 2", ja: "第2ターミナル" },
  groupS: { en: "South Cargo & Remote", ja: "南側貨物・オープンスポット" },
  groupN: { en: "Island 2 Cargo", ja: "2期島貨物" },
  footer: {
    en: "Taxi logic follows AIP Japan RJBB aerodrome charts and standard parallel/inter-island taxiway flows. Runway thresholds from X-Plane Custom Data (Navigraph AIRAC); taxiway geometry © OpenStreetMap contributors (ODbL); background map: GSI Tiles, Geospatial Information Authority of Japan. For flight simulation only — ATC instructions always take precedence.",
    ja: "タキシーの考え方は AIP Japan RJBB 飛行場図および平行誘導路・連絡誘導路の標準動線に基づきます。滑走路進入端は X-Plane Custom Data（Navigraph AIRAC）、誘導路形状は © OpenStreetMap contributors（ODbL）、背景地図は地理院タイル（国土地理院）。フライトシミュレーター専用です。常に管制指示が優先されます。",
  },
  mapLabel: { en: "RJBB taxiway map", ja: "RJBB 誘導路マップ" },
  rwyA: { en: "Runway A", ja: "A滑走路" },
  rwyB: { en: "Runway B", ja: "B滑走路" },
} satisfies Record<string, Text>;

export type ExtraKey = keyof typeof EXTRA;
export type Key = ExtraKey | CommonKey;

const i18n = createI18n(EXTRA);
export const { getLang, setLang, t, tx } = i18n;
export default i18n;
