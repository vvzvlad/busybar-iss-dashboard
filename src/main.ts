import { device } from "@shared/device";
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

/** The three water tanks of Node 3. */
const TANKS = [
  { item: "NODE3000005", label: "URINE", color: "#FFD000FF" },
  { item: "NODE3000008", label: "WASTE", color: "#C07030FF" },
  { item: "NODE3000009", label: "CLEAN", color: "#3090FFFF" },
];
/** The urine and the water processor of Node 3: the words of their states by value, as the telemetry table gives them. */
const PROCESSORS: { item: string; label: string; states: Record<number, string> }[] = [
  {
    item: "NODE3000004",
    label: "URINE PROCESSOR",
    states: { 2: "STOP", 4: "SHUTDOWN", 8: "MAINTENANCE", 16: "NORMAL", 32: "STANDBY", 64: "IDLE", 128: "SYSTEM INITIALIZED" },
  },
  {
    item: "NODE3000006",
    label: "WATER PROCESSOR",
    states: { 1: "STOP", 2: "SHUTDOWN", 3: "STANDBY", 4: "PROCESS", 5: "HOT SERVICE", 6: "FLUSH", 7: "WARM SHUTDOWN" },
  },
];
/**
 * Cabin air in the US Lab. The telemetry table gives the units as CNT, PSI and PSIA, but the values are degrees
 * Celsius and mmHg: 23.6 for the temperature, 757.8 for the pressure (14.65 psi, the sea-level air the station keeps),
 * and partial pressures of 165.8 O2, 577.6 N2 and 2.4 CO2 that add up to it but for some 12 of water vapour (15.11.2026).
 */
const TEMPERATURE = "USLAB000059";
const PRESSURE = "USLAB000058";
const CO2 = "USLAB000055";
const O2 = "USLAB000053";
const N2 = "USLAB000054";
/** The Solar Alpha Rotary Joints: each turns the four wings of its side of the truss about the truss. */
const SARJ_PORT = "S0000004";
const SARJ_STARBOARD = "S0000003";
/**
 * The four truss segments with solar arrays, port to starboard as the arrays view draws them: the column of their
 * wings, their SARJ, and the Beta Gimbal Assemblies of the wing drawn above the truss and of the one below it, each
 * turning its wing about its own length.
 */
const SEGMENTS = [
  { x: 0, sarj: SARJ_PORT, bga: ["P6000007", "P6000008"] },
  { x: 8, sarj: SARJ_PORT, bga: ["P4000007", "P4000008"] },
  { x: 37, sarj: SARJ_STARBOARD, bga: ["S4000007", "S4000008"] },
  { x: 45, sarj: SARJ_STARBOARD, bga: ["S6000007", "S6000008"] },
];
/** The angles that turn between polls, degrees. */
const ANGLES = [SARJ_PORT, SARJ_STARBOARD, ...SEGMENTS.map((s) => s.bga[0]), ...SEGMENTS.map((s) => s.bga[1])];
/** The solar beta angle, degrees: how far the Sun is out of the plane of the orbit. */
const BETA = "USLAB000040";
/** The station mode, its words by value; Reboost raises the alert. */
const MODE = "USLAB000086";
const MODES: Record<number, string> = {
  1: "STANDARD",
  2: "MICROGRAVITY",
  4: "REBOOST",
  8: "PROXIMITY OPS",
  16: "EXTERNAL OPS",
  32: "SURVIVAL",
  64: "ASCR",
};
const REBOOST = 4;
/**
 * When the station sent the telemetry, ground time: ms since 00:00 UTC on day 0 of the year, so 27621295918 is
 * 16:34:55.9 on day 319, 15.11.2026. It stands still with the other values while the station is out of touch.
 */
const TIME = "TIME_000001";
/**
 * Telemetry sent longer than this before the poll was frozen by a loss of signal: live, it is a second or two old.
 * The margin is for the bar's clock.
 */
