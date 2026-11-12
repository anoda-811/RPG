import type { Dir } from "../core/constants";
import type { MemberId } from "../data/party";

/** セーブスロットの数 */
export const SLOT_COUNT = 3;

export interface MemberSave {
  hp: number;
  weapon: string | null;
  armor: string | null;
}

export interface SaveData {
  version: 1;
  savedAt: number;
  /** スロット一覧に表示する要約 */
  summary: string;
  heroName: string;
  mapId: string;
  x: number;
  y: number;
  dir: Dir;
  gold: number;
  inv: Record<string, number>;
  flags: Record<string, boolean>;
  recruited: MemberId[];
  active: MemberId[];
  members: Record<MemberId, MemberSave>;
}

const key = (i: number) => `rpg-save-slot-${i}`;

export function readSlot(i: number): SaveData | null {
  try {
    const raw = window.localStorage.getItem(key(i));
    return raw ? (JSON.parse(raw) as SaveData) : null;
  } catch {
    return null;
  }
}

export function writeSlot(i: number, data: SaveData): void {
  try {
    window.localStorage.setItem(key(i), JSON.stringify(data));
  } catch {
    // 保存容量超過やプライベートモードでは黙って失敗させる
  }
}

export function readAllSlots(): (SaveData | null)[] {
  return Array.from({ length: SLOT_COUNT }, (_, i) => readSlot(i));
}
