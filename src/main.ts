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

const SUBTLE_WHITE = "#FFFFFFA0";
const TRACK = "#FFFFFF30";
const SEGMENT_W = 24;
const BAR_W = 2;

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

/** A tank: its label and level on the left, a bar filled to the level on the right; "--" without a level. */
function tank(i: number, level: number | null): Element[] {
  const t = TANKS[i];
  const x = i * SEGMENT_W;
  const fill = level === null ? 0 : Math.round((Math.max(0, Math.min(100, level)) * 16) / 100);
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

function frame(levels: (number | null)[]): Element[] {
  const elements: Element[] = [];
  levels.forEach((level, i) => elements.push(...tank(i, level)));
  return elements;
}

/**
 * Entry point, called at the end of the file: the device runs this script from top to bottom and starts nothing by itself.
 */
function main(): void {
  let levels: (number | null)[] = TANKS.map(() => null);
  let loading = false;
  let stopped = false;

  const report = (err: unknown) =>
    console.error(`${APP}: ${err instanceof Error ? err.message : String(err)}`);
  const screen = createScreen(APP, report);

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
    if (!stopped) screen.show(frame(levels));
  }

  screen.show(frame(levels));
  void poll();
  const timer = setInterval(() => void poll(), POLL_MS);

  // Back leaves the app. Once the timer is cleared and the handler detached, nothing keeps it alive and the device takes the screen back.
  const unbind = listen("input", (event) => {
    if (stopped || event.key !== "back" || event.action !== "short") return;

    stopped = true;
    screen.close();
    clearInterval(timer);

    // Not detached from inside the handler itself: with nothing else left the unbind stops the app on the spot, while this handler is still running.
    setTimeout(unbind, 0);
  });
}

main();
