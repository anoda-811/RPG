import { DELTA, FRAME_MS, TEXT_FRAMES_PER_CHAR, TILE, TRANSITION_FRAMES, VIEW_H, VIEW_W, opposite, type Dir } from "../core/constants";
import { BASE_STATS, LOOKS, MEMBER_IDS, NAMES, START_EQUIP, type MemberId } from "../data/party";
import { ITEMS, SHOPS, itemStat } from "../data/items";
import { MAPS, VILLAGE } from "../data/maps";
import { INTRO_STEPS } from "../data/scripts";
import { Actor } from "./actor";
import { AudioManager } from "./audio";
import { Input } from "./input";
import { readAllSlots, writeSlot, type MemberSave, type SaveData } from "./save";
import { renderScene, type Particle, type Scene, type SceneActor, type SceneEntity } from "./renderer";
import { NAME_CHARS, NAME_COLS, NAME_MAX_LENGTH, type UiView } from "./ui";
import type { BossDef, EntityDef, MapDef, MenuName, Step } from "./types";

export interface DialogueView {
  speaker: string;
  text: string;
  done: boolean;
}

export interface GameCallbacks {
  onDialogue: (view: DialogueView | null) => void;
  onLocation: (name: string) => void;
  onUi: (view: UiView | null) => void;
}

// ───────────────────────── メニューのレイヤー ─────────────────────────

interface MenuItem {
  label: string;
  note?: string;
  disabled?: boolean;
  /** 決定時の処理。無い項目は選べるが何も起きない（情報表示用） */
  run?: () => void;
}

interface MenuLayer {
  kind: "menu";
  title: string;
  logo: boolean;
  closable: boolean;
  help: () => string;
  items: () => MenuItem[];
  cursor: number;
  notice: string;
}

interface NameLayer {
  kind: "name";
  slot: number;
  buffer: string;
  cursor: number;
  notice: string;
}

type Layer = MenuLayer | NameLayer;
type SlotMode = "new" | "load" | "save";

interface MemberState {
  hp: number;
  weapon: string | null;
  armor: string | null;
}

interface MenuOptions {
  help?: () => string;
  logo?: boolean;
  closable?: boolean;
}

function menu(title: string, items: () => MenuItem[], opts: MenuOptions = {}): MenuLayer {
  return {
    kind: "menu",
    title,
    logo: opts.logo ?? false,
    closable: opts.closable ?? true,
    help: opts.help ?? (() => ""),
    items,
    cursor: 0,
    notice: "",
  };
}

function firstEnabled(items: MenuItem[]): number {
  const i = items.findIndex((it) => !it.disabled);
  return i < 0 ? 0 : i;
}

// ───────────────────────── 内部の状態型 ─────────────────────────

type Predicate = () => boolean;

interface ScriptRun {
  steps: Step[];
  index: number;
  wait: Predicate | null;
  onDone: (() => void) | null;
}

interface DialogueRun {
  speaker: string;
  chars: string[];
  shown: number;
  timer: number;
}

interface TransitionRun {
  phase: "out" | "in";
  t: number;
  onMid: () => void;
  onDone: (() => void) | null;
}

interface FlashRun {
  color: string;
  frames: number;
  total: number;
  alpha: number;
}

interface Pos {
  x: number;
  y: number;
}

/** 通行不可の地形 */
const SOLID_TILES = new Set(["#", "T", "~", "x", "o", "t", "r", "H", "d"]);
/** 同時に出場できる仲間の数（主人公を除く） */
const MAX_FOLLOWERS = 3;
/** メニューに同時に表示する行数（それ以上はスクロール） */
const MENU_ROWS = 5;
const TITLE_BGM = "title";
const DEFAULT_HERO_NAME = "リュカ";
const START_GOLD = 100;
const START_POTIONS = 2;
const INN_PRICE = 50;
const IRIS_MAX = 230;
const TRAIL_MAX = 16;
const BREATH_COLORS = ["#ffe25a", "#ffb347", "#ff9b2e", "#ff5b1f"];
const MAX_PARTICLES = 320;

const cw = (d: { dx: number; dy: number }) => ({ dx: -d.dy, dy: d.dx });
const ccw = (d: { dx: number; dy: number }) => ({ dx: d.dy, dy: -d.dx });
const rev = (d: { dx: number; dy: number }) => ({ dx: -d.dx, dy: -d.dy });
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function freshMembers(): Record<MemberId, MemberState> {
  const out = {} as Record<MemberId, MemberState>;
  for (const id of MEMBER_IDS) {
    out[id] = {
      hp: BASE_STATS[id].maxHp,
      weapon: START_EQUIP[id].weapon,
      armor: START_EQUIP[id].armor,
    };
  }
  return out;
}

/**
 * ゲーム全体の状態と更新。描画は renderer.ts、メニューの見た目は React 側に任せる。
 * 入力は必ずこのクラスで処理する（React 側はクリックを select() に渡すだけ）。
 */
