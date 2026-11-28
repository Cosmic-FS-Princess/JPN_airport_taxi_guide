// Narita-specific UI strings (English + Japanese) merged with shared strings.
import { createI18n, type CommonKey, type Lang, type Text } from "../../src/shared/i18n.ts";

export type { Lang, Text };

const EXTRA = {
  title: { en: "Narita Taxi Guide", ja: "成田タキシーガイド" },
  eyebrow: { en: "RJAA · Narita International", ja: "RJAA · 成田国際空港" },
  search: { en: "Search stand, e.g. 11, 61, 150, T2", ja: "スポット検索（例: 11、61、150、T2）" },
  groupT1: { en: "Terminal 1", ja: "第1ターミナル" },
  groupT2: { en: "Terminal 2", ja: "第2ターミナル" },
  groupT3: { en: "Terminal 3", ja: "第3ターミナル" },
  gatewayTitle: { en: "Apron gateway {g}", ja: "エプロンゲート {g}" },
  gatewaySub: {
    en: "Contact NARITA RAMP CONTROL · hold at a red stop bar until cleared",
    ja: "NARITA RAMP CONTROL にコンタクト · 赤いストップバーでは許可まで停止",
  },
  gatewayMap: { en: "Gateway {g}", ja: "ゲート {g}" },
  lvp: { en: "Low visibility · CAT II/III", ja: "低視程運用 · CAT II/III" },
  lvpHint: {
    en: "Runway 16R only · depart via A1/A2 · vacate via A6/A7",
    ja: "16R のみ · 離場は A1/A2 · 離脱は A6/A7",
  },
  lvpNotice: {
    en: "LVP in force: CAT II/III taxi routes. Stop bars are ATC-controlled — hold until cleared.",
    ja: "低視程運用中：CAT II/III 滑行ルート。ストップバーは管制制御のため、許可まで停止してください。",
  },
  footer: {
    en: "Standard departure routes after AIP Japan RJAA AD 2.22 (V) (ROUTE 7–10, effective 3 Sep 2026); arrival flow after the RJAA AD 2.20 Taxiing Charts. Runway thresholds from AIP Japan AD 2.12; taxiway geometry © OpenStreetMap contributors (ODbL); background map: GSI Tiles, Geospatial Information Authority of Japan. For flight simulation only — ATC instructions always take precedence.",
    ja: "標準離場ルートは AIP Japan RJAA AD 2.22 (V)（ROUTE 7–10、2026年9月3日有効）、到着の流れは RJAA AD 2.20 タキシングチャートに基づきます。滑走路進入端は AIP Japan AD 2.12、誘導路形状は © OpenStreetMap contributors（ODbL）、背景地図は地理院タイル（国土地理院）。フライトシミュレーター専用です。常に管制指示が優先されます。",
  },
  mapLabel: { en: "RJAA taxiway map", ja: "RJAA 誘導路マップ" },
  rwyA: { en: "Runway A", ja: "A滑走路" },
  rwyB: { en: "Runway B", ja: "B滑走路" },
} satisfies Record<string, Text>;

export type ExtraKey = keyof typeof EXTRA;
export type Key = ExtraKey | CommonKey;

const i18n = createI18n(EXTRA);
export const { getLang, setLang, t, tx } = i18n;
export default i18n;
