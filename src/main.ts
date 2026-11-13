import manifest from "./appmeta/manifest.json";
import { createScreen, type Element } from "./screen";

/** The name the app draws under; the device clears elements by this id. */
const APP = manifest.id;

/** NASA's public ISS telemetry, the ISSLIVE adapter of Lightstreamer's demo server. */
const LS = "https://push.lightstreamer.com/lightstreamer";
const PROTOCOL = "LS_protocol=TLCP-2.1.0";
/** The client id the Waybar module nealwebdev/waybar-iss-piss-tank uses; its author polls every 300 s. */
const CID = "mgQkwtwdysogQz2BJ4Ji+kOj2Bg";
const POLL_MS = 300 * 1000;

/** The three water tanks of Node 3, in the order of the subscription group. */
const TANKS = [
  { item: "NODE3000005", label: "URINE", color: "#FFD000FF" },
  { item: "NODE3000008", label: "WASTE", color: "#C07030FF" },
  { item: "NODE3000009", label: "CLEAN", color: "#3090FFFF" },
];
/** The liquids on their own views: the colour at the bottom, and of the top pixel of the surface as XPM takes it. */
const LIQUIDS: Record<string, { deep: string; crest: string }> = {
  URINE: { deep: "#C08000FF", crest: "#FFF4A0" },
  CLEAN: { deep: "#0838B0FF", crest: "#B0E8FF" },
};
const URINE = 0;
const WASTE = 1;
/** The wheel's views: 0 is the three tanks side by side, view v the tank TANKS[v - 1] on the whole display. */
const VIEWS = TANKS.length + 1;

const WHITE = "#FFFFFFFF";
const SUBTLE_WHITE = "#FFFFFFA0";
const OUTLINE = "#000000FF";
const TRACK = "#FFFFFF30";
const BUBBLE = "#FFFCE0FF";
const SEGMENT_W = 24;
const BAR_W = 2;

/** The liquids slosh and the bubbles rise a step at this period, only while such a view is shown. */
const MOTION_MS = 250;
/** Length of the surface wave and how far it moves a step. */
const WAVE_PX = 24;
const WAVE_STEP = 0.5;
const BUBBLES = 5;

/** Trash for the garbage heap as XPM colours: dirt and cardboard most of all, then metal, glass, rust, paper, plastic. */
const TRASH = ["a c #5A3A1E", "b c #3A2614", "c c #8A6A3A", "d c #707070", "e c #3E6A2A", "f c #A0401E", "g c #B8B0A0", "h c #3858A0"];
const TRASH_KEYS = "aaabbbcccddeefgh";

