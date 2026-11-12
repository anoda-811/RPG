import type { EntityDef, MapDef } from "../world/types";
import { LOOKS, NAMES } from "./party";
import { DRAGON_WAKE_STEPS } from "./scripts";

/*
 * タイル凡例
 *   # 岩壁（通行不可）     . 黒い岩床（通行可）     a 灰の大地（通行可）
 *   , 灰と溶けた亀裂（通行可）  ~ 溶岩（通行不可）   = 橋（通行可）
 *   A 祭壇（通行可）      R 赤い絨毯（通行可）     D 出入口（踏むと移動）
 *   T 松明のついた壁（通行不可）  x 枯れ木（通行不可）  o 岩（通行不可）
 *   g 草地（通行可）      p 石畳の道（通行可）     t 木（通行不可）
 *   r 屋根（通行不可）    H 家の壁（通行不可）     d 扉（通行不可・店の前で話す）
 */

/** 村の地図は「文字+個数」の記法で書く（例: g14 は g が14個）。読み込み時に展開する。 */
function expand(rle: string): string {
  return (rle.match(/[^\d]\d*/g) ?? [])
    .map((part) => part[0].repeat(part.length > 1 ? Number(part.slice(1)) : 1))
    .join("");
}

/** 風見の村（スタート地点・各店） */
export const VILLAGE: MapDef = {
  id: "village",
  name: "風見の村",
  outdoor: true,
  bgm: "village",
  spawn: { x: 14, y: 8, dir: "up" },
  rows: [
    "t14p1t15",
    "t1g13p1g14t1",
    "g2r6g6p1g1r6g1r6t1",
    "g2r6g6p1g1r6g1r6t1",
    "g2H6g6p1g1H6g1H6t1",
    "g2H2d1H3g6p1g1H2d1H3g1H2d1H3t1",
    "g2p26g1t1",
    "g14p1g15",
    "g14p1g15",
    "g1t1g12p1g15",
    "g14p1g15",
    "g14p1g15",
    "g2r6g6p1g8r6t1",
    "g2r6g6p1g8r6t1",
    "g2H6g6p1g8H6t1",
    "g2H2d1H3g6p1g8H2d1H3t1",
    "g2p26g1t1",
    "g14p1g15",
    "t1g28t1",
    "t30",
  ].map(expand),
  warps: [{ x: 14, y: 0, map: "entrance", tx: 12, ty: 12 }],
  entities: [
    {
      kind: "npc",
      id: "smith",
      name: NAMES.smith,
      look: LOOKS.smith,
      x: 4,
      y: 6,
      dir: "up",
      talk: [
        { t: "say", speaker: NAMES.smith, text: "いらっしゃい！ 炎龍相手じゃ、いい剣が要るぞ。" },
        { t: "menu", name: "weapon" },
      ],
    },
    {
      kind: "npc",
      id: "armorer",
      name: NAMES.armorer,
      look: LOOKS.armorer,
      x: 25,
      y: 6,
      dir: "up",
      talk: [
        { t: "say", speaker: NAMES.armorer, text: "防具は命綱だよ。溶岩の熱にも耐える品を揃えてある。" },
        { t: "menu", name: "armor" },
      ],
    },
    {
      kind: "npc",
      id: "priest",
      name: NAMES.priest,
      look: LOOKS.priest,
      x: 18,
      y: 6,
      dir: "up",
      talk: [
        { t: "say", speaker: NAMES.priest, text: "教会へようこそ。ここでは旅の記録を残せますよ。" },
        { t: "menu", name: "church" },
      ],
    },
    {
      kind: "npc",
      id: "innkeeper",
      name: NAMES.innkeeper,
      look: LOOKS.innkeeper,
      x: 4,
      y: 16,
      dir: "up",
      talk: [
        { t: "say", speaker: NAMES.innkeeper, text: "いらっしゃい！ 一泊50Gでぐっすり休めるよ。" },
        { t: "menu", name: "inn" },
      ],
    },
    {
      kind: "npc",
      id: "grocer",
      name: NAMES.grocer,
      look: LOOKS.grocer,
      x: 25,
      y: 16,
      dir: "up",
      talk: [
        { t: "say", speaker: NAMES.grocer, text: "ポーションはあるよ。火傷の薬にもなるからね。" },
        { t: "menu", name: "item" },
      ],
    },
    {
      kind: "npc",
      id: "villager",
      name: NAMES.villager,
      look: LOOKS.villager,
      x: 10,
      y: 12,
      dir: "right",
      talk: [
        { t: "say", speaker: NAMES.villager, text: "山の上の龍さま、ずっと眠ってるって父さんが言ってた。" },
        { t: "say", speaker: NAMES.villager, text: "でも最近、山が少しずつ熱くなってるの……。" },
      ],
    },
    {
      kind: "npc",
      id: "warrior",
      name: NAMES.warrior,
      look: LOOKS.warrior,
      x: 8,
      y: 7,
      dir: "down",
      recruitId: "warrior",
      recruitTalk: [
        { t: "say", speaker: NAMES.warrior, text: "おい、炎龍を倒しに行くんだろ？" },
        { t: "say", speaker: NAMES.warrior, text: "俺も連れて行ってくれ。前は任せろ！" },
        { t: "recruit", id: "warrior" },
        { t: "say", speaker: NAMES.hero, text: "頼りにしてるぜ、ガレス！" },
      ],
    },
    {
      kind: "npc",
      id: "mage",
      name: NAMES.mage,
      look: LOOKS.mage,
      x: 15,
      y: 9,
      dir: "left",
      recruitId: "mage",
      recruitTalk: [
        { t: "say", speaker: NAMES.mage, text: "火山の魔力が乱れてる……。わたしも行くわ。" },
        { t: "say", speaker: NAMES.mage, text: "回復はまかせて。足手まといにはならないから。" },
        { t: "recruit", id: "mage" },
        { t: "say", speaker: NAMES.hero, text: "助かる、ミナ。" },
      ],
    },
    {
      kind: "npc",
      id: "thief",
      name: NAMES.thief,
      look: LOOKS.thief,
      x: 21,
      y: 17,
      dir: "left",
      recruitId: "thief",
      recruitTalk: [
        { t: "say", speaker: NAMES.thief, text: "祭壇にはお宝があるって噂だろ？" },
        { t: "say", speaker: NAMES.thief, text: "見張りは任せな。俺も連れてけよ。" },
        { t: "recruit", id: "thief" },
        { t: "say", speaker: NAMES.hero, text: "よろしく頼む、カイ。" },
      ],
    },
  ],
  triggers: [],
};

