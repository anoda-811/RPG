"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { VIEW_H, VIEW_W } from "@/lib/game/core/constants";
import { Game, type DialogueView } from "@/lib/game/world/game";
import type { MenuItemView, UiView } from "@/lib/game/world/ui";

const HEADER_RESERVE = 64;

function subscribeViewport(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

/** 画面に収まる最大の拡大率。ドット絵が潰れないよう整数倍を優先する。 */
function getViewportScale(): number {
  const w = window.innerWidth;
  const h = window.innerHeight - HEADER_RESERVE;
  const s = Math.min(w / VIEW_W, h / VIEW_H);
  return s >= 1 ? Math.floor(s) : Math.max(0.5, s);
}

function getServerScale(): number {
  return 3;
}

type MenuView = Extract<UiView, { kind: "menu" }>;
type NameView = Extract<UiView, { kind: "name" }>;

export function RpgGame() {
  const scale = useSyncExternalStore(subscribeViewport, getViewportScale, getServerScale);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [dialogue, setDialogue] = useState<DialogueView | null>(null);
  const [banner, setBanner] = useState<{ name: string; key: number } | null>(null);
  const [ui, setUi] = useState<UiView | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas, {
      onDialogue: setDialogue,
      onLocation: (name) => setBanner({ name, key: Date.now() }),
      onUi: setUi,
    });
    gameRef.current = game;
    game.start();
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const press = () => gameRef.current?.pressAction();
  const select = (i: number) => gameRef.current?.select(i);
  const openMenu = () => gameRef.current?.openFieldMenu();

  const stageStyle: CSSProperties = {
    width: VIEW_W * scale,
    height: VIEW_H * scale,
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-black p-0">
      <div className="relative overflow-hidden bg-black" style={stageStyle}>
        <canvas
          ref={canvasRef}
          width={VIEW_W}
          height={VIEW_H}
          className="block h-full w-full"
          style={{ imageRendering: "pixelated" }}
        />

        {banner && <LocationBanner key={banner.key} name={banner.name} s={scale} />}

        {dialogue && <DialogueBox view={dialogue} s={scale} onAdvance={press} />}

        {ui && <UiLayer ui={ui} s={scale} onSelect={select} />}

        {ui === null && !dialogue && <MenuButton s={scale} onClick={openMenu} />}
      </div>

      <p className="text-center text-xs tracking-wide text-zinc-500">
        移動: 矢印キー / WASD　　決定: Enter / Space / Z　　取消・メニュー: X / Esc（クリックでも可）
      </p>
    </main>
  );
}

/** 最前面の画面（タイトル・メニュー・名前入力）を描き分ける。 */
function UiLayer({ ui, s, onSelect }: { ui: UiView; s: number; onSelect: (i: number) => void }) {
  if (ui.kind === "name") return <NameEntry ui={ui} s={s} onSelect={onSelect} />;
  if (ui.logo) return <TitleScreen ui={ui} s={s} onSelect={onSelect} />;
  return <MenuWindow ui={ui} s={s} onSelect={onSelect} centered={false} />;
}

/** タイトル画面（ロゴ＋中央のメニュー） */
function TitleScreen({ ui, s, onSelect }: { ui: MenuView; s: number; onSelect: (i: number) => void }) {
  return (
    <div
      className="absolute inset-0 select-none"
      style={{ background: "linear-gradient(rgba(0,0,0,0.5), rgba(20,4,6,0.92))" }}
    >
      <div className="absolute left-0 right-0 text-center" style={{ top: 26 * s }}>
        <p
          className="m-0 text-[#ff7a2a]"
          style={{
            fontSize: 26 * s,
            lineHeight: `${34 * s}px`,
            textShadow: `${2 * s}px ${2 * s}px 0 #8e1f22`,
          }}
        >
          {ui.title}
        </p>
        <p className="m-0 text-[#f4f1ea]" style={{ fontSize: 11 * s, marginTop: 6 * s }}>
          〜 炎龍の祭壇 〜
        </p>
      </div>
      <MenuWindow ui={ui} s={s} onSelect={onSelect} centered />
    </div>
  );
}

