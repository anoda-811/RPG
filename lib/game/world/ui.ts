/** React 側で描画するメニュー項目（関数は含まない） */
export interface MenuItemView {
  label: string;
  note: string;
  disabled: boolean;
}

/** 画面に出すメニュー／入力画面の状態。ゲームの最前面のレイヤーを表す。 */
export type UiView =
  | {
      kind: "menu";
      title: string;
      logo: boolean;
      help: string;
      notice: string;
      /** 表示中の行の中でのカーソル位置 */
      cursor: number;
      items: MenuItemView[];
      /** items[0] が全体の何番目か（クリック時の番号計算に使う） */
      offset: number;
      /** 項目が多い時の「まだ上・下に続きがある」表示 */
      more: { up: boolean; down: boolean };
    }
  | {
      kind: "name";
      title: string;
      buffer: string;
      cursor: number;
      chars: string[];
      cols: number;
      notice: string;
    };

/** 名前入力の五十音グリッド。末尾に「ー」「けす」「おわり」を置く。 */
const KANA = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん";

export const NAME_CHARS: string[] = [...KANA.split(""), "ー", "けす", "おわり"];
export const NAME_COLS = 10;
export const NAME_MAX_LENGTH = 6;