const STALE_MS = 60 * 1000;
/** Every channel the app reads, in the order of the subscription group. */
const ITEMS = [
  ...TANKS.map((t) => t.item),
  ...PROCESSORS.map((p) => p.item),
  TEMPERATURE,
  PRESSURE,
  CO2,
  O2,
  N2,
  ...ANGLES,
  BETA,
  MODE,
  TIME,
];
/** localStorage key of the last good poll, a Telemetry as JSON. */
const KEPT_KEY = "telemetry";
/** The liquids on their own views: the colour at the bottom, and of the top pixel of the surface as XPM takes it. */
const LIQUIDS: Record<string, { deep: string; crest: string }> = {
  URINE: { deep: "#C08000FF", crest: "#FFF4A0" },
  CLEAN: { deep: "#0838B0FF", crest: "#B0E8FF" },
};
const URINE = 0;
const WASTE = 1;
/**
 * The wheel's views: 0 is the three tanks side by side, view v up to TANKS.length the tank TANKS[v - 1] on the whole
 * display, then cabin air and the solar arrays.
 */
const WEATHER_VIEW = TANKS.length + 1;
const ARRAYS_VIEW = TANKS.length + 2;
const VIEWS = TANKS.length + 3;

const WHITE = "#FFFFFFFF";
const SUBTLE_WHITE = "#FFFFFFA0";
const OUTLINE = "#000000FF";
const TRACK = "#FFFFFF30";
const BUBBLE = "#FFFCE0FF";
const WARM = "#FFA040FF";
const AIR = "#80E0A0FF";
const TRUSS = "#909090FF";
const HULL = "#D0D0D0FF";
/** The wing colour without its alpha: the end row of a wing gets an alpha of its own. */
const WING = "#E0A030";
const SUN = "#FFE060FF";
const ALERT = "#FF8000FF";
const SEGMENT_W = 24;
const BAR_W = 2;

/** How far a wing reaches from the truss, rows, and how wide it is, columns, both seen face-on. */
const WING_LENGTH = 7;
const WING_WIDTH = 7;

/**
 * The back display's table: the right edge of its values, a gap off the firmware's status bar, the right edge of the
 * left column's values and the left edge of the right column, and the pitch of its rows.
 */
const BACK_RIGHT = 145;
const BACK_MIDDLE = 68;
const BACK_HALF = 74;
const ROW_H = 10;

/** Values that are not live, kept from an earlier poll or frozen by a loss of signal, are drawn at this brightness. */
const DIM = 0.4;

/** The no-connection picture, the same in every app. */
const OFFLINE = ["! XPM2", "5 5 2 1", ". c none", "r c #FF3030", "r...r", ".r.r.", "..r..", ".r.r.", "r...r"].join("\n");
/**
 * Its top left corner on each view, where it covers no number: over the foot of the clean water's bar, over a corner
 * of the liquids and the heap, under the pressure on cabin air, over the tip of the port wing; and on the reboost
 * alert, over the port wing of its picture.
 */
const OFFLINE_AT = [[67, 11], [67, 0], [67, 0], [67, 0], [67, 11], [0, 0]];
const OFFLINE_ALERT_AT = [0, 0];

/**
 * The reboost alert's picture, the station as the arrays view draws it, seen from above and flying up the display,
 * with the engine at its tail firing.
 */
const BOOST = [
  "! XPM2",
  "20 16 7 1",
  ". c none",
  "w c #E0A030",
  "t c #909090",
  "m c #D0D0D0",
  "y c #FFE060",
  "o c #FF8000",
  "r c #C03000",
  ".........mm.........",
  ".www.www.mm.www.www.",
  ".www.www.mm.www.www.",
  ".www.www.mm.www.www.",
  ".www.www.mm.www.www.",
  ".www.www.mm.www.www.",
  ".ttttttttmmtttttttt.",
  ".www.www.mm.www.www.",
  ".www.www.mm.www.www.",
  ".www.www.mm.www.www.",
  ".www.www.mm.www.www.",
  ".www.www.mm.www.www.",
  ".........mm.........",
  "........oyyo........",
  "........ryyr........",
  ".........oo.........",
].join("\n");

