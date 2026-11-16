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
 * A liquid lies under a straight surface tilted by an angle, radians, positive deeper at the left wall, which swings
 * as a damped pendulum stepped every MOTION_MS: on a step its swing, radians a step, is pulled towards the angle of
 * rest by SPRING of the angle off it and slowed by DRAG of itself, a swing of about 3 s that dies down in about 10 s.
 * The angle of rest is level, and TILT_MAX while the station fires its engines for a reboost, pressing the liquid
 * against the left wall. The surface is drawn no steeper than TILT_MAX, so the liquid stands at the wall as a column
 * while the pendulum swings past that angle and back.
 */
const SPRING = 0.25;
const DRAG = 0.14;
const TILT_MAX = (88 * Math.PI) / 180;
/**
 * Kicks set it sloshing: an impulse to the swing in a random direction. At random, on a step with JOLT_CHANCE, up to
 * KICK, which swings the surface about 1.6 rows up and down at the walls; or by the station's control moment
 * gyroscopes, GYRO_GAIN for each unit their control torque changed by. A ripple of a third of the tank rises and falls
 * on the surface twice as fast as the slosh, PACE of its phase a step: a kick of KICK raises it to RIPPLE_MAX rows, a
 * weaker one less, and it dies down by DAMP a step.
 */
const JOLT_CHANCE = 0.04;
const KICK = 0.03;
const GYRO_GAIN = 0.2;
const RIPPLE_MAX = 0.6;
const DAMP = 0.97;
const PACE = Math.PI / 6;
/** Across the tank, column by column, the shape of the ripple: cos(3πx/71). */
const RIPPLE: number[] = [];
for (let x = 0; x < 72; x++) RIPPLE.push(Math.cos((3 * Math.PI * x) / 71));
/** A row of the liquid's bitmap with nothing lit. */
const EMPTY_ROW = ".".repeat(72);
const BUBBLES = 5;
/**
 * When a poll finds the urine tank fuller than the last one did while it is on the display, a stream falls into it
 * for POUR_MS from the top to the surface at column POUR_X, and the level is drawn rising from the old one.
 */
const POUR_MS = 4000;
const POUR_X = 36;
/** The reboost alert covers the front for this long from the poll that finds the reboost, then the views come back. */
const ALERT_MS = 10 * 1000;
/**
 * The control torque of the station's control moment gyroscopes about roll, pitch and yaw, updated about once a
 * second: what kicks the liquids with the Gyroscopes setting.
 */
const TORQUE = ["USLAB000006", "USLAB000007", "USLAB000008"];
/** The torque stream starts again this long after it fails. */
const RETRY_MS = 10 * 1000;

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

/** A session subscribed to the channels with a snapshot; resolves to its id. */
async function subscribe(items: string[]): Promise<string> {
  const created = await post(
    `create_session.txt?${PROTOCOL}`,
    `LS_cid=${CID}&LS_adapter_set=ISSLIVE&LS_polling=true&LS_polling_millis=0&LS_idle_millis=0`,
  );
  const session = /^CONOK,([^,\r\n]+)/.exec(created);
  if (!session) throw new Error(`no session: ${created.slice(0, 40)}`);

  const group = items.join("%20");
  const subscribed = await post(
    `control.txt?${PROTOCOL}&LS_session=${session[1]}`,
    `LS_reqId=1&LS_op=add&LS_subId=1&LS_mode=MERGE&LS_group=${group}&LS_schema=Value&LS_snapshot=true`,
  );
  if (subscribed.indexOf("REQOK") < 0) throw new Error(`not subscribed: ${subscribed.slice(0, 40)}`);
  return session[1];
}

/** One poll of a session: the snapshot, or the updates since the last poll, waiting up to 3 s for one. */
function bind(session: string): Promise<string> {
  return post(
    `bind_session.txt?${PROTOCOL}`,
    `LS_session=${session}&LS_polling=true&LS_polling_millis=0&LS_idle_millis=3000`,
  );
}