/** メニューのウィンドウ（黒背景・白枠）。 */
function MenuWindow({
  ui,
  s,
  onSelect,
  centered,
}: {
  ui: MenuView;
  s: number;
  onSelect: (i: number) => void;
  centered: boolean;
}) {
  const b = Math.max(1, s);
  const place: CSSProperties = centered
    ? { left: "50%", bottom: 14 * s, transform: "translateX(-50%)", width: 150 * s }
    : { right: 6 * s, top: 6 * s, width: 190 * s };
  return (
    <div
      className="absolute select-none text-[#f4f1ea]"
      style={{
        ...place,
        padding: `${6 * s}px ${8 * s}px`,
        background: "rgba(0,0,0,0.94)",
        border: `${b}px solid #f4f1ea`,
        boxShadow: `inset 0 0 0 ${b}px #000, 0 0 0 ${b}px #000`,
        fontSize: 11 * s,
        lineHeight: `${15 * s}px`,
      }}
    >
      {!centered && (
        <p className="m-0 text-[#ffd84a]" style={{ fontSize: 12 * s }}>
          {ui.title}
        </p>
      )}
      {ui.help && (
        <p className="m-0 text-zinc-400" style={{ fontSize: 9 * s, lineHeight: `${13 * s}px`, marginTop: 2 * s }}>
          {ui.help}
        </p>
      )}
      {ui.more.up && <p className="m-0 text-center text-zinc-400" style={{ fontSize: 9 * s }}>▲</p>}
      <ul className="m-0 list-none p-0" style={{ marginTop: 2 * s }}>
        {ui.items.map((it, i) => (
          <MenuRow
            key={`${ui.offset + i}-${it.label}`}
            item={it}
            active={i === ui.cursor}
            s={s}
            onClick={() => onSelect(ui.offset + i)}
          />
        ))}
      </ul>
      {ui.more.down && <p className="m-0 text-center text-zinc-400" style={{ fontSize: 9 * s }}>▼</p>}
      {ui.notice && (
        <p className="m-0 text-[#ffd84a]" style={{ fontSize: 9 * s, lineHeight: `${13 * s}px`, marginTop: 4 * s }}>
          {ui.notice}
        </p>
      )}
    </div>
  );
}

function MenuRow({
  item,
  active,
  s,
  onClick,
}: {
  item: MenuItemView;
  active: boolean;
  s: number;
  onClick: () => void;
}) {
  const color = item.disabled ? "#6b6578" : active ? "#ffe25a" : "#f4f1ea";
  return (
    <li
      role="button"
      onClick={onClick}
      className="flex cursor-pointer items-baseline justify-between gap-2"
      style={{ padding: `${1 * s}px ${2 * s}px`, color }}
    >
      <span className="whitespace-nowrap">
        {active ? "▶" : "　"}
        {item.label}
      </span>
      {item.note && (
        <span className="whitespace-nowrap text-zinc-400" style={{ fontSize: 9 * s }}>
          {item.note}
        </span>
      )}
    </li>
  );
}

/** 名前入力（五十音グリッド） */
function NameEntry({ ui, s, onSelect }: { ui: NameView; s: number; onSelect: (i: number) => void }) {
  const b = Math.max(1, s);
  // 仮想解像度 320x180 に収まるよう、高さ方向は小さめに組む
  const cellW = 28 * s;
  const cellH = 18 * s;
  return (
    <div
      className="absolute inset-0 flex select-none flex-col items-center justify-center text-[#f4f1ea]"
      style={{ background: "rgba(0,0,0,0.94)", gap: 4 * s }}
    >
      <p className="m-0 text-[#ffd84a]" style={{ fontSize: 11 * s, lineHeight: `${14 * s}px` }}>
        {ui.title}
      </p>
      <div
        className="text-center"
        style={{
          minWidth: 120 * s,
          padding: `0 ${8 * s}px`,
          border: `${b}px solid #f4f1ea`,
          fontSize: 12 * s,
          lineHeight: `${18 * s}px`,
        }}
      >
        {ui.buffer || " "}
        <span style={{ color: "#ffd84a", animation: "rpg-blink 0.9s steps(2, start) infinite" }}>_</span>
      </div>
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${ui.cols}, ${cellW}px)`,
          gap: `${2 * s}px`,
        }}
      >
        {ui.chars.map((c, i) => {
          const active = i === ui.cursor;
          return (
            <div
              key={`${i}-${c}`}
              role="button"
              onClick={() => onSelect(i)}
              className="cursor-pointer overflow-hidden whitespace-nowrap text-center"
              style={{
                height: cellH,
                lineHeight: `${cellH}px`,
                fontSize: c.length > 1 ? 8 * s : 11 * s,
                background: active ? "#ffd84a" : "#1a1820",
                color: active ? "#000" : "#f4f1ea",
                border: `${b}px solid #f4f1ea`,
              }}
            >
              {c}
            </div>
          );
        })}
      </div>
      <p className="m-0 text-zinc-400" style={{ fontSize: 8 * s, lineHeight: `${12 * s}px` }}>
        十字キーで選ぶ　決定: Enter　取消: X / Esc
      </p>
      {ui.notice && (
        <p className="m-0 text-[#ffd84a]" style={{ fontSize: 9 * s }}>
          {ui.notice}
        </p>
      )}
    </div>
  );
}

