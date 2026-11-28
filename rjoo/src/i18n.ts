// Itami-specific UI strings (English + Japanese) merged with shared strings.
import { createI18n, type CommonKey, type Lang, type Text } from "../../src/shared/i18n.ts";

export type { Lang, Text };

const EXTRA = {
  title: { en: "Itami Taxi Guide", ja: "伊丹タキシーガイド" },
  eyebrow: { en: "RJOO · Osaka Itami", ja: "RJOO · 大阪国際空港" },
  search: { en: "Search stand, e.g. 15, 61, 84", ja: "スポット検索（例: 15、61、84）" },
  groupMain: { en: "Stands", ja: "スポット" },
  footer: {
    en: "Taxi logic follows the Squawk.ID RJOO landing and departure guides. Runway thresholds from X-Plane Custom Data (Navigraph AIRAC); taxiway geometry © OpenStreetMap contributors (ODbL); background map: GSI Tiles, Geospatial Information Authority of Japan. For flight simulation only — ATC instructions always take precedence.",
    ja: "タキシーの考え方は Squawk.ID の RJOO 到着・出発ガイドに基づきます。滑走路進入端は X-Plane Custom Data（Navigraph AIRAC）、誘導路形状は © OpenStreetMap contributors（ODbL）、背景地図は地理院タイル（国土地理院）。フライトシミュレーター専用です。常に管制指示が優先されます。",
  },
  mapLabel: { en: "RJOO taxiway map", ja: "RJOO 誘導路マップ" },
  rwyA: { en: "Runway A", ja: "A滑走路" },
  rwyB: { en: "Runway B", ja: "B滑走路" },
} satisfies Record<string, Text>;

export type ExtraKey = keyof typeof EXTRA;
export type Key = ExtraKey | CommonKey;

const i18n = createI18n(EXTRA);
export const { getLang, setLang, t, tx } = i18n;
export default i18n;