/** The liquids slosh and the bubbles rise a step at this period, only while such a view is shown. */
const MOTION_MS = 250;
/** The solar arrays are drawn turned on at this period while their view is shown and they are known to turn. */
const TURN_MS = 1000;
/**
 * Two polls further apart than this give no rate: a SARJ, about 4 degrees a minute, could have turned too far for the
 * shorter way round to be the one it took.
 */
const TURN_SPAN_MS = 20 * 60 * 1000;
/**
 * The liquids slosh in place, nothing runs along the tank: the surface rises at one end as it falls at the other, and a
 * ripple of a third of the tank rises and falls on it twice as fast. WAVE_STEP is how far the slosh goes on a step, a
 * whole one being 2π; WAVE_AMP the most rows the surface goes up or down from its level.
 */
const WAVE_STEP = 0.5;
const WAVE_AMP = 2;
/** Across the tank, column by column, the shape of the slosh and of the ripple: cos(πx/71) and cos(3πx/71). */
const SLOSH: number[] = [];
const RIPPLE: number[] = [];
for (let x = 0; x < 72; x++) {
  SLOSH.push(Math.cos((Math.PI * x) / 71));
  RIPPLE.push(Math.cos((3 * Math.PI * x) / 71));
}
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
 * Reads the values of ITEMS by channel: a session, a subscription with a snapshot, and one poll that brings the
 * snapshot and the updates that came with it as lines "U,1,<position in the group>,<value>"; the last of a
 * channel wins. A channel missing from the answer is left out; an answer without any is a failed poll.
 */
async function load(): Promise<Record<string, number>> {
  const created = await post(
    `create_session.txt?${PROTOCOL}`,
    `LS_cid=${CID}&LS_adapter_set=ISSLIVE&LS_polling=true&LS_polling_millis=0&LS_idle_millis=0`,
  );
  const session = /^CONOK,([^,\r\n]+)/.exec(created);
  if (!session) throw new Error(`no session: ${created.slice(0, 40)}`);

  const group = ITEMS.join("%20");
  const subscribed = await post(
    `control.txt?${PROTOCOL}&LS_session=${session[1]}`,
    `LS_reqId=1&LS_op=add&LS_subId=1&LS_mode=MERGE&LS_group=${group}&LS_schema=Value&LS_snapshot=true`,
  );
  if (subscribed.indexOf("REQOK") < 0) throw new Error(`not subscribed: ${subscribed.slice(0, 40)}`);

  const bound = await post(
    `bind_session.txt?${PROTOCOL}`,
    `LS_session=${session[1]}&LS_polling=true&LS_polling_millis=0&LS_idle_millis=3000`,
  );
  const values: Record<string, number> = {};
  for (const line of bound.split("\n")) {
    const update = /^U,1,(\d+),([^\r]*)/.exec(line);
    if (!update) continue;
    const value = parseFloat(update[2]);
    const item = ITEMS[Number(update[1]) - 1];
    if (item !== undefined && isFinite(value)) values[item] = value;
  }
  if (Object.keys(values).length === 0) throw new Error(`no values: ${bound.slice(0, 40)}`);
  return values;
}

/** One good poll: when it was (Date.now() ms) and the values by channel. */
interface Telemetry {
  at: number;
  values: Record<string, number>;
}

/** How the poll went: none answered yet, the last one did, or the last one failed. */
type Link = "wait" | "ok" | "lost";

/** How the solar arrays turn on after a poll: from when its values were sent (Unix ms), degrees per ms by channel. */
interface Turning {
  from: number;
  rates: Record<string, number>;
}

/** The last good poll kept in localStorage; null before the first, and for an unreadable one. */
function kept(): Telemetry | null {
  try {
    const raw = localStorage.getItem(KEPT_KEY);
    return raw ? (JSON.parse(raw) as Telemetry) : null;
  } catch {
    return null;
  }
}

/** A channel's value in a poll; null without a poll or without the channel in it. */
function value(data: Telemetry | null, item: string): number | null {
  return data !== null && item in data.values ? data.values[item] : null;
}