/** 火山の入口（屋外） */
export const ENTRANCE: MapDef = {
  id: "entrance",
  name: "火山の入口",
  outdoor: true,
  bgm: "ashfield",
  spawn: { x: 12, y: 8, dir: "up" },
  rows: [
    "########################",
    "#######D################",
    "#aaaa.aa.xaaa..aaa.aaaa#",
    "#a.aaa..aa.x.aaaaa..aa.#",
    "#aa,,,aaaaa..aaaaaaa.aa#",
    "#a..oa...aaaa..aaa~~aa.#",
    "#ax.aaaaaaa..aa.a~~~aaa#",
    "#aaaaa.a.aaa.aaaaaaa.aa#",
    "#.aaaaaaa.aaaaaaaaaaaa.#",
    "#aa.a,,,,a.aaxaa.aaa..a#",
    "#aaaa.aaaaaaaa....aaaaa#",
    "#.aaaaaaaaaaaaaaaaaaaaa#",
    "#aaaaaaaaaaaaaaaaaaaaaa#",
    "############D###########",
  ],
  warps: [
    { x: 7, y: 1, map: "dungeon", tx: 12, ty: 20 },
    { x: 12, y: 13, map: "village", tx: 14, ty: 1 },
  ],
  entities: [
    {
      kind: "npc",
      id: "gorudo",
      name: NAMES.gorudo,
      look: LOOKS.gorudo,
      x: 16,
      y: 8,
      dir: "down",
      talk: [
        { t: "say", speaker: NAMES.gorudo, text: "おお、若いの。この先は炎龍の祭壇じゃ。" },
        { t: "say", speaker: NAMES.gorudo, text: "溶岩の熱気は命を削るぞ。足元には気をつけな。" },
      ],
    },
  ],
  triggers: [],
};

/** 炎龍の祭壇（洞窟・溶岩に囲まれたダンジョン） */
export const DUNGEON: MapDef = {
  id: "dungeon",
  name: "炎龍の祭壇",
  outdoor: false,
  bgm: "dragon_altar",
  spawn: { x: 12, y: 20, dir: "up" },
  rows: [
    "##########################",
    "#T......................T#",
    "#~~~~~~~~~~AAAA~~~~~~~~~~#",
    "#~~~~~~~~~~AAAA~~~~~~~~~~#",
    "#~~~~~~~~~~AAAA~~~~~~~~~~#",
    "#...........RR...........#",
    "#~~~~~~~~...RR...~~~~~~~~#",
    "#~~~~~~~~...RR...~~~~~~~~#",
    "#~~~~~~~~===RR===~~~~~~~~#",
    "#~~~~~~~~...RR...~~~~~~~~#",
    "#~~~~~~~~...RR...~~~~~~~~#",
    "#...........RR...........#",
    "#.....T.....RR.....T.....#",
    "#...........RR...........#",
    "#...~~~.....RR.....~~~...#",
    "#...~~~.....RR.....~~~...#",
    "#...........RR...........#",
    "#...........RR...........#",
    "#...........RR...........#",
    "#...........RR...........#",
    "#...........RR...........#",
    "############D#############",
  ],
  warps: [{ x: 12, y: 21, map: "entrance", tx: 7, ty: 2 }],
  entities: [
    { kind: "chest", id: "chest_potion", x: 2, y: 13, label: "ポーション×3", item: "potion", count: 3 },
    { kind: "chest", id: "chest_charm", x: 23, y: 13, label: "炎の護符", item: "charm" },
    { kind: "chest", id: "chest_gold", x: 3, y: 19, label: "500ゴールド", gold: 500 },
    {
      kind: "boss",
      id: "dragon",
      x: 11,
      y: 2,
      w: 4,
      h: 3,
      awakeFlag: "dragonAwake",
      talk: [{ t: "say", text: "巨大な龍が、祭壇の上で静かな寝息を立てている……。" }],
      talkAwake: [{ t: "say", speaker: NAMES.dragon, text: "……まだ我と戦う気か。" }],
    },
  ] satisfies EntityDef[],
  triggers: [{ id: "dragon_wake", x: 12, y: 9, steps: DRAGON_WAKE_STEPS }],
};

export const MAPS: Record<string, MapDef> = {
  [VILLAGE.id]: VILLAGE,
  [ENTRANCE.id]: ENTRANCE,
  [DUNGEON.id]: DUNGEON,
};
