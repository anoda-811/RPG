import type { Look } from "../art/characters";
import type { Dir } from "../core/constants";
import type { MemberId } from "../data/party";

/** NPCから開くメニュー（店・教会・宿屋） */
export type MenuName = "weapon" | "armor" | "item" | "church" | "inn";

/** イベントスクリプトの1命令。上から順に実行される。 */
export type Step =
  | { t: "say"; speaker?: string; text: string; when?: MemberId }
  | { t: "wait"; frames: number }
  | { t: "shake"; frames: number; power: number }
  | { t: "flash"; color: string; frames: number; alpha: number }
  | { t: "setFlag"; flag: string }
  | { t: "breath"; frames: number }
  | { t: "warp"; map: string; x: number; y: number; dir?: Dir }
  | { t: "bgm"; id: string | null }
  | { t: "se"; id: string }
  | { t: "menu"; name: MenuName }
  | { t: "recruit"; id: MemberId };

interface EntityBase {
  id: string;
  x: number;
  y: number;
}

export interface NpcDef extends EntityBase {
  kind: "npc";
  name: string;
  look: Look;
  dir: Dir;
  talk?: Step[];
  /** 仲間候補: 話しかけると加入イベントになり、加入後はマップから消える */
  recruitId?: MemberId;
  recruitTalk?: Step[];
}

export interface ChestDef extends EntityBase {
  kind: "chest";
  /** 開けた時のメッセージに使う名前 */
  label: string;
  gold?: number;
  item?: string;
  count?: number;
}

export interface BossDef extends EntityBase {
  kind: "boss";
  /** 占有するタイル数 */
  w: number;
  h: number;
  /** この flag が立つと目を開けて羽ばたく */
  awakeFlag: string;
  talk: Step[];
  talkAwake: Step[];
}

export type EntityDef = NpcDef | ChestDef | BossDef;

/** 踏んだら発動するイベント（flag で一度だけ発動する） */
export interface TriggerDef {
  id: string;
  x: number;
  y: number;
  steps: Step[];
}

/** 扉など、踏むと別マップへ移動する地点 */
export interface WarpDef {
  x: number;
  y: number;
  map: string;
  tx: number;
  ty: number;
}

export interface MapDef {
  id: string;
  name: string;
  /** 1文字=1タイル。凡例は lib/game/data/maps.ts を参照 */
  rows: string[];
  outdoor: boolean;
  bgm: string | null;
  spawn: { x: number; y: number; dir: Dir };
  warps: WarpDef[];
  entities: EntityDef[];
  triggers: TriggerDef[];
}