/** When the station sent a poll's telemetry, Unix ms, by TIME_000001 in the year of the poll; null without it. */
function sent(data: Telemetry): number | null {
  const time = value(data, TIME);
  return time === null ? null : Date.UTC(new Date(data.at).getUTCFullYear(), 0, 0) + time;
}

/** Whether a poll brought telemetry frozen by a loss of signal: sent long before it arrived. */
function stale(data: Telemetry): boolean {
  const at = sent(data);
  return at !== null && data.at - at > STALE_MS;
}

/**
 * How the angles turned between two polls, each by the shorter way round; null without the times they were sent,
 * when nothing new was sent in between, and when they are more than TURN_SPAN_MS apart. The caller also passes no
 * stale poll: its angles are frozen where the signal was lost.
 */
function turn(before: Telemetry | null, after: Telemetry): Turning | null {
  const from = before && sent(before);
  const to = sent(after);
  if (!from || to === null || to <= from || to - from > TURN_SPAN_MS) return null;
  const rates: Record<string, number> = {};
  for (const item of ANGLES) {
    const a = value(before, item);
    const b = value(after, item);
    if (a !== null && b !== null) rates[item] = (((b - a + 540) % 360) - 180) / (to - from);
  }
  return { from: to, rates };
}

/** An angle at the moment now, degrees: its value in the poll, turned on at its rate since it was sent; null without it. */
function angle(data: Telemetry | null, turning: Turning | null, item: string, now: number): number | null {
  const a = value(data, item);
  if (a === null || turning === null || !(item in turning.rates)) return a;
  return a + turning.rates[item] * (now - turning.from);
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

/** The motion of the liquids: the phase of the slosh and the bubbles in the urine, by column and row. */
interface Motion {
  phase: number;
  bubbles: { x: number; y: number }[];
}

/** The top lit row of column x of a liquid h rows deep: the level, raised or lowered there by the slosh. */
function surface(x: number, h: number, phase: number): number {
  const wave = Math.round(1.4 * SLOSH[x] * Math.sin(phase) + 0.6 * RIPPLE[x] * Math.sin(2 * phase));
  return 16 - Math.max(0, Math.min(16, h + wave));
}

/**
 * A liquid h rows deep over the whole display: a gradient up to the lowest row the surface comes down to, and over it
 * the rows the surface goes through as one bitmap, lit up to the surface in each column, its top pixel lighter.
 */
function liquid(i: number, h: number, phase: number): Element[] {
  if (h === 0) return [];
  const t = TANKS[i];
  const look = LIQUIDS[t.label];
  const elements: Element[] = [];
  if (h > WAVE_AMP + 1) {
    elements.push({
      type: "rectangle",
      id: "body",
      x: 0,
      y: 17 - h + WAVE_AMP,
      width: 72,
      height: h - 1 - WAVE_AMP,
      fill: "gradient_v",
      fill_colors: [t.color, look.deep],
      border_width: 0,
      align: "top_left",
      z_index: 0,
    });
  }
  const tops: number[] = [];
  for (let x = 0; x < 72; x++) tops.push(surface(x, h, phase));
  const top = Math.max(0, 16 - h - WAVE_AMP);
  const bitmap: string[] = [];
  for (let y = top; y <= Math.min(15, 16 - h + WAVE_AMP); y++) {
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
 * Moves the slosh on and every bubble a row up. One that reaches the surface starts again elsewhere a few steps under
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

/** A channel's value in a poll with digits after the point and its unit; "--" without it. */
function figure(data: Telemetry | null, item: string, digits: number, unit: string): string {
  const v = value(data, item);
  // "-0" from a value just under zero is shown as "0".
  return v === null ? "--" : `${v.toFixed(digits).replace(/^-(0\.?0*)$/, "$1")}${unit}`;
}

/** Cabin air: the temperature and the pressure on top, the CO2 under them. */
function weather(data: Telemetry | null): Element[] {
  return [
    { type: "text", id: "temperature", text: figure(data, TEMPERATURE, 1, "°C"), font: "small", color: WARM, x: 0, y: 0, align: "top_left" },
    { type: "text", id: "pressure", text: figure(data, PRESSURE, 0, " mmHg"), font: "small", color: WHITE, x: 71, y: 0, align: "top_right" },
    { type: "text", id: "co2Label", text: "CO2", font: "small", color: SUBTLE_WHITE, x: 0, y: 8, align: "top_left" },
    { type: "text", id: "co2", text: figure(data, CO2, 1, " mmHg"), font: "small", color: AIR, x: 17, y: 8, align: "top_left" },
  ];
}

/** A solid rectangle, top left at x, y. */
function block(id: string, x: number, y: number, width: number, height: number, color: string, z = 0): Element {
  return { type: "rectangle", id, x, y, width, height, fill: "solid", fill_colors: [color], border_width: 0, align: "top_left", z_index: z };
}

/**
 * The solar arrays seen from above the station, which flies up the display: the truss across it, the modules along the
 * middle, and on each of the four outer segments a wing above the truss and one below it. A SARJ turning its wings away
 * from the viewer shortens them by the cosine of its angle, a BGA turning its wing about its length narrows it by the
 * cosine of its own; the end row of a wing is lit by the part of a row the wing reaches into. The beta angle on the right.
 */
function arrays(data: Telemetry | null, turning: Turning | null, now: number): Element[] {
  const elements: Element[] = [block("truss", 0, 7, 52, 2, TRUSS), block("hull", 25, 1, 2, 14, HULL, 1)];
  SEGMENTS.forEach((s, k) => {
    const sarj = angle(data, turning, s.sarj, now);
    s.bga.forEach((item, below) => {
      const bga = angle(data, turning, item, now);
      if (sarj === null || bga === null) return;
      const reach = WING_LENGTH * Math.abs(Math.cos((sarj * Math.PI) / 180));
      const width = Math.round(WING_WIDTH * Math.abs(Math.cos((bga * Math.PI) / 180)));
      if (width === 0) return;
      const full = Math.floor(reach);
      const tip = Math.round((reach - full) * 15);
      const x = s.x + Math.floor((WING_WIDTH - width) / 2);
      if (full > 0) elements.push(block(`wing${k}${below}`, x, below ? 9 : 7 - full, width, full, `${WING}FF`));
      // The mast between the wing's two blankets.
      if (full > 0 && width >= 3) elements.push(block(`mast${k}${below}`, s.x + 3, below ? 9 : 7 - full, 1, full, TRUSS, 1));
      if (tip > 0) elements.push(block(`tip${k}${below}`, x, below ? 9 + full : 6 - full, width, 1, `${WING}${tip.toString(16)}${tip.toString(16)}`));
    });
  });
  elements.push(
    { type: "text", id: "betaLabel", text: "BETA", font: "tiny", color: SUBTLE_WHITE, x: 55, y: 0, align: "top_left" },
    { type: "text", id: "beta", text: figure(data, BETA, 0, "°"), font: "small", color: SUN, x: 55, y: 7, align: "top_left" },
  );
  return elements;
}

/** The reboost alert over the whole front display: the station with its engine firing, and the word. */
function alert(): Element[] {
  return [
    { type: "xpmbitmap", id: "alertPicture", data: BOOST, x: 0, y: 0, align: "top_left", z_index: 0 },
    { type: "text", id: "alertText", text: "REBOOST", font: "bold", color: ALERT, x: 21, y: 8, align: "mid_left", z_index: 0 },
  ];
}

/** A grey label on the back display, its left edge at x, in a row of the table. */
function label(id: string, text: string, x: number, row: number): Element {
  return { type: "text", id, text, font: "small", color: SUBTLE_WHITE, x, y: row * ROW_H, align: "top_left", display: "back" };
}

/** A white value on the back display, its right edge at x (or its left edge, by align), in a row of the table. */
function reading(id: string, text: string, x: number, row: number, align: "top_right" | "top_left" = "top_right"): Element {
  return { type: "text", id, text, font: "small", color: WHITE, x, y: row * ROW_H, align, display: "back" };
}

/**
 * The back display, every number as a table: the tanks, the processors' states, cabin air, the beta angle, the station
 * mode, and how old the data is, counted up by the firmware from when the station sent it; "--" for a value missing.
 * The age is labelled NO LINK after a failed poll and NO SIGNAL for telemetry frozen by a loss of signal. Dimmed when
 * the values are not live.
 */
function back(data: Telemetry | null, link: Link): Element[] {
  const word = (item: string, words: Record<number, string>) => {
    const v = value(data, item);
    return v === null ? "--" : (words[v] ?? String(v));
  };
  const elements: Element[] = [];
  TANKS.forEach((t, i) => {
    elements.push(label(`backTank${i}`, t.label, i * 50, 0), reading(`backLevel${i}`, figure(data, t.item, 0, "%"), 27 + i * 50, 0, "top_left"));
  });
  PROCESSORS.forEach((p, i) => {
    elements.push(label(`backProcessor${i}`, p.label, 0, 1 + i), reading(`backState${i}`, word(p.item, p.states), BACK_RIGHT, 1 + i));
  });
  elements.push(
    label("backTemperatureLabel", "TEMP", 0, 3),
    reading("backTemperature", figure(data, TEMPERATURE, 1, "°C"), BACK_MIDDLE, 3),
    label("backPressureLabel", "PRESS", BACK_HALF, 3),
    reading("backPressure", figure(data, PRESSURE, 1, " mmHg"), BACK_RIGHT, 3),
    label("backO2Label", "O2", 0, 4),
    reading("backO2", figure(data, O2, 1, " mmHg"), BACK_MIDDLE, 4),
    label("backN2Label", "N2", BACK_HALF, 4),
    reading("backN2", figure(data, N2, 1, " mmHg"), BACK_RIGHT, 4),
    label("backCo2Label", "CO2", 0, 5),
    reading("backCo2", figure(data, CO2, 2, " mmHg"), BACK_MIDDLE, 5),
    label("backBetaLabel", "BETA", BACK_HALF, 5),
    reading("backBeta", figure(data, BETA, 1, "°"), BACK_RIGHT, 5),
    label("backModeLabel", "MODE", 0, 6),
    reading("backMode", word(MODE, MODES), BACK_RIGHT, 6),
    label("backAgeLabel", link === "lost" ? "NO LINK" : data !== null && stale(data) ? "NO SIGNAL" : "DATA AGE", 0, 7),
  );
  const at = data && sent(data);
  if (!at) {
    elements.push(reading("backAge", "--", BACK_RIGHT, 7));
  } else {
    elements.push({
      type: "countdown",
      id: "backAgeCount",
      timestamp: String(Math.floor(at / 1000)),
      direction: "time_since",
      show_hours: "always",
      color: WHITE,
      x: BACK_RIGHT,
      y: 7 * ROW_H,
      align: "top_right",
      display: "back",
    });
  }
  return live(data, link) ? elements : elements.map(dim);
}

/** Whether the values are live: the last poll answered, with telemetry the station had just sent. */
function live(data: Telemetry | null, link: Link): boolean {
  return link === "ok" && data !== null && !stale(data);
}

/** A colour, "#RRGGBBAA", at DIM of its brightness. */
function dimmed(color: string): string {
  let out = "#";
  for (let i = 1; i < 7; i += 2) out += Math.round(parseInt(color.slice(i, i + 2), 16) * DIM).toString(16).padStart(2, "0");
  return out + color.slice(7);
}

/** An element drawn at DIM of its brightness. */
function dim(e: Element): Element {
  if (e.type === "text" || e.type === "countdown") return { ...e, color: dimmed(e.color ?? WHITE) };
  if (e.type === "rectangle") return { ...e, fill_colors: (e.fill_colors ?? []).map(dimmed) };
  if (e.type === "xpmbitmap") return { ...e, opacity: Math.round(DIM * 100) };
  return e;
}

/**
 * Both displays: the view the wheel is on, or the reboost alert in its place while the station mode is Reboost, and
 * the back display as back() made it after the poll. Values that are not live, kept from an earlier poll or frozen by a
 * loss of signal, are dimmed; after a failed poll the no-connection picture is in a corner of the front.
 */
function frame(
  data: Telemetry | null,
  link: Link,
  turning: Turning | null,
  view: number,
  motion: Motion,
  now: number,
  backside: Element[],
): Element[] {
  const alerting = value(data, MODE) === REBOOST;
  const elements = alerting ? alert() : front(data, turning, view, motion, now);
  const shown = live(data, link) ? elements : elements.map(dim);
  if (link === "lost") {
    const [x, y] = alerting ? OFFLINE_ALERT_AT : OFFLINE_AT[view];
    shown.push({ type: "xpmbitmap", id: "offline", data: OFFLINE, x, y, align: "top_left", z_index: 4 });
  }
  return shown.concat(backside);
}

/**
 * The view the wheel is on: the three tanks side by side, or one tank on the whole display with its label and level
 * over it — the urine yellow with rising bubbles, the waste a garbage heap, the clean water blue; or cabin air, or the
 * solar arrays.
 */
function front(data: Telemetry | null, turning: Turning | null, view: number, motion: Motion, now: number): Element[] {
  if (view === WEATHER_VIEW) return weather(data);
  if (view === ARRAYS_VIEW) return arrays(data, turning, now);
  const levels = TANKS.map((t) => value(data, t.item));
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
  let data = kept();
  let link: Link = "wait";
  let turning: Turning | null = null;
  // Made once a poll, not with every frame of the motion.
  let backside = back(data, link);
  // Whether the reboost under way has had its sound and blink.
  let alerted = false;
  let loading = false;
  let stopped = false;
  let view = 0;
  const motion: Motion = { phase: 0, bubbles: [] };
  for (let k = 0; k < BUBBLES; k++) {
    motion.bubbles.push({ x: 1 + Math.floor(Math.random() * 70), y: Math.floor(Math.random() * 16) });
  }
  let motionTimer: ReturnType<typeof setInterval> | undefined;
  let motionPeriod = 0;

  const report = (err: unknown) =>
    console.error(`${APP}: ${err instanceof Error ? err.message : String(err)}`);
  const screen = createScreen(APP, report);
  const redraw = (led?: string) => screen.show(frame(data, link, turning, view, motion, Date.now(), backside), led);

  // The motion timer runs only while something on the display moves: a liquid sloshes, or the solar arrays turn. The
  // reboost alert stops it, being drawn in the view's place.
  function animate(): void {
    let period = 0;
    if (value(data, MODE) !== REBOOST) {
      if (view > 0 && view <= TANKS.length && view - 1 !== WASTE) period = MOTION_MS;
      else if (view === ARRAYS_VIEW && turning !== null) period = TURN_MS;
    }
    if (motionTimer !== undefined && period !== motionPeriod) {
      clearInterval(motionTimer);
      motionTimer = undefined;
    }
    if (period > 0 && motionTimer === undefined) {
      motionPeriod = period;
      motionTimer = setInterval(() => {
        if (view !== ARRAYS_VIEW) step(motion, rows(value(data, TANKS[view - 1].item)));
        redraw();
      }, period);
    }
  }

  // One poll at a time. A good one is kept in localStorage; a failed one leaves the last good one on the display,
  // dimmed. The first poll to find the station in Reboost sounds the alert and blinks the LED.
  async function poll(): Promise<void> {
    if (loading) return;
    loading = true;
    let rising = false;
    try {
      const next: Telemetry = { at: Date.now(), values: await load() };
      // A poll that is already stale brings angles frozen at the loss of signal: the arrays stop there.
      turning = stale(next) ? null : turn(data, next);
      data = next;
      link = "ok";
      const reboost = value(next, MODE) === REBOOST;
      rising = reboost && !alerted;
      alerted = reboost;
      try {
        localStorage.setItem(KEPT_KEY, JSON.stringify(next));
      } catch (err) {
        report(err);
      }
    } catch (err) {
      link = "lost";
      turning = null;
      report(err);
    }
    loading = false;
    if (stopped) return;
    backside = back(data, link);
    animate();
    if (rising) void device.AudioPlay({ application_name: APP, path: "sounds/reboost.snd" }).catch(report);
    redraw(rising ? ALERT : undefined);
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
