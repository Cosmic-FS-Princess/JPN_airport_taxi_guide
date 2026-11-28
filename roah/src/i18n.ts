// Naha-specific UI strings (English + Japanese) merged with shared strings.
import { createI18n, type CommonKey, type Lang, type Text } from "../../src/shared/i18n.ts";

export type { Lang, Text };

const EXTRA = {
  title: { en: "Naha Taxi Guide", ja: "那覇タキシーガイド" },
  eyebrow: { en: "ROAH · Naha Airport", ja: "ROAH · 那覇空港" },
  search: { en: "Search stand, e.g. 25, 34, 42, 62", ja: "スポット検索（例: 25、34、42、62）" },
  groupDom: { en: "Domestic Terminal", ja: "国内線ターミナル" },
  groupIntl: { en: "International Terminal", ja: "国際線ターミナル" },
  groupCargo: { en: "Cargo & North Apron", ja: "貨物・北側エプロン" },
  footer: {
    en: "Taxi logic follows AIP Japan ROAH aerodrome charts and standard dual-runway flows (offshore Runway 2 18R/36L and inboard Runway 1 18L/36R). Runway thresholds from X-Plane Custom Data (Navigraph AIRAC); taxiway geometry © OpenStreetMap contributors (ODbL); background map: GSI Tiles, Geospatial Information Authority of Japan. For flight simulation only — ATC instructions always take precedence.",
    ja: "タキシーの考え方は AIP Japan ROAH 飛行場図および平行滑走路の標準動線（沖合の第2滑走路 18R/36L・陸側の第1滑走路 18L/36R）に基づきます。滑走路進入端は X-Plane Custom Data（Navigraph AIRAC）、誘導路形状は © OpenStreetMap contributors（ODbL）、背景地図は地理院タイル（国土地理院）。フライトシミュレーター専用です。常に管制指示が優先されます。",
  },
  mapLabel: { en: "ROAH taxiway map", ja: "ROAH 誘導路マップ" },
  rwy1: { en: "Runway 1", ja: "第1滑走路" },
  rwy2: { en: "Runway 2", ja: "第2滑走路" },
} satisfies Record<string, Text>;

export type ExtraKey = keyof typeof EXTRA;
export type Key = ExtraKey | CommonKey;

const i18n = createI18n(EXTRA);
export const { getLang, setLang, t, tx } = i18n;
export default i18n;