export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cb: GameCallbacks;
  private readonly input = new Input();
  private readonly audio = new AudioManager();
  private readonly actors: Record<MemberId, Actor>;

  // ── 進行状態（セーブ対象） ──
  private heroName = DEFAULT_HERO_NAME;
  private gold = START_GOLD;
  private inv: Record<string, number> = {};
  private flags: Record<string, boolean> = {};
  private recruited = new Set<MemberId>(["hero"]);
  /** 出場中の仲間（主人公は含まない）。並びは隊列の順。 */
  private active: MemberId[] = [];
  private members: Record<MemberId, MemberState> = freshMembers();

  // ── 実行状態 ──
  private inGame = false;
  private map: MapDef = VILLAGE;
  private slots: (SaveData | null)[] = [];
  private layers: Layer[] = [];
  /** 仲間の追従用に、主人公が通った最近の座標を保持する */
  private trail: Pos[] = [];
  private npcDirs: Record<string, Dir> = {};

  private dialogue: DialogueRun | null = null;
  private script: ScriptRun | null = null;
  private transition: TransitionRun | null = null;
  private shake = { frames: 0, power: 0 };
  private flashFx: FlashRun | null = null;
  private breathFrames = 0;
  private particles: Particle[] = [];
  private uiDirty = true;

  private frame = 0;
  private raf = 0;
  private lastTime = 0;
  private acc = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement, cb: GameCallbacks) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    ctx.imageSmoothingEnabled = false;
    this.ctx = ctx;
    this.cb = cb;

    const spawn = VILLAGE.spawn;
    this.actors = {
      hero: new Actor(spawn.x, spawn.y, spawn.dir),
      warrior: new Actor(spawn.x, spawn.y, spawn.dir),
      mage: new Actor(spawn.x, spawn.y, spawn.dir),
      thief: new Actor(spawn.x, spawn.y, spawn.dir),
    };
    this.slots = readAllSlots();
    // タイトルの背景として村を表示しておく
    this.enterMap(VILLAGE.id, spawn.x, spawn.y, spawn.dir, false);
    this.layers = [this.titleLayer()];
  }

  private get hero(): Actor {
    return this.actors.hero;
  }

  private get followers(): Actor[] {
    return this.active.map((id) => this.actors[id]);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    window.addEventListener("keydown", this.input.onKeyDown);
    window.addEventListener("keyup", this.input.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.audio.playBgm(TITLE_BGM);
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.input.onKeyDown);
    window.removeEventListener("keyup", this.input.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.audio.stopBgm();
  }

  /** 画面上のボタン（会話クリック）から決定操作を送る。 */
  pressAction(): void {
    this.input.pressAction();
  }

  /** 画面上のメニュー項目（または名前入力のマス）をクリックした時。 */
  select(index: number): void {
    const top = this.top();
    if (!top) return;
    top.cursor = index;
    if (top.kind === "menu") this.activateMenu(top);
    else this.activateName(top);
  }

  /** フィールドでメニューを開く（画面上のボタン用）。 */
  openFieldMenu(): void {
    if (!this.isFree()) return;
    this.pushLayer(this.fieldMenu());
  }

  private readonly onBlur = (): void => {
    this.input.reset();
  };

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    this.acc += Math.min(100, now - this.lastTime);
    this.lastTime = now;
    while (this.acc >= FRAME_MS) {
      this.update();
      this.acc -= FRAME_MS;
    }
    this.render();
    if (this.uiDirty) {
      this.uiDirty = false;
      this.cb.onUi(this.uiView());
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  // ───────────────────────── 更新 ─────────────────────────

  private update(): void {
    this.frame++;
    let act = this.input.consumeAction();
    let cancel = this.input.consumeCancel();
    const dirs = this.input.consumeDirs();

    this.updateTransition();
    if (this.updateActors()) this.onHeroArrive();

    // 会話・メニューが受け取った入力は、同じフレームの後続処理（フィールドの調べる等）に渡さない。
    // 渡すと「やめる」で閉じた直後にNPCの会話が再開されてしまう。
    if (this.dialogue) {
      this.updateDialogue(act);
      act = false;
      cancel = false;
    } else if (this.layers.length > 0) {
      this.updateLayers(act, cancel, dirs);
      act = false;
      cancel = false;
    }

    this.updateScript();
    if (this.isFree()) this.updateField(act, cancel);
    this.updateEffects();
  }

  /** 会話・メニュー・イベント・画面遷移のどれも動いていない（移動できる）状態か。 */
  private isFree(): boolean {
    return this.inGame && this.dialogue === null && this.script === null && this.transition === null && this.layers.length === 0;
  }

  private updateActors(): boolean {
    const arrived = this.hero.update();
    for (const f of this.followers) f.update();
    return arrived;
  }

  /** フィールドでの操作（移動・調べる・メニュー）。 */
  private updateField(act: boolean, cancel: boolean): void {
    if (this.hero.moving) return;
    if (act) {
      this.interact();
      return;
    }
    if (cancel) {
      this.openFieldMenu();
      return;
    }
    const dir = this.input.heldDir();
    if (dir) this.tryStep(dir);
  }

  private tryStep(dir: Dir): void {
    const d = DELTA[dir];
    const nx = this.hero.x + d.dx;
    const ny = this.hero.y + d.dy;
    this.hero.dir = dir;
    if (!this.walkable(nx, ny)) return;

    this.hero.start(nx, ny, dir);
    this.trail.push({ x: nx, y: ny });
    if (this.trail.length > TRAIL_MAX) this.trail.shift();

    // 仲間は主人公が通った道を、同じタイミングで1マスずつ追う
    const n = this.trail.length;
    this.followers.forEach((f, k) => {
      const target = this.trail[n - 2 - k];
      if (!target) return;
      const ddx = target.x - f.x;
      const ddy = target.y - f.y;
      const d2: Dir = ddx > 0 ? "right" : ddx < 0 ? "left" : ddy > 0 ? "down" : "up";
      f.start(target.x, target.y, d2);
    });
  }

  private onHeroArrive(): void {
    const { x, y } = this.hero;
    const warp = this.map.warps.find((w) => w.x === x && w.y === y);
    if (warp) {
      this.startTransition(
        () => this.enterMap(warp.map, warp.tx, warp.ty, this.hero.dir, true),
        null,
      );
      return;
    }
    const key = (id: string) => `trig:${this.map.id}:${id}`;
    const trig = this.map.triggers.find((t) => t.x === x && t.y === y && !this.flags[key(t.id)]);
    if (trig) {
      this.flags[key(trig.id)] = true;
      this.runScript(trig.steps);
    }
  }

  private interact(): void {
    const d = DELTA[this.hero.dir];
    const ent = this.entityAt(this.hero.x + d.dx, this.hero.y + d.dy);
    if (!ent) return;
    switch (ent.kind) {
      case "npc":
        this.npcDirs[ent.id] = opposite(this.hero.dir);
        this.runScript(ent.recruitTalk ?? ent.talk ?? []);
        break;
      case "chest": {
        const openKey = `open:${ent.id}`;
        if (this.flags[openKey]) {
          this.runScript([{ t: "say", text: "中は空っぽだ。" }]);
          break;
        }
        this.flags[openKey] = true;
        this.gold += ent.gold ?? 0;
        if (ent.item) this.addItem(ent.item, ent.count ?? 1);
        this.runScript([
          { t: "se", id: "chest_open" },
          { t: "say", text: "宝箱を開けた！" },
          { t: "say", text: `${ent.label}を手に入れた！` },
        ]);
        break;
      }
      case "boss":
        this.runScript(this.flags[ent.awakeFlag] ? ent.talkAwake : ent.talk);
        break;
    }
  }

  // ───────────────────────── メニュー ─────────────────────────

  private top(): Layer | undefined {
    return this.layers[this.layers.length - 1];
  }

  private pushLayer(layer: Layer, cursor?: number): void {
    this.layers.push(layer);
    if (layer.kind === "menu") layer.cursor = cursor ?? firstEnabled(layer.items());
    this.uiDirty = true;
  }

  private popLayer(): void {
    this.layers.pop();
    this.uiDirty = true;
  }

  /** 最前面のレイヤーに通知メッセージを出す。 */
  private noticeTop(text: string): void {
    const t = this.top();
    if (t) t.notice = text;
    this.uiDirty = true;
  }

  private updateLayers(act: boolean, cancel: boolean, dirs: string[]): void {
    const top = this.top();
    if (!top) return;
    if (act || cancel || dirs.length > 0) this.uiDirty = true;

    if (top.kind === "menu") {
      const items = top.items();
      if (items.length === 0) return;
      for (const d of dirs) {
        if (d === "up" || d === "down") top.cursor = this.moveCursor(top.cursor, d === "up" ? -1 : 1, items);
      }
      top.cursor = clamp(top.cursor, 0, items.length - 1);
      if (act) this.activateMenu(top);
      else if (cancel && top.closable) this.popLayer();
      return;
    }

    // 名前入力のグリッド
    const n = NAME_CHARS.length;
    for (const d of dirs) {
      let c = top.cursor;
      if (d === "left" && c % NAME_COLS > 0) c -= 1;
      if (d === "right" && c % NAME_COLS < NAME_COLS - 1 && c + 1 < n) c += 1;
      if (d === "up" && c - NAME_COLS >= 0) c -= NAME_COLS;
      if (d === "down" && c + NAME_COLS < n) c += NAME_COLS;
      top.cursor = c;
    }
    if (act) this.activateName(top);
    else if (cancel) this.popLayer();
  }

  /** 無効項目を飛ばしてカーソルを動かす。 */
  private moveCursor(cur: number, step: number, items: MenuItem[]): number {
    const n = items.length;
    let c = cur;
    for (let i = 0; i < n; i++) {
      c = (c + step + n) % n;
      if (!items[c].disabled) return c;
    }
    return cur;
  }

  private activateMenu(layer: MenuLayer): void {
    const item = layer.items()[layer.cursor];
    this.uiDirty = true;
    if (!item || item.disabled || !item.run) return;
    layer.notice = "";
    item.run();
  }

  private activateName(layer: NameLayer): void {
    this.uiDirty = true;
    const ch = NAME_CHARS[layer.cursor];
    layer.notice = "";
    if (ch === "けす") {
      layer.buffer = layer.buffer.slice(0, -1);
    } else if (ch === "おわり") {
      if (layer.buffer.length === 0) layer.notice = "名前を入力してください";
      else this.startNewGame(layer.slot, layer.buffer);
    } else if (layer.buffer.length < NAME_MAX_LENGTH) {
      layer.buffer += ch;
    } else {
      layer.notice = `名前は${NAME_MAX_LENGTH}文字までです`;
    }
  }

  private titleLayer(): MenuLayer {
    return menu(
      "紅蓮の火山",
      () => [
        { label: "はじめから", run: () => this.pushLayer(this.slotMenu("new")) },
        {
          label: "つづきから",
          note: this.slots.some((s) => s !== null) ? "" : "データなし",
          disabled: !this.slots.some((s) => s !== null),
          run: () => this.pushLayer(this.slotMenu("load")),
        },
      ],
      { logo: true, closable: false },
    );
  }

  private slotMenu(mode: SlotMode): MenuLayer {
    const titles: Record<SlotMode, string> = { new: "はじめから", load: "つづきから", save: "セーブ" };
    const helps: Record<SlotMode, string> = {
      new: "冒険の記録を残すスロットを選ぶ",
      load: "続きから遊ぶデータを選ぶ",
      save: "どこに記録しますか？",
    };
    return menu(
      titles[mode],
      () => [
        ...this.slots.map(
          (d, i): MenuItem => ({
            label: `${i + 1}. ${d ? d.heroName : "（データなし）"}`,
            note: d ? d.summary : "",
            disabled: mode === "load" && d === null,
            run: () => this.slotChosen(mode, i),
          }),
        ),
        this.backItem(),
      ],
      { help: () => helps[mode] },
    );
  }

  private slotChosen(mode: SlotMode, i: number): void {
    const exists = this.slots[i] !== null;
    if (mode === "load") {
      this.loadSlot(i);
    } else if (mode === "new") {
      if (exists) this.pushLayer(this.confirmMenu(`スロット${i + 1}のデータを消して始めますか？`, () => this.pushLayer(this.nameLayer(i))), 1);
      else this.pushLayer(this.nameLayer(i));
    } else if (exists) {
      this.pushLayer(this.confirmMenu(`スロット${i + 1}を上書きしますか？`, () => this.saveTo(i)), 1);
    } else {
      this.saveTo(i);
    }
  }

  private nameLayer(slot: number): NameLayer {
    return { kind: "name", slot, buffer: "", cursor: 0, notice: "" };
  }

  private confirmMenu(question: string, onYes: () => void): MenuLayer {
    return menu(question, () => [
      {
        label: "はい",
        run: () => {
          this.popLayer();
          onYes();
        },
      },
      { label: "いいえ", run: () => this.popLayer() },
    ]);
  }

  private backItem(): MenuItem {
    return { label: "もどる", run: () => this.popLayer() };
  }

  /** 店・教会・宿屋の入口（NPC の会話から開く）。 */
  private shopLayer(name: MenuName): MenuLayer {
    switch (name) {
      case "weapon":
      case "armor":
      case "item":
        return this.shopMenu(name);
      case "church":
        return this.churchMenu();
      case "inn":
        return this.innMenu();
    }
  }

  private shopMenu(kind: "weapon" | "armor" | "item"): MenuLayer {
    const def = SHOPS[kind];
    return menu(
      def.title,
      () => [
        ...def.items.map((id): MenuItem => {
          const it = ITEMS[id];
          return { label: it.name, note: `${itemStat(it)} ${it.price}G`, run: () => this.buy(id) };
        }),
        { label: "やめる", run: () => this.popLayer() },
      ],
      { help: () => `所持金 ${this.gold}G` },
    );
  }

  private buy(id: string): void {
    const it = ITEMS[id];
    if (this.gold < it.price) {
      this.noticeTop("お金が足りません");
      return;
    }
    this.gold -= it.price;
    this.addItem(id, 1);
    this.noticeTop(`${it.name}を買った！`);
  }

  private churchMenu(): MenuLayer {
    return menu(
      "教会",
      () => [
        { label: "セーブする", note: "記録を残す", run: () => this.pushLayer(this.slotMenu("save")) },
        {
          label: "体力を回復する",
          note: "無料",
          run: () => {
            this.healAll();
            this.audio.playSe("heal");
            this.noticeTop("体力が回復した！");
          },
        },
        { label: "やめる", run: () => this.popLayer() },
      ],
      { help: () => "旅の記録を残せます" },
    );
  }

  private innMenu(): MenuLayer {
    return menu(
      "宿屋",
      () => [
        {
          label: "泊まる",
          note: `${INN_PRICE}G`,
          run: () => {
            if (this.gold < INN_PRICE) {
              this.noticeTop("お金が足りません");
              return;
            }
            this.gold -= INN_PRICE;
            this.healAll();
            this.flashFx = { color: "#ffe25a", frames: 30, total: 30, alpha: 0.5 };
            this.noticeTop("ぐっすり休んだ！ 体力が全快した。");
          },
        },
        { label: "やめる", run: () => this.popLayer() },
      ],
      { help: () => `所持金 ${this.gold}G` },
    );
  }

  private fieldMenu(): MenuLayer {
    return menu(
      "メニュー",
      () => {
        const canForm = this.recruited.size > 1;
        return [
          { label: "どうぐ", run: () => this.pushLayer(this.itemMenu()) },
          { label: "そうび", run: () => this.pushLayer(this.equipListMenu()) },
          {
            label: "へんせい",
            note: canForm ? "" : "仲間がいない",
            disabled: !canForm,
            run: () => this.pushLayer(this.formationMenu()),
          },
          { label: "ステータス", run: () => this.pushLayer(this.statusMenu()) },
          { label: "セーブ", run: () => this.pushLayer(this.slotMenu("save")) },
          {
            label: "タイトルへ",
            run: () => this.pushLayer(this.confirmMenu("タイトルに戻りますか？", () => this.toTitle()), 1),
          },
          { label: "とじる", run: () => this.popLayer() },
        ];
      },
      { help: () => `${this.heroName}　所持金 ${this.gold}G` },
    );
  }

  private itemMenu(): MenuLayer {
    return menu(
      "どうぐ",
      () => {
        const owned = Object.entries(this.inv).filter(([, n]) => n > 0);
        const list: MenuItem[] = owned.map(([id, n]): MenuItem => {
          const it = ITEMS[id];
          if (it.kind === "consumable") {
            return { label: `${it.name} ×${n}`, note: `回復${it.heal}`, run: () => this.pushLayer(this.healTargetMenu(id)) };
          }
          return { label: `${it.name} ×${n}`, note: it.kind === "key" ? "大切なもの" : "そうびで使う", disabled: true };
        });
        if (list.length === 0) list.push({ label: "（もちものがない）", disabled: true });
        list.push(this.backItem());
        return list;
      },
      { help: () => `所持金 ${this.gold}G` },
    );
  }

  private healTargetMenu(itemId: string): MenuLayer {
    return menu(
      `${ITEMS[itemId].name}を使う相手`,
      () => [
        ...this.recruitedIds().map((id): MenuItem => {
          const m = this.members[id];
          const max = BASE_STATS[id].maxHp;
          return {
            label: this.nameOf(id),
            note: `HP ${m.hp}/${max}`,
            disabled: m.hp >= max,
            run: () => this.useHeal(itemId, id),
          };
        }),
        this.backItem(),
      ],
    );
  }

  private useHeal(itemId: string, id: MemberId): void {
    const it = ITEMS[itemId];
    const m = this.members[id];
    m.hp = Math.min(BASE_STATS[id].maxHp, m.hp + (it.heal ?? 0));
    this.consumeItem(itemId);
    this.audio.playSe("heal");
    this.popLayer();
    this.noticeTop(`${this.nameOf(id)}のHPが回復した！`);
  }

  private equipListMenu(): MenuLayer {
    return menu(
      "そうび",
      () => [
        ...this.recruitedIds().map(
          (id): MenuItem => ({
            label: this.nameOf(id),
            note: `攻${this.atkOf(id)} 守${this.defOf(id)}`,
            run: () => this.pushLayer(this.equipSlotMenu(id)),
          }),
        ),
        this.backItem(),
      ],
      { help: () => "装備を変えるキャラクターを選ぶ" },
    );
  }

  private equipSlotMenu(id: MemberId): MenuLayer {
    return menu(
      this.nameOf(id),
      () => {
        const m = this.members[id];
        return [
          {
            label: `武器: ${this.itemName(m.weapon)}`,
            note: m.weapon ? itemStat(ITEMS[m.weapon]) : "",
            run: () => this.pushLayer(this.equipPickMenu(id, "weapon")),
          },
          {
            label: `防具: ${this.itemName(m.armor)}`,
            note: m.armor ? itemStat(ITEMS[m.armor]) : "",
            run: () => this.pushLayer(this.equipPickMenu(id, "armor")),
          },
          this.backItem(),
        ];
      },
      { help: () => `攻${this.atkOf(id)} 守${this.defOf(id)}` },
    );
  }

  private equipPickMenu(id: MemberId, kind: "weapon" | "armor"): MenuLayer {
    return menu(
      kind === "weapon" ? "武器を選ぶ" : "防具を選ぶ",
      () => {
        const cur = this.members[id][kind];
        const list: MenuItem[] = [];
        if (cur) list.push({ label: "はずす", note: "なしにする", run: () => this.equip(id, kind, null) });
        for (const [itemId, n] of Object.entries(this.inv)) {
          const it = ITEMS[itemId];
          if (n > 0 && it.kind === kind) {
            list.push({
              label: `${it.name} ×${n}`,
              note: itemStat(it),
              run: () => this.equip(id, kind, itemId),
            });
          }
        }
        if (list.length === 0) list.push({ label: "（もちものがない）", disabled: true });
        list.push(this.backItem());
        return list;
      },
    );
  }

  /** 装備を付け替える。外した装備は持ち物に戻る。 */
  private equip(id: MemberId, kind: "weapon" | "armor", itemId: string | null): void {
    const m = this.members[id];
    const cur = m[kind];
    if (cur) this.addItem(cur, 1);
    if (itemId) this.consumeItem(itemId);
    m[kind] = itemId;
    this.popLayer();
    this.noticeTop(itemId ? `${ITEMS[itemId].name}を装備した` : "はずした");
  }

  private formationMenu(): MenuLayer {
    return menu(
      "へんせい",
      () => {
        const list: MenuItem[] = [{ label: `${this.heroName}（リーダー）`, note: "常に出場", disabled: true }];
        for (const id of this.recruitedIds()) {
          if (id === "hero") continue;
          const on = this.active.includes(id);
          list.push({ label: this.nameOf(id), note: on ? "出場中" : "控え", run: () => this.toggleMember(id) });
        }
        list.push(this.backItem());
        return list;
      },
      { help: () => `出場は仲間${MAX_FOLLOWERS}人まで` },
    );
  }

  private toggleMember(id: MemberId): void {
    if (this.active.includes(id)) {
      this.active = this.active.filter((x) => x !== id);
      this.placeFollowers();
      this.noticeTop(`${this.nameOf(id)}を控えに回した`);
      return;
    }
    if (this.active.length >= MAX_FOLLOWERS) {
      this.noticeTop(`出場は仲間${MAX_FOLLOWERS}人までです`);
      return;
    }
    this.active.push(id);
    this.placeFollowers();
    this.noticeTop(`${this.nameOf(id)}をパーティに入れた`);
  }

  private statusMenu(): MenuLayer {
    return menu(
      "ステータス",
      () => [
        ...this.recruitedIds().map(
          (id): MenuItem => ({
            label: this.nameOf(id),
            note: `HP ${this.members[id].hp}/${BASE_STATS[id].maxHp} 攻${this.atkOf(id)} 守${this.defOf(id)}`,
          }),
        ),
        this.backItem(),
      ],
      { help: () => `所持金 ${this.gold}G` },
    );
  }

  private toTitle(): void {
    this.inGame = false;
    this.resetRuntime();
    this.layers = [this.titleLayer()];
    this.enterMap(VILLAGE.id, VILLAGE.spawn.x, VILLAGE.spawn.y, VILLAGE.spawn.dir, false);
    this.audio.playBgm(TITLE_BGM);
    this.refreshSlots();
    this.uiDirty = true;
  }

  // ───────────────────────── ゲーム開始・セーブ ─────────────────────────

  private startNewGame(slot: number, name: string): void {
    this.resetState(name);
    this.inGame = true;
    this.resetRuntime();
    this.layers = [];
    const spawn = VILLAGE.spawn;
    this.enterMap(VILLAGE.id, spawn.x, spawn.y, spawn.dir, true);
    writeSlot(slot, this.snapshot());
    this.refreshSlots();
    this.uiDirty = true;
    this.startTransition(() => undefined, () => this.runScript(INTRO_STEPS));
  }

  private loadSlot(i: number): void {
    const data = this.slots[i];
    if (!data) return;
    this.applySave(data);
    this.startTransition(() => undefined, null);
  }

  private saveTo(i: number): void {
    writeSlot(i, this.snapshot());
    this.refreshSlots();
    this.popLayer();
    this.noticeTop(`スロット${i + 1}にセーブしました`);
  }

  private refreshSlots(): void {
    this.slots = readAllSlots();
  }

  private snapshot(): SaveData {
    const members = {} as Record<MemberId, MemberSave>;
    for (const id of MEMBER_IDS) {
      const m = this.members[id];
      members[id] = { hp: m.hp, weapon: m.weapon, armor: m.armor };
    }
    return {
      version: 1,
      savedAt: Date.now(),
      summary: `${this.map.name} ${this.gold}G`,
      heroName: this.heroName,
      mapId: this.map.id,
      x: this.hero.x,
      y: this.hero.y,
      dir: this.hero.dir,
      gold: this.gold,
      inv: { ...this.inv },
      flags: { ...this.flags },
      recruited: [...this.recruited],
      active: [...this.active],
      members,
    };
  }

  private applySave(d: SaveData): void {
    this.heroName = d.heroName;
    this.gold = d.gold;
    this.inv = { ...d.inv };
    this.flags = { ...d.flags };
    this.recruited = new Set<MemberId>(["hero", ...d.recruited]);
    this.active = d.active.filter((id) => id !== "hero").slice(0, MAX_FOLLOWERS);
    for (const id of MEMBER_IDS) {
      const m = d.members[id];
      if (m) this.members[id] = { hp: m.hp, weapon: m.weapon, armor: m.armor };
    }
    this.inGame = true;
    this.resetRuntime();
    this.layers = [];
    const mapId = MAPS[d.mapId] ? d.mapId : VILLAGE.id;
    this.enterMap(mapId, d.x, d.y, d.dir, true);
    this.uiDirty = true;
  }

  private resetState(name: string): void {
    this.heroName = name;
    this.gold = START_GOLD;
    this.inv = { potion: START_POTIONS };
    this.flags = {};
    this.recruited = new Set<MemberId>(["hero"]);
    this.active = [];
    this.members = freshMembers();
  }

  /** 会話・イベント・遷移・演出を全て止める（画面切り替え時用）。 */
  private resetRuntime(): void {
    this.dialogue = null;
    this.emitDialogue();
    this.script = null;
    this.transition = null;
    this.flashFx = null;
    this.breathFrames = 0;
    this.particles = [];
    this.shake = { frames: 0, power: 0 };
  }

  // ───────────────────────── 所持品・パーティ ─────────────────────────

  private addItem(id: string, n: number): void {
    this.inv[id] = (this.inv[id] ?? 0) + n;
  }

  private consumeItem(id: string): void {
    this.inv[id] = (this.inv[id] ?? 0) - 1;
    if (this.inv[id] <= 0) delete this.inv[id];
  }

  private healAll(): void {
    for (const id of this.recruitedIds()) this.members[id].hp = BASE_STATS[id].maxHp;
  }

  private recruit(id: MemberId): void {
    this.recruited.add(id);
    if (!this.active.includes(id) && this.active.length < MAX_FOLLOWERS) this.active.push(id);
    this.placeFollowers();
  }

  private recruitedIds(): MemberId[] {
    return MEMBER_IDS.filter((id) => this.recruited.has(id));
  }

  private partyIds(): MemberId[] {
    return ["hero", ...this.active];
  }

  private nameOf(id: MemberId): string {
    return id === "hero" ? this.heroName : NAMES[id];
  }

  private itemName(id: string | null): string {
    return id ? ITEMS[id].name : "なし";
  }

  private atkOf(id: MemberId): number {
    const w = this.members[id].weapon;
    return BASE_STATS[id].atk + (w ? (ITEMS[w].atk ?? 0) : 0);
  }

  private defOf(id: MemberId): number {
    const a = this.members[id].armor;
    return BASE_STATS[id].def + (a ? (ITEMS[a].def ?? 0) : 0);
  }

  /** 出場中の仲間を主人公の後ろに並べ直す（編成変更・マップ移動時）。 */
  private placeFollowers(): void {
    const h = this.hero;
    const spots = this.formation(h.x, h.y, h.dir);
    this.active.forEach((id, i) => {
      const a = this.actors[id];
      a.x = spots[i].x;
      a.y = spots[i].y;
      a.dir = h.dir;
      a.moving = false;
    });
    // trail は [仲間3, 仲間2, 仲間1, 主人公] の順
    this.trail = [spots[2], spots[1], spots[0], { x: h.x, y: h.y }];
  }

  // ───────────────────────── イベント実行 ─────────────────────────

  private runScript(steps: Step[], onDone: (() => void) | null = null): void {
    this.script = { steps, index: 0, wait: null, onDone };
  }

  private updateScript(): void {
    const s = this.script;
    if (!s) return;
    if (s.wait) {
      if (!s.wait()) return;
      s.wait = null;
    }
    while (s.index < s.steps.length) {
      const step = s.steps[s.index++];
      const wait = this.execStep(step);
      if (wait) {
        s.wait = wait;
        return;
      }
    }
    this.script = null;
    s.onDone?.();
  }

  /** 1命令を実行。待ちが必要なら完了判定の関数を返す。 */
  private execStep(step: Step): Predicate | null {
    switch (step.t) {
      case "say":
        if (step.when && !this.active.includes(step.when)) return null;
        this.openDialogue(step.speaker ?? "", step.text);
        return () => this.dialogue === null;
      case "wait": {
        let n = step.frames;
        return () => --n <= 0;
      }
      case "shake":
        this.shake = { frames: step.frames, power: step.power };
        return null;
      case "flash":
        this.flashFx = {
          color: step.color,
          frames: step.frames,
          total: step.frames,
          alpha: step.alpha,
        };
        return null;
      case "setFlag":
        this.flags[step.flag] = true;
        return null;
      case "breath":
        this.breathFrames = step.frames;
        return () => this.breathFrames <= 0;
      case "warp": {
        let done = false;
        this.startTransition(
          () => this.enterMap(step.map, step.x, step.y, step.dir ?? this.hero.dir, true),
          () => {
            done = true;
          },
        );
        return () => done;
      }
      case "bgm":
        this.audio.playBgm(step.id);
        return null;
      case "se":
        this.audio.playSe(step.id);
        return null;
      case "menu":
        this.pushLayer(this.shopLayer(step.name));
        return () => this.layers.length === 0;
      case "recruit":
        this.recruit(step.id);
        return null;
    }
  }

  // ───────────────────────── 会話 ─────────────────────────

  /** 会話文中の {hero} を主人公の名前に置き換える。 */
  private fill(s: string): string {
    return s.split("{hero}").join(this.heroName);
  }

  private openDialogue(speaker: string, text: string): void {
    this.dialogue = { speaker: this.fill(speaker), chars: Array.from(this.fill(text)), shown: 0, timer: 0 };
    this.emitDialogue();
  }

  private emitDialogue(): void {
    const d = this.dialogue;
    if (!d) {
      this.cb.onDialogue(null);
      return;
    }
    this.cb.onDialogue({
      speaker: d.speaker,
      text: d.chars.slice(0, d.shown).join(""),
      done: d.shown >= d.chars.length,
    });
  }

  /** 1文字ずつ表示（タイプライター）。決定ボタンで全文表示→次へ。 */
  private updateDialogue(act: boolean): void {
    const d = this.dialogue;
    if (!d) return;
    const total = d.chars.length;
    let changed = false;
    if (d.shown < total) {
      d.timer++;
      if (d.timer % TEXT_FRAMES_PER_CHAR === 0) {
        d.shown++;
        changed = true;
      }
    }
    if (act) {
      if (d.shown < total) {
        d.shown = total;
        changed = true;
      } else {
        this.dialogue = null;
        this.emitDialogue();
        return;
      }
    }
    if (changed) this.emitDialogue();
  }

  // ───────────────────────── マップ・遷移 ─────────────────────────

  private enterMap(mapId: string, x: number, y: number, dir: Dir, announce: boolean): void {
    const map = MAPS[mapId];
    this.map = map;
    this.hero.x = x;
    this.hero.y = y;
    this.hero.dir = dir;
    this.hero.moving = false;
    this.placeFollowers();

    this.npcDirs = {};
    for (const e of map.entities) {
      if (e.kind === "npc") this.npcDirs[e.id] = e.dir;
    }
    if (announce) {
      this.cb.onLocation(map.name);
      if (this.inGame) this.audio.playBgm(map.bgm);
    }
  }

  /** 主人公の後ろに仲間を並べる（通れる場所を優先）。 */
  private formation(x: number, y: number, dir: Dir): Pos[] {
    const used = new Set<string>([`${x},${y}`]);
    const out: Pos[] = [];
    let cur: Pos = { x, y };
    let link = DELTA[opposite(dir)];
    for (let k = 0; k < MAX_FOLLOWERS; k++) {
      const candidates = [link, cw(link), ccw(link), rev(link)];
      let placed: Pos = { x, y };
      for (const d of candidates) {
        const nx = cur.x + d.dx;
        const ny = cur.y + d.dy;
        if (!used.has(`${nx},${ny}`) && this.walkable(nx, ny)) {
          placed = { x: nx, y: ny };
          link = d;
          break;
        }
      }
      used.add(`${placed.x},${placed.y}`);
      out.push(placed);
      cur = placed;
    }
    return out;
  }

  private startTransition(onMid: () => void, onDone: (() => void) | null): void {
    this.transition = { phase: "out", t: 0, onMid, onDone };
  }

  private updateTransition(): void {
    const tr = this.transition;
    if (!tr) return;
    tr.t++;
    if (tr.t < TRANSITION_FRAMES) return;
    if (tr.phase === "out") {
      tr.onMid();
      tr.phase = "in";
      tr.t = 0;
      return;
    }
    this.transition = null;
    tr.onDone?.();
  }

  /** 地形とエンティティ（NPC・宝箱・ボス）のどちらも塞いでいなければ通行可能。 */
  private walkable(x: number, y: number): boolean {
    const row = this.map.rows[y];
    if (row === undefined || x < 0 || x >= row.length) return false;
    if (SOLID_TILES.has(row[x])) return false;
    return this.entityAt(x, y) === null;
  }

  /** 加入済みの仲間NPCは表示も通行判定もしない。 */
  private isVisible(e: EntityDef): boolean {
    return !(e.kind === "npc" && e.recruitId !== undefined && this.recruited.has(e.recruitId));
  }

  /** (x,y) を占有しているエンティティ（ボスは占有タイル全体で判定）。 */
  private entityAt(x: number, y: number): EntityDef | null {
    for (const e of this.map.entities) {
      if (!this.isVisible(e)) continue;
      const w = e.kind === "boss" ? e.w : 1;
      const h = e.kind === "boss" ? e.h : 1;
      if (x >= e.x && x < e.x + w && y >= e.y && y < e.y + h) return e;
    }
    return null;
  }

  // ───────────────────────── 演出 ─────────────────────────

  private updateEffects(): void {
    if (this.shake.frames > 0) this.shake.frames--;
    if (this.flashFx) {
      this.flashFx.frames--;
      if (this.flashFx.frames <= 0) this.flashFx = null;
    }
    if (this.breathFrames > 0) {
      this.breathFrames--;
      const boss = this.map.entities.find((e): e is BossDef => e.kind === "boss");
      if (boss && this.breathFrames > 20) this.spawnBreath(boss);
    }
    if (this.frame % 3 === 0) this.spawnAmbient();

    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private spawnBreath(boss: BossDef): void {
    const mx = boss.x * TILE + 32;
    const my = boss.y * TILE + 46;
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x: mx + (Math.random() - 0.5) * 10,
        y: my,
        vx: (Math.random() - 0.5) * 1.6,
        vy: 2.2 + Math.random() * 2.2,
        life: 60 + Math.random() * 30,
        max: 90,
        color: BREATH_COLORS[Math.floor(Math.random() * BREATH_COLORS.length)],
        size: Math.random() < 0.6 ? 2 : 1,
      });
    }
  }

  /** 溶岩からの火の粉、屋外では灰を漂わせる。 */
  private spawnAmbient(): void {
    if (this.particles.length >= MAX_PARTICLES) return;
    const cam = this.camera();
    const rows = this.map.rows;
    const tx = Math.floor((cam.x + Math.random() * VIEW_W) / TILE);
    const ty = Math.floor((cam.y + Math.random() * VIEW_H) / TILE);
    const ch = rows[ty]?.[tx];
    if (this.map.outdoor) {
      this.particles.push({
        x: cam.x + Math.random() * VIEW_W,
        y: cam.y + Math.random() * VIEW_H,
        vx: -0.15 - Math.random() * 0.15,
        vy: 0.1 + Math.random() * 0.2,
        life: 150,
        max: 150,
        color: "#9a8f94",
        size: 1,
      });
    } else if (ch === "~") {
      this.particles.push({
        x: tx * TILE + Math.random() * TILE,
        y: ty * TILE + Math.random() * TILE,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.3 - Math.random() * 0.5,
        life: 40 + Math.random() * 30,
        max: 70,
        color: Math.random() < 0.5 ? "#ffb347" : "#ff7a2a",
        size: 1,
      });
    }
  }

  private shakeOffset(): { x: number; y: number } {
    if (this.shake.frames <= 0) return { x: 0, y: 0 };
    const p = this.shake.power;
    return { x: (Math.random() * 2 - 1) * p, y: (Math.random() * 2 - 1) * p };
  }

  /** 主人公を中心にしたカメラ（マップ端ではクランプ）。 */
  private camera(): { x: number; y: number } {
    const rows = this.map.rows;
    const mapW = rows[0].length * TILE;
    const mapH = rows.length * TILE;
    const cx = this.hero.renderX() * TILE + TILE / 2;
    const cy = this.hero.renderY() * TILE + TILE / 2;
    const x = mapW <= VIEW_W ? (mapW - VIEW_W) / 2 : clamp(cx - VIEW_W / 2, 0, mapW - VIEW_W);
    const y = mapH <= VIEW_H ? (mapH - VIEW_H) / 2 : clamp(cy - VIEW_H / 2, 0, mapH - VIEW_H);
    return { x: Math.round(x), y: Math.round(y) };
  }

  // ───────────────────────── 描画 ─────────────────────────

  private uiView(): UiView | null {
    const top = this.top();
    if (!top) return null;
    if (top.kind === "name") {
      return {
        kind: "name",
        title: "名前を入れてください",
        buffer: top.buffer,
        cursor: top.cursor,
        chars: NAME_CHARS,
        cols: NAME_COLS,
        notice: top.notice,
      };
    }
    const all = top.items();
    const n = all.length;
    const cursor = clamp(top.cursor, 0, Math.max(0, n - 1));
    // 行数が多い時はカーソルの周辺だけを表示する
    const start = clamp(cursor - Math.floor(MENU_ROWS / 2), 0, Math.max(0, n - MENU_ROWS));
    const visible = all.slice(start, start + MENU_ROWS);
    return {
      kind: "menu",
      title: top.title,
      logo: top.logo,
      help: top.help(),
      notice: top.notice,
      cursor: cursor - start,
      items: visible.map((it) => ({ label: it.label, note: it.note ?? "", disabled: !!it.disabled })),
      offset: start,
      more: { up: start > 0, down: start + MENU_ROWS < n },
    };
  }

  private render(): void {
    const cam = this.camera();
    const shake = this.shakeOffset();

    const entities: SceneEntity[] = this.map.entities.filter((e) => this.isVisible(e)).map((e): SceneEntity => {
      switch (e.kind) {
        case "npc":
          return {
            kind: "npc",
            id: e.id,
            x: e.x,
            y: e.y,
            look: e.look,
            dir: this.npcDirs[e.id] ?? e.dir,
          };
        case "chest":
          return {
            kind: "chest",
            id: e.id,
            x: e.x,
            y: e.y,
            dir: "down",
            open: !!this.flags[`open:${e.id}`],
          };
        case "boss":
          return {
            kind: "boss",
            id: e.id,
            x: e.x,
            y: e.y,
            dir: "down",
            awake: !!this.flags[e.awakeFlag],
          };
      }
    });

    const actors: SceneActor[] = this.partyIds().map((id) => {
      const a = this.actors[id];
      return {
        id,
        look: LOOKS[id],
        rx: a.renderX(),
        ry: a.renderY(),
        dir: a.dir,
        walk: a.walkFrame(),
      };
    });

    const fx = this.flashFx;
    const scene: Scene = {
      rows: this.map.rows,
      frame: this.frame,
      camX: cam.x,
      camY: cam.y,
      shakeX: shake.x,
      shakeY: shake.y,
      entities,
      actors,
      particles: this.particles,
      flash: fx ? { color: fx.color, alpha: (fx.alpha * fx.frames) / fx.total } : null,
      iris: this.irisState(cam, shake),
    };
    renderScene(this.ctx, scene);
  }

  private irisState(
    cam: { x: number; y: number },
    shake: { x: number; y: number },
  ): Scene["iris"] {
    const tr = this.transition;
    if (!tr) return null;
    const p = Math.min(1, tr.t / TRANSITION_FRAMES);
    const r = IRIS_MAX * (tr.phase === "out" ? 1 - p : p);
    return {
      x: this.hero.renderX() * TILE + TILE / 2 - cam.x + shake.x,
      y: this.hero.renderY() * TILE + TILE / 2 - cam.y + shake.y,
      r,
    };
  }
}
