// Airport chooser: bilingual copy, language switch and the five airport diagrams.
import "./style.css";
import "./chooser.css";
import { PREVIEWS } from "./previews.ts";

type Lang = "en" | "ja";
type Text = Record<Lang, string>;

const S = {
  pageTitle: { en: "Japan Airport Taxi Guides — Haneda, Narita, Itami, Kansai & Naha", ja: "日本の空港タクシーガイド — 羽田・成田・伊丹・関西・那覇" },
  langLabel: { en: "Language", ja: "言語" },
  airportsLabel: { en: "Airport taxi guides", ja: "空港タクシーガイド" },
  heading: { en: "Airport taxi guides", ja: "空港タクシーガイド" },
  lede: {
    en: "Haneda, Narita, Itami, Kansai and Naha, one guide each. Pick an airport for standard arrival and departure taxi routes, runway exits, apron gateways and turn-by-turn taxiing.",
    ja: "羽田・成田・伊丹・関西・那覇、それぞれのガイドを用意しています。空港を選ぶと、標準の到着・出発タキシールート、離脱誘導路、エプロンゲート、ターンバイターンの指示を地図で確認できます。",
  },
  openGuide: { en: "Open guide", ja: "ガイドを開く" },
  hanedaName: { en: "Haneda", ja: "羽田" },
  hanedaCode: { en: "RJTT · Tokyo International", ja: "RJTT · 東京国際空港" },
  hanedaDesc: {
    en: "Four runways on Tokyo Bay. North- and south-wind configurations, three terminals, and published exits and entries for every runway.",
    ja: "東京湾に広がる4本の滑走路。北風・南風の運用、3つのターミナル、滑走路ごとの離脱・進入点に対応しています。",
  },
  naritaName: { en: "Narita", ja: "成田" },
  naritaCode: { en: "RJAA · Narita International", ja: "RJAA · 成田国際空港" },
  naritaDesc: {
    en: "Parallel 16R/34R and 16L/34L. AIP Japan departure routes, apron gateways, and CAT II/III low-visibility taxiing.",
    ja: "16R/34R と 16L/34L の並行滑走路。AIP Japan の出発ルート、エプロンゲート、CAT II/III の低視程運用に対応しています。",
  },
  rjooName: { en: "Itami", ja: "伊丹" },
  rjooCode: { en: "RJOO · Osaka International", ja: "RJOO · 大阪国際空港" },
  rjooDesc: {
    en: "Parallel 14L/32R and 14R/32L. North- and south-wind configurations, standard runway crossings and published arrival and departure routes.",
    ja: "14L/32R と 14R/32L の並行滑走路。北風・南風の運用、標準的な滑走路横断、到着・出発のタキシールートに対応しています。",
  },
  rjbbName: { en: "Kansai", ja: "関西" },
  rjbbCode: { en: "RJBB · Kansai International", ja: "RJBB · 関西国際空港" },
  rjbbDesc: {
    en: "Two artificial islands in Osaka Bay. Parallel 06R/24L and 06L/24R, inter-island J3/J4 bridges, and standard arrival and departure taxi routes.",
    ja: "大阪湾の2つの人工島。06R/24L と 06L/24R の並行滑走路、島間を結ぶ J3/J4 連絡誘導路、標準の到着・出発タキシールートに対応しています。",
  },
  roahName: { en: "Naha", ja: "那覇" },
  roahCode: { en: "ROAH · Naha Airport", ja: "ROAH · 那覇空港" },
  roahDesc: {
    en: "Inboard 18L/36R and offshore 18R/36L in Okinawa. Seawall J1/J2 bridges, standard runway crossings and domestic, international and cargo aprons.",
    ja: "沖縄の陸側 18L/36R と沖合 18R/36L の並行滑走路。J1/J2 連絡誘導路、標準的な滑走路横断、国内線・国際線・貨物エプロンに対応しています。",
  },
  tagRunways4: { en: "4 runways", ja: "滑走路4本" },
  tagRunways2: { en: "2 runways", ja: "滑走路2本" },
  tagTerminals3: { en: "3 terminals", ja: "ターミナル3" },
  tagTerminals2: { en: "2 terminals", ja: "ターミナル2" },
  tagTerminals1: { en: "1 terminal", ja: "ターミナル1" },
  tagFlows: { en: "North / South", ja: "北風 / 南風" },
  tagLvp: { en: "CAT II/III", ja: "CAT II/III" },
  simDisclaimer: {
    en: "For flight simulation only. Not for real-world navigation — ATC instructions always take precedence.",
    ja: "フライトシミュレーター専用です。実際の航行には使用できません。常に管制指示が優先されます。",
  },
  gsiCredit: { en: "GSI Tiles", ja: "地理院タイル" },
  repo: { en: "Source on GitHub", ja: "GitHub リポジトリ" },
} satisfies Record<string, Text>;

type Key = keyof typeof S;

const LANG_KEY = "jpn-taxi-guide-lang";
const isJa = navigator.language.toLowerCase().startsWith("ja");
let lang: Lang = isJa ? "ja" : "en";
try {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved === "en" || saved === "ja") lang = saved;
} catch {
  /* storage unavailable */
}
const queryLang = new URLSearchParams(location.search).get("lang");
if (queryLang === "en" || queryLang === "ja") lang = queryLang;

const langHost = document.querySelector<HTMLElement>("#lang")!;

function moveThumb(value: Lang) {
  const thumb = langHost.querySelector<HTMLElement>(".thumb");
  const btns = [...langHost.querySelectorAll<HTMLElement>("button")];
  const i = btns.findIndex((b) => b.dataset.v === value);
  if (!thumb || i < 0) return;
  thumb.style.width = `calc((100% - 4px) / ${btns.length})`;
  thumb.style.transform = `translateX(${i * 100}%)`;
}

function renderLang() {
  langHost.innerHTML =
    '<span class="thumb"></span>' +
    ([
      ["en", "EN"],
      ["ja", "日本語"],
    ] as const)
      .map(
        ([v, label]) =>
          `<button type="button" role="tab" data-v="${v}" aria-selected="${v === lang}">${label}</button>`,
      )
      .join("");
  langHost.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
    b.onclick = () => {
      lang = b.dataset.v as Lang;
      try {
        localStorage.setItem(LANG_KEY, lang);
      } catch {
        /* ignore */
      }
      history.replaceState(null, "", `?lang=${lang}`);
      apply();
    };
  });
  requestAnimationFrame(() => moveThumb(lang));
}

/** Re-render every translated string and point both guide links at the chosen language. */
function apply() {
  document.documentElement.lang = lang;
  document.title = S.pageTitle[lang];
  for (const el of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const key = el.dataset.i18n as Key | undefined;
    if (key && key in S) el.textContent = S[key][lang];
  }
  for (const el of document.querySelectorAll<HTMLElement>("[data-i18n-aria]")) {
    const key = el.dataset.i18nAria as Key | undefined;
    if (key && key in S) el.setAttribute("aria-label", S[key][lang]);
  }
  for (const a of document.querySelectorAll<HTMLAnchorElement>("a[data-airport]")) {
    a.href = `./${a.dataset.airport}/?lang=${lang}`;
  }
  renderLang();
}

for (const host of document.querySelectorAll<HTMLElement>("[data-preview]")) {
  const key = host.dataset.preview as keyof typeof PREVIEWS;
  if (PREVIEWS[key]) host.innerHTML = PREVIEWS[key];
}

apply();