/** フィールド中のメニュー呼び出しボタン */
function MenuButton({ s, onClick }: { s: number; onClick: () => void }) {
  return (
    <div
      role="button"
      tabIndex={-1}
      onClick={onClick}
      className="absolute cursor-pointer select-none text-[#f4f1ea]"
      style={{
        right: 6 * s,
        top: 6 * s,
        padding: `${2 * s}px ${6 * s}px`,
        fontSize: 9 * s,
        background: "rgba(0,0,0,0.7)",
        border: `${Math.max(1, s)}px solid #f4f1ea`,
      }}
    >
      メニュー
    </div>
  );
}

/** 会話ウィンドウ（黒背景・白枠・ドットフォント） */
function DialogueBox({
  view,
  s,
  onAdvance,
}: {
  view: DialogueView;
  s: number;
  onAdvance: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={-1}
      onClick={onAdvance}
      className="absolute cursor-pointer select-none text-[#f4f1ea]"
      style={{
        left: 6 * s,
        right: 6 * s,
        bottom: 6 * s,
        minHeight: 58 * s,
        padding: `${4 * s}px ${8 * s}px`,
        background: "#000",
        border: `${Math.max(1, s)}px solid #f4f1ea`,
        boxShadow: `inset 0 0 0 ${Math.max(1, s)}px #000, 0 0 0 ${Math.max(1, s)}px #000`,
      }}
    >
      {view.speaker && (
        <div
          className="absolute whitespace-nowrap text-[#ffd84a]"
          style={{
            left: 8 * s,
            top: -14 * s,
            padding: `0 ${4 * s}px`,
            fontSize: 10 * s,
            lineHeight: `${14 * s}px`,
            background: "#000",
            border: `${Math.max(1, s)}px solid #f4f1ea`,
          }}
        >
          {view.speaker}
        </div>
      )}
      <p
        className="m-0 whitespace-pre-wrap"
        style={{ fontSize: 12 * s, lineHeight: `${16 * s}px`, minHeight: 32 * s }}
      >
        {view.text}
      </p>
      <span
        className="absolute text-[#ffd84a]"
        style={{
          right: 8 * s,
          bottom: 4 * s,
          fontSize: 10 * s,
          visibility: view.done ? "visible" : "hidden",
          animation: "rpg-blink 0.9s steps(2, start) infinite",
        }}
      >
        ▼
      </span>
    </div>
  );
}

/** 場所名のバナー（入場時に一度だけフェードイン・アウト） */
function LocationBanner({ name, s }: { name: string; s: number }) {
  return (
    <div
      className="pointer-events-none absolute left-1/2 whitespace-nowrap text-[#f4f1ea]"
      style={{
        top: 8 * s,
        transform: "translateX(-50%)",
        padding: `${3 * s}px ${10 * s}px`,
        fontSize: 12 * s,
        background: "rgba(0,0,0,0.85)",
        border: `${Math.max(1, s)}px solid #ff7a2a`,
        animation: "rpg-banner 2.8s ease-out forwards",
      }}
    >
      {name}
    </div>
  );
}