/** One POST with a form body; resolves to the answer's text. */
async function post(path: string, body: string): Promise<string> {
  const res = await fetch(`${LS}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.text();
}

/**
 * Reads the tank levels, percent, in the order of TANKS: a session, a subscription with a snapshot, and one poll that
 * brings the snapshot as lines "U,1,<position in the group>,<value>". A level missing from the answer is null.
 */
async function load(): Promise<(number | null)[]> {
  const created = await post(
    `create_session.txt?${PROTOCOL}`,
    `LS_cid=${CID}&LS_adapter_set=ISSLIVE&LS_polling=true&LS_polling_millis=0&LS_idle_millis=0`,
  );
  const session = /^CONOK,([^,\r\n]+)/.exec(created);
  if (!session) throw new Error(`no session: ${created.slice(0, 40)}`);

  const group = TANKS.map((t) => t.item).join("%20");
  const subscribed = await post(
    `control.txt?${PROTOCOL}&LS_session=${session[1]}`,
    `LS_reqId=1&LS_op=add&LS_subId=1&LS_mode=MERGE&LS_group=${group}&LS_schema=Value&LS_snapshot=true`,
  );
  if (subscribed.indexOf("REQOK") < 0) throw new Error(`not subscribed: ${subscribed.slice(0, 40)}`);

  const bound = await post(
    `bind_session.txt?${PROTOCOL}`,
    `LS_session=${session[1]}&LS_polling=true&LS_polling_millis=0&LS_idle_millis=3000`,
  );
  const levels: (number | null)[] = TANKS.map(() => null);
  for (const line of bound.split("\n")) {
    const update = /^U,1,(\d+),([^\r]*)/.exec(line);
    if (!update) continue;
    const value = parseFloat(update[2]);
    const at = Number(update[1]) - 1;
    if (at >= 0 && at < levels.length && isFinite(value)) levels[at] = value;
  }
  return levels;
}

/** A level as display rows, 0 to 16; 0 without a level. */
function rows(level: number | null): number {
  return level === null ? 0 : Math.round((Math.max(0, Math.min(100, level)) * 16) / 100);
}

/** A tank: its label and level on the left, a bar filled to the level on the right; "--" without a level. */
function tank(i: number, level: number | null): Element[] {
  const t = TANKS[i];
  const x = i * SEGMENT_W;
  const fill = rows(level);
  const elements: Element[] = [
    { type: "text", id: `label${i}`, text: t.label, font: "tiny", color: SUBTLE_WHITE, x, y: 0, align: "top_left" },
    {
      type: "text",
      id: `level${i}`,
      text: level === null ? "--" : `${Math.round(level)}%`,
      font: "small",
      color: t.color,
      x,
      y: 7,
      align: "top_left",
    },
    {
      type: "rectangle",
      id: `track${i}`,
      x: x + SEGMENT_W - BAR_W - 1,
      y: 0,
      width: BAR_W,
      height: 16,
      fill: "solid",
      fill_colors: [TRACK],
      border_width: 0,
      align: "top_left",
    },
  ];
  if (fill > 0) {
    elements.push({
      type: "rectangle",
      id: `fill${i}`,
      x: x + SEGMENT_W - BAR_W - 1,
      y: 16 - fill,
      width: BAR_W,
      height: fill,
      fill: "solid",
      fill_colors: [t.color],
      border_width: 0,
      align: "top_left",
      z_index: 1,
    });
  }
  return elements;
}

/** The motion of the liquids: the phase of the surface wave and the bubbles in the urine, by column and row. */
interface Motion {
  phase: number;
  bubbles: { x: number; y: number }[];
}

/** The top lit row of column x of a liquid h rows deep: the level with a wave of a pixel up and down on it. */
function surface(x: number, h: number, phase: number): number {
  const wave = Math.round(Math.sin((x * 2 * Math.PI) / WAVE_PX + phase));
  return 16 - Math.max(0, Math.min(16, h + wave));
}

/**
 * A liquid h rows deep over the whole display: a gradient up to two rows under the level, and over it the rows the
 * wave goes through as one bitmap, lit up to the surface in each column, its top pixel lighter.
 */
function liquid(i: number, h: number, phase: number): Element[] {
  if (h === 0) return [];
  const t = TANKS[i];
  const look = LIQUIDS[t.label];
  const elements: Element[] = [];
  if (h > 2) {
    elements.push({
      type: "rectangle",
      id: "body",
      x: 0,
      y: 18 - h,
      width: 72,
      height: h - 2,
      fill: "gradient_v",
      fill_colors: [t.color, look.deep],
      border_width: 0,
      align: "top_left",
      z_index: 0,
    });
  }
  const tops: number[] = [];
  for (let x = 0; x < 72; x++) tops.push(surface(x, h, phase));
  const top = Math.max(0, 15 - h);
  const bitmap: string[] = [];
  for (let y = top; y <= Math.min(15, 17 - h); y++) {
    let row = "";
    for (let x = 0; x < 72; x++) row += y < tops[x] ? "." : y === tops[x] ? "c" : "b";
    bitmap.push(row);
  }
  const data = ["! XPM2", `72 ${bitmap.length} 3 1`, ". c none", `b c ${t.color.slice(0, 7)}`, `c c ${look.crest}`, ...bitmap];
  // Without an explicit z_index the firmware drew a new bitmap over the text in the first frame (emulator, 1.3.1).
  elements.push({ type: "xpmbitmap", id: "surface", data: data.join("\n"), x: 0, y: top, align: "top_left", z_index: 0 });
  return elements;
}

/** The bubbles that are on the display and under the surface, a pixel each. */
function bubbles(motion: Motion, h: number): Element[] {
  const elements: Element[] = [];
  motion.bubbles.forEach((b, k) => {
    if (b.y > 15 || b.y <= surface(b.x, h, motion.phase)) return;
    elements.push({
      type: "rectangle",
      id: `bubble${k}`,
      x: b.x,
      y: b.y,
      width: 1,
      height: 1,
      fill: "solid",
      fill_colors: [BUBBLE],
      border_width: 0,
      align: "top_left",
      z_index: 1,
    });
  });
  return elements;
}

/**
 * Moves the wave on and every bubble a row up. One that reaches the surface starts again elsewhere a few steps under
 * the bottom, so the bubbles do not rise in step.
 */
function step(motion: Motion, h: number): void {
  motion.phase = (motion.phase + WAVE_STEP) % (2 * Math.PI);
  for (const b of motion.bubbles) {
    b.y -= 1;
    if (b.y > surface(b.x, h, motion.phase)) continue;
    b.x = 1 + Math.floor(Math.random() * 70);
    b.y = 15 + Math.floor(Math.random() * 6);
  }
}

/** A pseudo-random number in [0, 1) that stays the same for a pixel, so the heap does not change between redraws. */
function noise(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * The garbage heap h rows high as one bitmap: a mound peaking at the level in the middle and sloping to about a
 * quarter of it at the edges, its top a little uneven, of trash in pieces two pixels wide, brick-like.
 */
function heap(h: number): Element[] {
  if (h === 0) return [];
  const tops: number[] = [];
  for (let x = 0; x < 72; x++) {
    const d = (x - 35.5) / 36;
    const height = Math.round(h * (0.25 + 0.75 * (1 - d * d)) + noise(x, 99) * 1.6 - 0.8);
    tops.push(16 - Math.max(1, Math.min(h, height)));
  }
  const bitmap: string[] = [];
  for (let y = 16 - h; y < 16; y++) {
    let row = "";
    for (let x = 0; x < 72; x++) {
      row += y < tops[x] ? "." : TRASH_KEYS[Math.floor(noise(Math.floor((x + (y % 2)) / 2), y) * TRASH_KEYS.length)];
    }
    bitmap.push(row);
  }
  const data = ["! XPM2", `72 ${h} ${TRASH.length + 1} 1`, ". c none", ...TRASH, ...bitmap];
  return [{ type: "xpmbitmap", id: "heap", data: data.join("\n"), x: 0, y: 16 - h, align: "top_left", z_index: 0 }];
}

/** Small white text outlined by black copies a pixel off in every direction, readable over any fill. */
function outlined(id: string, text: string, x: number, align: "mid_left" | "mid_right"): Element[] {
  const elements: Element[] = [];
  [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].forEach(([dx, dy], k) => {
    elements.push({ type: "text", id: `${id}Outline${k}`, text, font: "small", color: OUTLINE, x: x + dx, y: 8 + dy, align, z_index: 2 });
  });
  elements.push({ type: "text", id, text, font: "small", color: WHITE, x, y: 8, align, z_index: 3 });
  return elements;
}

/**
 * The view the wheel is on: the three tanks side by side, or one tank on the whole display with its label and level
 * over it — the urine yellow with rising bubbles, the waste a garbage heap, the clean water blue.
 */
function frame(levels: (number | null)[], view: number, motion: Motion): Element[] {
  const elements: Element[] = [];
  if (view === 0) {
    levels.forEach((level, i) => elements.push(...tank(i, level)));
    return elements;
  }
  const i = view - 1;
  const level = levels[i];
  const h = rows(level);
  elements.push(...(i === WASTE ? heap(h) : liquid(i, h, motion.phase)));
  if (i === URINE) elements.push(...bubbles(motion, h));
  elements.push(...outlined("name", TANKS[i].label, 1, "mid_left"));
  elements.push(...outlined("value", level === null ? "--" : `${Math.round(level)}%`, 70, "mid_right"));
  return elements;
}

/**
 * Entry point, called at the end of the file: the device runs this script from top to bottom and starts nothing by itself.
 */
function main(): void {
  let levels: (number | null)[] = TANKS.map(() => null);
  let loading = false;
  let stopped = false;
  let view = 0;
  const motion: Motion = { phase: 0, bubbles: [] };
  for (let k = 0; k < BUBBLES; k++) {
    motion.bubbles.push({ x: 1 + Math.floor(Math.random() * 70), y: Math.floor(Math.random() * 16) });
  }
  let motionTimer: ReturnType<typeof setInterval> | undefined;

  const report = (err: unknown) =>
    console.error(`${APP}: ${err instanceof Error ? err.message : String(err)}`);
  const screen = createScreen(APP, report);
  const redraw = () => screen.show(frame(levels, view, motion));

  // The motion timer runs only while a liquid is on the display.
  function animate(): void {
    const sloshing = view > 0 && view - 1 !== WASTE;
    if (sloshing && motionTimer === undefined) {
      motionTimer = setInterval(() => {
        step(motion, rows(levels[view - 1]));
        redraw();
      }, MOTION_MS);
    } else if (!sloshing && motionTimer !== undefined) {
      clearInterval(motionTimer);
      motionTimer = undefined;
    }
  }

  // One poll at a time; a failed one shows "--" until the next.
  async function poll(): Promise<void> {
    if (loading) return;
    loading = true;
    try {
      levels = await load();
    } catch (err) {
      levels = TANKS.map(() => null);
      report(err);
    }
    loading = false;
    if (!stopped) redraw();
  }

  redraw();
  void poll();
  const timer = setInterval(() => void poll(), POLL_MS);

  // The wheel turns the views. Back leaves the app: once the timers are cleared and the handler detached, nothing keeps
  // it alive and the device takes the screen back.
  const unbind = listen("input", (event) => {
    if (stopped) return;
    if (event.key === "encoder") {
      view = (view + event.delta + VIEWS) % VIEWS;
      animate();
      redraw();
      return;
    }
    if (event.key !== "back" || event.action !== "short") return;

    stopped = true;
    screen.close();
    clearInterval(timer);
    if (motionTimer !== undefined) clearInterval(motionTimer);

    // Not detached from inside the handler itself: with nothing else left the unbind stops the app on the spot, while this handler is still running.
    setTimeout(unbind, 0);
  });
}

main();
