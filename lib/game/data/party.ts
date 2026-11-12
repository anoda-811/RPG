import type { Look } from "../art/characters";

/** パーティに加入しうる人物（主人公＋仲間候補） */
export type MemberId = "hero" | "warrior" | "mage" | "thief";
export const MEMBER_IDS: MemberId[] = ["hero", "warrior", "mage", "thief"];

/** 主人公の名前は {hero} と書けば、入力された名前に置き換わる */
export const NAMES = {
  hero: "{hero}",
  warrior: "ガレス",
  mage: "ミナ",
  thief: "カイ",
  gorudo: "旅人ゴルド",
  dragon: "炎龍ヴォルガノス",
  smith: "ブロック",
  armorer: "マーサ",
  priest: "シスター・リタ",
  innkeeper: "おかみのトリン",
  grocer: "ピート",
  villager: "ネル",
} as const;

export const BASE_STATS: Record<MemberId, { maxHp: number; atk: number; def: number }> = {
  hero: { maxHp: 40, atk: 4, def: 2 },
  warrior: { maxHp: 55, atk: 6, def: 4 },
  mage: { maxHp: 32, atk: 3, def: 2 },
  thief: { maxHp: 38, atk: 5, def: 2 },
};

export const START_EQUIP: Record<MemberId, { weapon: string; armor: string }> = {
  hero: { weapon: "rustySword", armor: "clothes" },
  warrior: { weapon: "ironSword", armor: "leather" },
  mage: { weapon: "oakStaff", armor: "magerobe" },
  thief: { weapon: "dagger", armor: "clothes" },
};

export type LookId =
  | "hero"
  | "warrior"
  | "mage"
  | "thief"
  | "gorudo"
  | "smith"
  | "armorer"
  | "priest"
  | "innkeeper"
  | "grocer"
  | "villager";

export const LOOKS: Record<LookId, Look> = {
  hero: {
    hair: ["#7a3e1d", "#4a2412", "#b5652e"],
    skin: ["#f6c9a0", "#d9946b"],
    top: ["#3a7ae6", "#1f3f8a", "#7fb0ff"],
    bottom: "#2b2538",
    bottomShadow: "#1a1626",
    boots: "#5a3418",
    trim: "#ffd84a",
    cape: ["#e0382e", "#8e1f22"],
    weapon: "sword",
  },
  warrior: {
    hair: ["#e8c24a", "#b08a2a", "#fff2a8"],
    skin: ["#f2bd94", "#cf8a62"],
    top: ["#8c86a0", "#565068", "#c8c2d8"],
    bottom: "#4a4456",
    bottomShadow: "#34303f",
    boots: "#2b2538",
    trim: "#ffd84a",
    headgear: "helmet",
    headColor: ["#b8b4c8", "#6c6880"],
    weapon: "shield",
  },
  mage: {
    hair: ["#cdd0d8", "#8c86a0", "#ffffff"],
    skin: ["#f6d0b0", "#dfa583"],
    top: ["#9352d8", "#4c2384", "#c08cff"],
    bottom: "#9352d8",
    bottomShadow: "#4c2384",
    boots: "#2b2538",
    trim: "#5fd3f0",
    robe: true,
    headgear: "witch",
    headColor: ["#4c2384", "#2b1450"],
    weapon: "staff",
  },
  thief: {
    hair: ["#2b2538", "#16121f", "#4a4456"],
    skin: ["#e8b088", "#c08060"],
    top: ["#46c25a", "#1f6e35", "#8ff0a0"],
    bottom: "#3a3050",
    bottomShadow: "#241d33",
    boots: "#5a3418",
    trim: "#e0382e",
    headgear: "bandana",
    headColor: ["#e0382e", "#8e1f22"],
    weapon: "dagger",
  },
  gorudo: {
    hair: ["#cdd0d8", "#8c86a0", "#ffffff"],
    skin: ["#e8b088", "#c08060"],
    top: ["#a8622e", "#6b3a1e", "#d68f5a"],
    bottom: "#5a3418",
    bottomShadow: "#3a2110",
    boots: "#2b2538",
    trim: "#c8962a",
    headgear: "hood",
    headColor: ["#6b3a1e", "#3a2110"],
    beard: "#eeeeee",
    weapon: "oldStaff",
  },
  smith: {
    hair: ["#3a2a22", "#22170f", "#5a4032"],
    skin: ["#e8b088", "#c08060"],
    top: ["#6b4a2b", "#3a2110", "#a8704a"],
    bottom: "#3a3050",
    bottomShadow: "#241d33",
    boots: "#2b2538",
    trim: "#c8962a",
  },
  armorer: {
    hair: ["#7a5a9a", "#4a3468", "#a88ac8"],
    skin: ["#f6d0b0", "#dfa583"],
    top: ["#2e8a5a", "#1a5238", "#6fd0a0"],
    bottom: "#3a3050",
    bottomShadow: "#241d33",
    boots: "#5a3418",
    trim: "#ffd84a",
  },
  priest: {
    hair: ["#f0e6d8", "#b8b4c8", "#ffffff"],
    skin: ["#f6d0b0", "#dfa583"],
    top: ["#f4f1ea", "#b8b4c8", "#ffffff"],
    bottom: "#f4f1ea",
    bottomShadow: "#b8b4c8",
    boots: "#5a3418",
    trim: "#ffd84a",
    robe: true,
    headgear: "hood",
    headColor: ["#f4f1ea", "#b8b4c8"],
  },
  innkeeper: {
    hair: ["#8a3b2a", "#5a2418", "#c0604a"],
    skin: ["#f2bd94", "#cf8a62"],
    top: ["#e0a040", "#a06820", "#ffd080"],
    bottom: "#5a3418",
    bottomShadow: "#3a2110",
    boots: "#2b2538",
    trim: "#2e8a5a",
  },
  grocer: {
    hair: ["#2b2538", "#16121f", "#4a4456"],
    skin: ["#e8b088", "#c08060"],
    top: ["#c8c040", "#8a8020", "#f0f070"],
    bottom: "#4a4456",
    bottomShadow: "#34303f",
    boots: "#5a3418",
    trim: "#8a6a44",
  },
  villager: {
    hair: ["#c0604a", "#8a3b2a", "#e08a6a"],
    skin: ["#f6c9a0", "#d9946b"],
    top: ["#5fa8d8", "#2f6b95", "#9fd4f0"],
    bottom: "#7a6a58",
    bottomShadow: "#55483d",
    boots: "#5a3418",
    trim: "#ffffff",
  },
};
