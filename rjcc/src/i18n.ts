// New Chitose-specific UI strings (English + Japanese) merged with shared strings.
import { createI18n, type CommonKey, type Lang, type Text } from "../../src/shared/i18n.ts";

export type { Lang, Text };

const EXTRA = {
  title: { en: "New Chitose Taxi Guide", ja: "新千歳タキシーガイド" },
  eyebrow: { en: "RJCC · New Chitose", ja: "RJCC · 新千歳空港" },
  search: { en: "Search stand, e.g. 9, 65, 52, 83", ja: "スポット検索（例: 9、65、52、83）" },
  groupDom: { en: "Domestic Terminal", ja: "国内線ターミナル" },
  groupIntl: { en: "International Terminal", ja: "国際線ターミナル" },
  groupNorth: { en: "North Remote Apron", ja: "北側オープンスポット" },
  groupCargo: { en: "Cargo Apron", ja: "貨物エプロン" },
  footer: {
    en: "Taxi logic follows AIP Japan RJCC aerodrome charts and standard parallel-runway operations (Runway A 01L/19R and Runway B 01R/19L). Runway thresholds from X-Plane Custom Data (Navigraph AIRAC); taxiway geometry © OpenStreetMap contributors (ODbL); background map: GSI Tiles, Geospatial Information Authority of Japan. For flight simulation only — ATC instructions always take precedence.",
    ja: "タキシーの考え方は AIP Japan RJCC 飛行場図および並行滑走路の標準運用（A滑走路 01L/19R・B滑走路 01R/19L）に基づきます。滑走路進入端は X-Plane Custom Data（Navigraph AIRAC）、誘導路形状は © OpenStreetMap contributors（ODbL）、背景地図は地理院タイル（国土地理院）。フライトシミュレーター専用です。常に管制指示が優先されます。",
  },
  mapLabel: { en: "RJCC taxiway map", ja: "RJCC 誘導路マップ" },
  rwyA: { en: "Runway A", ja: "A滑走路" },
  rwyB: { en: "Runway B", ja: "B滑走路" },
} satisfies Record<string, Text>;

export type ExtraKey = keyof typeof EXTRA;
export type Key = ExtraKey | CommonKey;

const i18n = createI18n(EXTRA);
export const { getLang, setLang, t, tx } = i18n;
export default i18n;
