import type { Step } from "../world/types";
import { NAMES } from "./party";

/** ニューゲーム時の導入（村からスタート）。 */
export const INTRO_STEPS: Step[] = [
  { t: "say", text: "風見の村。紅蓮の火山のふもとに広がる、小さな村だ。" },
  { t: "say", text: "村の北の山道をのぼると火山の入口。その先に炎龍の祭壇がある。" },
  { t: "say", speaker: NAMES.hero, text: "まずは武器屋と防具屋で装備を整えるか。" },
  { t: "say", speaker: NAMES.hero, text: "仲間が必要なら、村の人に声をかけてみよう。" },
];

/** 祭壇の龍が目覚めるイベント。仲間が出場中の場合だけ、その仲間の台詞が出る。 */
export const DRAGON_WAKE_STEPS: Step[] = [
  { t: "say", text: "祭壇の奥で、何かが動いた……。" },
  { t: "bgm", id: "dragon_boss" },
  { t: "shake", frames: 90, power: 2 },
  { t: "flash", color: "#ff5b1f", frames: 24, alpha: 0.6 },
  { t: "setFlag", flag: "dragonAwake" },
  { t: "wait", frames: 40 },
  { t: "say", speaker: NAMES.dragon, text: "……千年の眠りを破るのは、どこの愚か者だ。" },
  { t: "say", speaker: NAMES.hero, text: "炎龍ヴォルガノス！ 村を焼いた報い、受けてもらう！" },
  { t: "say", speaker: NAMES.warrior, text: "下がれ！ 来るぞ！", when: "warrior" },
  { t: "breath", frames: 110 },
  { t: "say", speaker: NAMES.mage, text: "くっ……息だけで焼かれそう！", when: "mage" },
  { t: "say", speaker: NAMES.dragon, text: "その炎ごと、灰にしてくれよう。" },
  { t: "say", speaker: NAMES.thief, text: "へっ、望むところだぜ。", when: "thief" },
  { t: "say", text: "（デモはここまでです。戦闘システムは次の段階で実装します）" },
];