/**
 * Every update in a poll's answer, lines "U,1,<position in the group>,<value>", in their order; values that are not
 * numbers are left out.
 */
function updates(bound: string, take: (position: number, value: number) => void): void {
  for (const line of bound.split("\n")) {
    const update = /^U,1,(\d+),([^\r]*)/.exec(line);
    if (!update) continue;
    const value = parseFloat(update[2]);
    if (isFinite(value)) take(Number(update[1]), value);
  }
}

/**
 * Reads the values of ITEMS by channel: a session and one poll that brings the snapshot and the updates that came
 * with it; the last of a channel wins. A channel missing from the answer is left out; an answer without any is a
 * failed poll.
 */
async function load(): Promise<Record<string, number>> {
  const bound = await bind(await subscribe(ITEMS));
  const values: Record<string, number> = {};
  updates(bound, (position, value) => {
    const item = ITEMS[position - 1];
    if (item !== undefined) values[item] = value;
  });
  if (Object.keys(values).length === 0) throw new Error(`no values: ${bound.slice(0, 40)}`);
  return values;
}

/** What kicks the liquids, the Slosh setting: random jolts, or the gyroscopes' torque streamed live. */
type Slosh = "random" | "gyros";

/** The Slosh setting; random unless it says gyros. */
async function loadSlosh(): Promise<Slosh> {
  const { values } = await device.AppsSettingsGet({ app_id: APP });
  return values.slosh === "gyros" ? "gyros" : "random";
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

/**
 * The motion of the liquids: the tilt of the surface and its swing (see SPRING), the ripple's phase and strength in
 * rows, the top lit row of each column as last drawn (16 for an empty one), the bubbles in the urine by column and
 * row, and the stream into the urine: the level it started from and when it ends, Date.now() ms.
 */
interface Motion {
  tilt: number;
  swing: number;
  phase: number;
  ripple: number;
  tops: number[];
  bubbles: { x: number; y: number }[];
  pourFrom: number;
  pourUntil: number;
}

/** A kick: an impulse to the swing in a random direction, and the ripple raised for its strength. */
function kick(motion: Motion, impulse: number): void {
  motion.swing += Math.random() < 0.5 ? -impulse : impulse;
  motion.ripple = Math.max(motion.ripple, RIPPLE_MAX * Math.min(1, impulse / KICK));
}

/** The integral of the depth clamp(w, 0, 16) from -∞ to v. */
function under(v: number): number {
  return v <= 0 ? 0 : v <= 16 ? (v * v) / 2 : 128 + 16 * (v - 16);
}

/**
 * The area under the surface a - slope·(x - 36) over the 72 columns, its depth clamped to the 16 rows, in closed
 * form: with w = a - slope·(x - 36), the integral of the depth over x is that of clamp(w, 0, 16) over w divided by
 * the slope.
 */
function area(a: number, slope: number): number {
  const s = 36 * Math.abs(slope);
  // A surface this close to level: the closed form would divide by next to nothing.
  return s < 1e-6 ? 72 * Math.max(0, Math.min(16, a)) : ((under(a + s) - under(a - s)) * 36) / s;
}

/**
 * The top lit row of each column of a liquid at a level, percent, 16 for an empty column: the surface at the motion's
 * tilt, no steeper than TILT_MAX, is as high as leaves the level's share of the display under it, found by halving
 * the range of heights 20 times; the ripple moves it up and down.
 */
function surface(level: number, motion: Motion): number[] {
  const slope = Math.tan(Math.max(-TILT_MAX, Math.min(TILT_MAX, motion.tilt)));
  const target = (Math.max(0, Math.min(100, level)) * 72 * 16) / 100;
  let low = -36 * Math.abs(slope);
  let high = 16 - low;
  for (let k = 0; k < 20; k++) {
    const middle = (low + high) / 2;
    if (area(middle, slope) < target) low = middle;
    else high = middle;
  }
  const a = (low + high) / 2;
  const wave = motion.ripple * Math.sin(2 * motion.phase);
  const tops: number[] = [];
  // An empty tank stays empty: the ripple would light a few pixels on the bottom row.
  if (target === 0) {
    for (let x = 0; x < 72; x++) tops.push(16);
    return tops;
  }
  for (let x = 0; x < 72; x++) {
    const depth = Math.round(a - slope * (x - 35.5) + wave * RIPPLE[x]);
    tops.push(16 - Math.max(0, Math.min(16, depth)));
  }
  return tops;
}

/**
 * A liquid over the whole display with the tops of its columns: the rows the surface goes through as one bitmap, lit
 * from the surface down in each column, its top pixel lighter, and under the lowest of them a gradient.
 */
function liquid(i: number, tops: number[]): Element[] {
  const t = TANKS[i];
  const look = LIQUIDS[t.label];
  // The columns whose top is on each row, the empty ones on row 16.
  const on: number[][] = [];
  for (let y = 0; y <= 16; y++) on.push([]);
  let top = 16;
  let bottom = 0;
  for (let x = 0; x < 72; x++) {
    on[tops[x]].push(x);
    top = Math.min(top, tops[x]);
    bottom = Math.max(bottom, tops[x]);
  }
  if (top === 16) return [];
  const elements: Element[] = [];
  if (bottom < 15) {
    elements.push({
      type: "rectangle",
      id: "body",
      x: 0,
      y: bottom + 1,
      width: 72,
      height: 15 - bottom,
      fill: "gradient_v",
      fill_colors: [t.color, look.deep],
      border_width: 0,
      align: "top_left",
      z_index: 0,
    });
  }
  // Rows from the top down: a column is empty above its top and lit under it, so a row differs from the one above only
  // in the columns whose top is on it or on the row above, and the bitmap is not built cell by cell.
  const last = Math.min(15, bottom);
  const cells = EMPTY_ROW.split("");
  const data = ["! XPM2", `72 ${last - top + 1} 3 1`, ". c none", `b c ${t.color.slice(0, 7)}`, `c c ${look.crest}`];
  for (let y = top; y <= last; y++) {
    if (y > top) for (const x of on[y - 1]) cells[x] = "b";
    for (const x of on[y]) cells[x] = "c";
    data.push(cells.join(""));
  }
  // Without an explicit z_index the firmware drew a new bitmap over the text in the first frame (emulator, 1.3.1).
  elements.push({ type: "xpmbitmap", id: "surface", data: data.join("\n"), x: 0, y: top, align: "top_left", z_index: 0 });
  return elements;
}

/**
 * The stream into the urine: a pixel a row from the top of the display down to the surface at POUR_X, each row a
 * column either way of it as the stream wiggles, every third row lighter, the light rows running down.
 */
function pour(tops: number[], now: number): Element[] {
  const depth = tops[POUR_X];
  if (depth === 0) return [];
  const tick = Math.floor(now / MOTION_MS);
  const data = ["! XPM2", `3 ${depth} 3 1`, ". c none", `b c ${TANKS[URINE].color.slice(0, 7)}`, `c c ${LIQUIDS.URINE.crest}`];
  for (let y = 0; y < depth; y++) {
    const pixel = (y - tick) % 3 === 0 ? "c" : "b";
    const side = Math.round(Math.sin(y * 0.9 + tick * 1.3));
    data.push(side < 0 ? `${pixel}..` : side > 0 ? `..${pixel}` : `.${pixel}.`);
  }
  return [{ type: "xpmbitmap", id: "pour", data: data.join("\n"), x: POUR_X - 1, y: 0, align: "top_left", z_index: 1 }];
}

/** The bubbles that are on the display and under the surface as last drawn, a pixel each. */
function bubbles(motion: Motion): Element[] {
  const elements: Element[] = [];
  motion.bubbles.forEach((b, k) => {
    if (b.y > 15 || b.y <= motion.tops[b.x]) return;
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
 * Swings the surface on, towards TILT_MAX in a reboost and level otherwise, lets the ripple die down, kicks the swing
 * at random when `random` says so, and moves every bubble a row up. One that reaches the surface as last drawn starts
 * again elsewhere a few steps under the bottom, so the bubbles do not rise in step.
 */
function step(motion: Motion, reboost: boolean, random: boolean): void {
  motion.swing -= SPRING * (motion.tilt - (reboost ? TILT_MAX : 0)) + DRAG * motion.swing;
  motion.tilt += motion.swing;
  motion.phase = (motion.phase + PACE) % (2 * Math.PI);
  motion.ripple *= DAMP;
  if (random && Math.random() < JOLT_CHANCE) kick(motion, KICK * (0.3 + 0.7 * Math.random()));
  for (const b of motion.bubbles) {
    b.y -= 1;
    if (b.y > motion.tops[b.x]) continue;
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
 * Both displays: the view the wheel is on, or the reboost alert in its place while `alerting`, and the back display as
 * back() made it after the poll. Values that are not live, kept from an earlier poll or frozen by a loss of signal,
 * are dimmed; after a failed poll the no-connection picture is in a corner of the front.
 */
function frame(
  data: Telemetry | null,
  link: Link,
  turning: Turning | null,
  view: number,
  alerting: boolean,
  motion: Motion,
  now: number,
  backside: Element[],
): Element[] {
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
 * over it — the urine yellow with rising bubbles and, while a stream pours into it, its level rising to the new one,
 * the waste a garbage heap, the clean water blue; or cabin air, or the solar arrays. The liquid's surface is kept in
 * the motion, for the bubbles to rise to.
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
  let level = levels[i];
  const pouring = i === URINE && now < motion.pourUntil;
  if (pouring && level !== null) level -= ((level - motion.pourFrom) * (motion.pourUntil - now)) / POUR_MS;
  if (i === WASTE) {
    elements.push(...heap(rows(level)));
  } else {
    motion.tops = surface(level ?? 0, motion);
    elements.push(...liquid(i, motion.tops));
  }
  if (i === URINE) elements.push(...bubbles(motion));
  if (pouring) elements.push(...pour(motion.tops, now));
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
  // The urine level of this run's last good poll: the kept one may be days old, and a rise since then is no stream.
  let lastUrine: number | null = null;
  // Whether the reboost alert covers the front, and the timer that takes it off.
  let alerting = false;
  let alertTimer: ReturnType<typeof setTimeout> | undefined;
  let loading = false;
  let stopped = false;
  let view = 0;
  let slosh: Slosh = "random";
  const motion: Motion = { tilt: 0, swing: 0, phase: 0, ripple: 0, tops: [], bubbles: [], pourFrom: 0, pourUntil: 0 };
  for (let x = 0; x < 72; x++) motion.tops.push(16);
  for (let k = 0; k < BUBBLES; k++) {
    motion.bubbles.push({ x: 1 + Math.floor(Math.random() * 70), y: Math.floor(Math.random() * 16) });
  }
  let motionTimer: ReturnType<typeof setInterval> | undefined;
  let motionPeriod = 0;
  // Whether a torque stream is going, and the timer that starts it again after a failure.
  let following = false;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const report = (err: unknown) =>
    console.error(`${APP}: ${err instanceof Error ? err.message : String(err)}`);
  const screen = createScreen(APP, report);
  const redraw = (led?: string) => screen.show(frame(data, link, turning, view, alerting, motion, Date.now(), backside), led);
  // A liquid is on the front: the urine or the clean water, with no alert over it.
  const sloshing = () => !stopped && !alerting && view > 0 && view <= TANKS.length && view - 1 !== WASTE;

  // The motion timer runs only while something on the display moves: a liquid sloshes, or the solar arrays turn. The
  // reboost alert stops it, being drawn in the view's place. With the Gyroscopes setting a liquid on the front also
  // keeps the torque stream going.
  function animate(): void {
    let period = 0;
    if (sloshing()) period = MOTION_MS;
    else if (!alerting && view === ARRAYS_VIEW && turning !== null) period = TURN_MS;
    if (motionTimer !== undefined && period !== motionPeriod) {
      clearInterval(motionTimer);
      motionTimer = undefined;
    }
    if (period > 0 && motionTimer === undefined) {
      motionPeriod = period;
      motionTimer = setInterval(() => {
        if (view !== ARRAYS_VIEW) step(motion, value(data, MODE) === REBOOST, slosh === "random");
        redraw();
      }, period);
    }
    if (slosh === "gyros" && sloshing() && !following && retry === undefined) void follow().catch(report);
  }

  // The torque stream: one session subscribed to the gyroscopes' control torque, bound again as soon as each poll of it
  // answers, while a liquid is on the front; each answer with a change kicks the slosh by how much the torque changed,
  // all three axes together. It stops at the first answer after the liquid leaves the front; a failure starts it again
  // RETRY_MS later.
  async function follow(): Promise<void> {
    following = true;
    try {
      const session = await subscribe(TORQUE);
      // The last torque by position in the group.
      const torque: Record<number, number> = {};
      while (sloshing()) {
        const bound = await bind(session);
        // An answer that does not end in LOOP ends the session: CONERR or END.
        if (bound.indexOf("LOOP") < 0) throw new Error(`torque: ${bound.slice(0, 40)}`);
        let change = 0;
        updates(bound, (position, value) => {
          if (position in torque) change += Math.abs(value - torque[position]);
          torque[position] = value;
        });
        if (change > 0 && sloshing()) kick(motion, GYRO_GAIN * change);
      }
    } catch (err) {
      report(err);
      if (!stopped) {
        retry = setTimeout(() => {
          retry = undefined;
          animate();
        }, RETRY_MS);
      }
    }
    following = false;
  }

  // One poll at a time. A good one is kept in localStorage; a failed one leaves the last good one on the display,
  // dimmed. The first poll to find the station in Reboost sounds the alert, blinks the LED and covers the front with
  // the alert for ALERT_MS. A good poll that finds the urine tank fuller than the last one did while it is on the
  // front pours a stream into it, with its sound.
  async function poll(): Promise<void> {
    if (loading) return;
    loading = true;
    let rising = false;
    // The urine level the stream pours from: the last good poll's, lower than this one's.
    let poured: number | null = null;
    try {
      const next: Telemetry = { at: Date.now(), values: await load() };
      // A poll that is already stale brings angles frozen at the loss of signal: the arrays stop there.
      turning = stale(next) ? null : turn(data, next);
      const after = value(next, TANKS[URINE].item);
      if (lastUrine !== null && after !== null && after > lastUrine) poured = lastUrine;
      lastUrine = after;
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
    if (rising) {
      alerting = true;
      alertTimer = setTimeout(() => {
        alertTimer = undefined;
        alerting = false;
        animate();
        redraw();
      }, ALERT_MS);
    }
    if (poured !== null && view === URINE + 1 && !alerting) {
      motion.pourFrom = poured;
      motion.pourUntil = Date.now() + POUR_MS;
      kick(motion, KICK);
      void device.AudioPlay({ application_name: APP, path: "sounds/pour.snd" }).catch(report);
    }
    animate();
    if (rising) void device.AudioPlay({ application_name: APP, path: "sounds/reboost.snd" }).catch(report);
    redraw(rising ? ALERT : undefined);
  }

  // The Slosh setting, read once at the start; until it is read, and when it cannot be, the liquids are kicked at
  // random. Kicked at random, they get a first kick at once, to slosh when first shown.
  void (async () => {
    try {
      slosh = await loadSlosh();
    } catch (err) {
      report(err);
    }
    if (stopped) return;
    if (slosh === "random") kick(motion, KICK);
    animate();
  })().catch(report);

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
    if (alertTimer !== undefined) clearTimeout(alertTimer);
    if (retry !== undefined) clearTimeout(retry);

    // Not detached from inside the handler itself: with nothing else left the unbind stops the app on the spot, while this handler is still running.
    setTimeout(unbind, 0);
  });
}

main();
