export type ItemKind = "weapon" | "armor" | "consumable" | "key";

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  price: number;
  atk?: number;
  def?: number;
  heal?: number;
}

const LIST: ItemDef[] = [
  { id: "rustySword", name: "さびた剣", kind: "weapon", price: 0, atk: 3 },
  { id: "ironSword", name: "鉄の剣", kind: "weapon", price: 200, atk: 8 },
  { id: "steelSword", name: "鋼の剣", kind: "weapon", price: 600, atk: 14 },
  { id: "flameSword", name: "炎の剣", kind: "weapon", price: 1800, atk: 22 },
  { id: "dagger", name: "短剣", kind: "weapon", price: 100, atk: 4 },
  { id: "swiftDagger", name: "疾風の短剣", kind: "weapon", price: 500, atk: 10 },
  { id: "oakStaff", name: "樫の杖", kind: "weapon", price: 120, atk: 4 },
  { id: "sageStaff", name: "賢者の杖", kind: "weapon", price: 700, atk: 12 },

  { id: "clothes", name: "布の服", kind: "armor", price: 0, def: 1 },
  { id: "leather", name: "革の鎧", kind: "armor", price: 150, def: 4 },
  { id: "iron", name: "鉄の鎧", kind: "armor", price: 500, def: 9 },
  { id: "magerobe", name: "魔導のローブ", kind: "armor", price: 400, def: 7 },
  { id: "flameArmor", name: "炎の護り", kind: "armor", price: 1500, def: 16 },

  { id: "potion", name: "ポーション", kind: "consumable", price: 30, heal: 50 },

  { id: "charm", name: "炎の護符", kind: "key", price: 0 },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(LIST.map((i) => [i.id, i]));

export interface ShopDef {
  title: string;
  items: string[];
}

export const SHOPS: Record<"weapon" | "armor" | "item", ShopDef> = {
  weapon: {
    title: "武器屋",
    items: ["ironSword", "steelSword", "flameSword", "dagger", "swiftDagger", "oakStaff", "sageStaff"],
  },
  armor: {
    title: "防具屋",
    items: ["leather", "iron", "magerobe", "flameArmor"],
  },
  item: {
    title: "道具屋",
    items: ["potion"],
  },
};

/** 装備やアイテムの効果を短く表示する文字列 */
export function itemStat(it: ItemDef): string {
  if (it.kind === "weapon") return `攻+${it.atk ?? 0}`;
  if (it.kind === "armor") return `防+${it.def ?? 0}`;
  return `回復${it.heal ?? 0}`;
}
