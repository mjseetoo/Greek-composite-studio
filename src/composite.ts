/* Composite rendering engine — draws the whole chapter composite onto a canvas. */

export type Group = "Officers" | "Sweethearts" | "Brothers";

export interface Person {
  id: string;
  name: string;
  role: string;
  group: Group;
  src: string | null;
  x: number;
  y: number;
  zoom: number;
}

export type Shape = "oval" | "arch" | "rect";
export type TitleFont = "blackletter" | "fraktur" | "gothic" | "serif";
export type BrotherLayout = "ring" | "rows";

export interface StudioState {
  title: string;
  subtitle: string;
  school: string;
  year: string;
  background: string;
  accent: string;
  ink: string;
  shape: Shape;
  titleFont: TitleFont;
  titleSize: number;
  portraitSize: number;
  spacing: number;
  showRole: boolean;
  brotherLayout: BrotherLayout;
  officerEmphasis: boolean;
  removeWhite: boolean;
  threshold: number;
  crest: string | null;
  people: Person[];
}

export interface Hitbox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const GROUPS: Group[] = ["Officers", "Sweethearts", "Brothers"];

export const TITLE_FONTS: Record<TitleFont, string> = {
  blackletter: '"Catholic Blackstone", "UnifrakturMaguntia", "Old English Text MT", Georgia, serif',
  fraktur: '"UnifrakturCook", "UnifrakturMaguntia", Georgia, serif',
  gothic: '"Grenze Gotisch", "Pirata One", Georgia, serif',
  serif: "Georgia, 'Times New Roman', serif",
};

const BASE_W = 262;
const BASE_H = 312;
const MARGIN = 150;
const GAP = 46;
const BAND_H = 690;

type Slot = { p: Person; cx: number; top: number; scale: number };

interface Metrics {
  s: number;
  cardW: number;
  cardH: number;
  blockH: number;
  cellW: number;
  cellH: number;
}

function metrics(state: StudioState): Metrics {
  const s = state.portraitSize;
  const cardW = BASE_W * s;
  const cardH = BASE_H * s;
  const blockH = cardH + (state.showRole ? 120 : 74) * s;
  return {
    s,
    cardW,
    cardH,
    blockH,
    cellW: (cardW + 58 * s) * state.spacing,
    cellH: (blockH + 44 * s) * state.spacing,
  };
}

/** Split a list into balanced rows of at most `maxPerRow`. */
export function splitRows<T>(items: T[], maxPerRow: number): T[][] {
  if (!items.length) return [];
  const rows = Math.ceil(items.length / maxPerRow);
  const out: T[][] = [];
  let i = 0;
  for (let r = 0; r < rows; r++) {
    const take = Math.ceil((items.length - i) / (rows - r));
    out.push(items.slice(i, i + take));
    i += take;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* drawing primitives                                                   */
/* ------------------------------------------------------------------ */

function shapePath(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, shape: Shape) {
  c.beginPath();
  if (shape === "oval") {
    c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else if (shape === "arch") {
    c.moveTo(x, y + h);
    c.lineTo(x, y + w / 2);
    c.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
    c.lineTo(x + w, y + h);
    c.closePath();
  } else {
    c.roundRect(x, y, w, h, 20);
  }
}

function fitFont(
  c: CanvasRenderingContext2D,
  text: string,
  max: number,
  size: number,
  family: string,
  weight = "",
  style = ""
) {
  let s = size;
  for (;;) {
    c.font = `${style} ${weight} ${s}px ${family}`.replace(/\s+/g, " ").trim();
    if (c.measureText(text).width <= max || s <= 14) break;
    s -= 2;
  }
  return s;
}

function fittedText(
  c: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  max: number,
  size: number,
  color: string,
  family = "Georgia, serif",
  weight = "",
  style = ""
) {
  if (!text) return;
  fitFont(c, text, max, size, family, weight, style);
  c.fillStyle = color;
  c.textAlign = "center";
  c.fillText(text, x, y);
}

function roleLines(c: CanvasRenderingContext2D, text: string, maxWidth: number, font: string) {
  c.font = font;
  const words = text.split(/\s+/);
  const lines = [""];
  for (const word of words) {
    const last = lines.length - 1;
    const test = (lines[last] + " " + word).trim();
    if (c.measureText(test).width > maxWidth && lines[last]) lines.push(word);
    else lines[last] = test;
  }
  return lines.slice(0, 2);
}

function drawFit(
  c: CanvasRenderingContext2D,
  img: CanvasImageSource & { width: number; height: number },
  x: number,
  y: number,
  w: number,
  h: number,
  p: Person
) {
  const ratio = Math.max(w / img.width, h / img.height) * (p.zoom || 1);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  const dx = Math.max(0, (dw - w) / 2);
  const dy = Math.max(0, (dh - h) / 2);
  c.drawImage(img, x + (w - dw) / 2 + (p.x || 0) * dx, y + (h - dh) / 2 + (p.y || 0) * dy, dw, dh);
}

function star(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const rr = i % 2 ? r * 0.38 : r;
    c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  c.closePath();
  c.fillStyle = color;
  c.fill();
}

function drawCard(
  c: CanvasRenderingContext2D,
  state: StudioState,
  slot: Slot,
  img: (CanvasImageSource & { width: number; height: number }) | null,
  selected: string | null,
  hitboxes: Hitbox[]
) {
  const { p, cx, top, scale } = slot;
  const w = BASE_W * scale;
  const h = BASE_H * scale;
  const x = cx - w / 2;
  const y = top;
  hitboxes.push({ id: p.id, x, y, w, h });

  c.save();
  shapePath(c, x, y, w, h, state.shape);
  c.fillStyle = "#6e6870";
  c.fill();
  c.clip();
  if (img) {
    drawFit(c, img, x, y, w, h, p);
  } else {
    c.fillStyle = "#716478";
    c.fillRect(x, y, w, h);
    c.fillStyle = "#c1b1c8";
    c.textAlign = "center";
    c.font = `${Math.round(45 * scale)}px Georgia, serif`;
    c.fillText("＋", cx, y + h / 2 + 15);
  }
  c.restore();

  shapePath(c, x, y, w, h, state.shape);
  c.strokeStyle = state.accent;
  c.lineWidth = p.id === selected ? 8 : 5;
  c.stroke();
  if (p.id === selected) {
    c.strokeStyle = "#ffffff";
    c.lineWidth = 2;
    shapePath(c, x - 7, y - 7, w + 14, h + 14, state.shape);
    c.stroke();
  }

  const plateY = y + h + 9 * scale;
  const plateW = (BASE_W + 9) * scale;
  c.beginPath();
  c.roundRect(cx - plateW / 2, plateY, plateW, 38 * scale, 3 * scale);
  c.fillStyle = state.ink;
  c.fill();
  fittedText(
    c,
    p.name || "Name",
    cx,
    plateY + 27 * scale,
    plateW - 14 * scale,
    25 * scale,
    state.background,
    "Georgia, serif",
    "700"
  );

  if (state.showRole && p.role) {
    const font = `${22 * scale}px Arial, Helvetica, sans-serif`;
    const lines = roleLines(c, p.role, 255 * scale, font);
    c.font = font;
    c.fillStyle = state.accent;
    c.textAlign = "center";
    lines.forEach((line, i) => c.fillText(line, cx, plateY + 68 * scale + i * 24 * scale));
  }
}

/* ------------------------------------------------------------------ */
/* layout                                                               */
/* ------------------------------------------------------------------ */

interface CenterGroup {
  rows: Person[][];
  scale: number;
  cellW: number;
  cellH: number;
}

interface Layout {
  W: number;
  H: number;
  slots: Slot[];
  band: { cx: number; top: number; width: number; height: number };
}

function buildCenterGroups(state: StudioState, m: Metrics, overflow: Person[]): {
  header: CenterGroup | null;
  after: CenterGroup[];
} {
  const officers = state.people.filter((p) => p.group === "Officers");
  const sweet = state.people.filter((p) => p.group === "Sweethearts");
  const offScale = m.s * (state.officerEmphasis ? 1.14 : 1);
  const sweetScale = m.s * 0.98;

  const mk = (list: Person[], perRow: number, scale: number): CenterGroup | null => {
    if (!list.length) return null;
    const k = scale / m.s;
    return { rows: splitRows(list, perRow), scale, cellW: m.cellW * k, cellH: m.cellH * k };
  };

  const header = mk(officers, 10, offScale);
  const after = [mk(sweet, 6, sweetScale)].filter(Boolean) as CenterGroup[];
  const extra = mk(overflow, 9, m.s);
  if (extra) after.push(extra);
  return { header, after };
}

function groupHeight(g: CenterGroup) {
  return g.rows.length * g.cellH;
}

function groupWidth(g: CenterGroup) {
  return Math.max(...g.rows.map((r) => r.length)) * g.cellW;
}

export function computeLayout(state: StudioState): Layout {
  const m = metrics(state);
  const ringMode = state.brotherLayout === "ring";
  const allBrothers = state.people.filter((p) => p.group === "Brothers");

  /* brothers that do not fit on the surrounding ring fall back into centre rows */
  let overflow: Person[] = ringMode ? [] : allBrothers;
  let pass = 0;
  let plan = planFrame(state, m, ringMode ? allBrothers : [], overflow);
  while (ringMode && pass++ < 4 && plan.overflow.length !== overflow.length) {
    overflow = plan.overflow;
    plan = planFrame(state, m, allBrothers, overflow);
  }
  return buildSlots(m, plan);
}

interface Plan {
  W: number;
  H: number;
  edge: { top: number; bottom: number; left: number; right: number };
  ring: Person[];
  overflow: Person[];
  header: CenterGroup | null;
  headerH: number;
  after: CenterGroup[];
  bandH: number;
  centerH: number;
}

function planFrame(state: StudioState, m: Metrics, brothers: Person[], overflow: Person[]): Plan {
  const { header, after } = buildCenterGroups(state, m, overflow);
  const groups = [...after];
  /* the exec board sits in its own header band across the very top */
  const headerH = header ? groupHeight(header) + GAP * 2 : 0;
  const headerW = header ? groupWidth(header) : 0;

  const bandH = BAND_H * (0.85 + 0.15 * m.s);
  let centerH = bandH;
  let centerW = 2450;
  for (const g of groups) {
    centerH += groupHeight(g) + GAP;
    centerW = Math.max(centerW, groupWidth(g));
  }

  const minW = Math.max(MARGIN * 2 + 2 * m.cellW + 2 * GAP + centerW, MARGIN * 2 + headerW);
  const minH = MARGIN * 2 + 2 * m.blockH + 2 * GAP + centerH; // height of the region below the header
  const ring = brothers.filter((p) => !overflow.includes(p));
  const N = ring.length + (state.brotherLayout === "ring" ? overflow.length : 0);

  const edge = { top: 0, bottom: 0, left: 0, right: 0 };
  let W = Math.max(3200, minW);
  let H = Math.max(2150, minH + headerH);

  if (state.brotherLayout === "ring" && N > 0) {
    W = Math.max(minW, (minH + headerH) * 1.3);
    H = minH; // ring region height (header is added at the end)
    const capRow = () => Math.floor((W - 2 * MARGIN - m.cellW) / m.cellW) + 1;
    const capCol = () => Math.max(0, Math.floor((H - 2 * MARGIN - m.blockH) / m.cellH) - 1);
    const capacity = () => 2 * capRow() + 2 * capCol();

    /* grow the frame — but only so far; the rest of the chapter goes inside */
    const limitW = W * 1.6;
    let guard = 0;
    while (capacity() < N && W < limitW && guard++ < 400) {
      W *= 1.02;
      H *= 1.02;
    }

    const fit = Math.min(N, capacity());
    const maxRow = capRow();
    const maxCol = capCol();
    const pw = W - 2 * MARGIN - m.cellW;
    const pv = H - 2 * MARGIN - m.blockH;

    const across = Math.min(maxRow, Math.max(0, Math.round((fit * pw) / (2 * (pw + pv)))));
    edge.top = across;
    edge.bottom = across;
    const side = Math.min(maxCol, Math.max(0, Math.floor((fit - 2 * across) / 2)));
    edge.left = side;
    edge.right = side;

    const caps = { top: maxRow, bottom: maxRow, left: maxCol, right: maxCol };
    const keys = ["bottom", "right", "top", "left"] as const;
    let remaining = fit - (edge.top + edge.bottom + edge.left + edge.right);
    while (remaining > 0) {
      const k = keys
        .filter((x) => edge[x] < caps[x])
        .sort((a, b) => edge[a] / (caps[a] || 1) - edge[b] / (caps[b] || 1))[0];
      if (!k) break;
      edge[k]++;
      remaining--;
    }
    while (remaining < 0) {
      const k = keys.slice().sort((a, b) => edge[b] - edge[a])[0];
      edge[k]--;
      remaining++;
    }

    const placed = edge.top + edge.bottom + edge.left + edge.right;
    const ordered = brothers;
    return {
      W,
      H: H + headerH,
      edge,
      ring: ordered.slice(0, placed),
      overflow: ordered.slice(placed),
      header,
      headerH,
      after,
      bandH,
      centerH,
    };
  }

  return { W, H, edge, ring: [], overflow, header, headerH, after, bandH, centerH };
}

function buildSlots(m: Metrics, plan: Plan): Layout {
  const { W, H, edge, ring, header, headerH, after, bandH, centerH } = plan;
  const slots: Slot[] = [];
  let innerLeft = MARGIN + 80;
  let innerRight = W - MARGIN - 80;
  let innerTop = MARGIN + headerH + 60;
  let innerBottom = H - MARGIN - 60;

  if (ring.length) {
    const cxLeft = MARGIN + m.cellW / 2;
    const cxRight = W - MARGIN - m.cellW / 2;
    const topY = MARGIN + headerH;
    const bottomY = H - MARGIN - m.blockH;

    const rowXs = (count: number) => {
      if (count <= 0) return [];
      if (count === 1) return [W / 2];
      return Array.from({ length: count }, (_, i) => cxLeft + ((cxRight - cxLeft) * i) / (count - 1));
    };
    const topXs = rowXs(edge.top);
    const bottomXs = rowXs(edge.bottom);
    const colY = (count: number, j: number) => {
      const a = topY + m.blockH + GAP;
      const b = bottomY - GAP;
      return a + ((b - a) * (j + 1)) / (count + 1) - m.blockH / 2;
    };

    let k = 0;
    const next = () => ring[k++];
    /* clockwise, starting at the upper-left corner */
    for (let i = 0; i < edge.top; i++) slots.push({ p: next(), cx: topXs[i], top: topY, scale: m.s });
    for (let j = 0; j < edge.right; j++) slots.push({ p: next(), cx: cxRight, top: colY(edge.right, j), scale: m.s });
    for (let i = edge.bottom - 1; i >= 0; i--) slots.push({ p: next(), cx: bottomXs[i], top: bottomY, scale: m.s });
    for (let j = edge.left - 1; j >= 0; j--) slots.push({ p: next(), cx: cxLeft, top: colY(edge.left, j), scale: m.s });

    innerLeft = MARGIN + m.cellW + GAP;
    innerRight = W - MARGIN - m.cellW - GAP;
    innerTop = topY + m.blockH + GAP;
    innerBottom = bottomY - GAP;
  }

  const cx = W / 2;
  const groupCount = after.length + 1;
  const slack = Math.max(0, innerBottom - innerTop - (centerH - GAP));
  const extra = Math.min(slack / (groupCount + 2), 150);
  /* whatever slack is left over keeps the centre block vertically centred */
  let y = innerTop + extra + Math.max(0, slack - extra * (groupCount + 2)) / 2;

  const placeGroup = (g: CenterGroup) => {
    for (const row of g.rows) {
      const width = (row.length - 1) * g.cellW;
      row.forEach((p, i) => slots.push({ p, cx: cx - width / 2 + i * g.cellW, top: y, scale: g.scale }));
      y += g.cellH;
    }
    y += GAP + extra;
  };

  const band = { cx, top: y, width: Math.min(innerRight - innerLeft, 2900), height: bandH };
  y += bandH + GAP + extra;
  for (const g of after) placeGroup(g);

  /* exec board across the top */
  if (header) {
    let hy = MARGIN;
    for (const row of header.rows) {
      const width = (row.length - 1) * header.cellW;
      row.forEach((p, i) => slots.push({ p, cx: cx - width / 2 + i * header.cellW, top: hy, scale: header.scale }));
      hy += header.cellH;
    }
  }

  return { W, H, slots, band };
}

/* ------------------------------------------------------------------ */
/* render                                                               */
/* ------------------------------------------------------------------ */

function drawBand(
  c: CanvasRenderingContext2D,
  state: StudioState,
  band: Layout["band"],
  crest: (CanvasImageSource & { width: number; height: number }) | null
) {
  const { cx, top, width, height } = band;
  const family = TITLE_FONTS[state.titleFont] || TITLE_FONTS.serif;
  const titleSize = 168 * state.titleSize;

  c.textAlign = "center";
  const titleY = top + titleSize * 0.82;
  fittedText(c, state.title || "Chapter Name", cx, titleY, width, titleSize, state.accent, family);

  let y = titleY + 26;
  if (state.subtitle) {
    y += 46;
    fittedText(c, state.subtitle.toUpperCase(), cx, y, width * 0.8, 40, state.ink, "Georgia, serif", "", "italic");
  }
  if (state.school) {
    y += 76;
    fittedText(c, state.school.toUpperCase(), cx, y, width * 0.92, 62, state.accent, "Georgia, serif", "700");
  }

  /* rule with diamonds */
  y += 40;
  c.strokeStyle = state.accent;
  c.globalAlpha = 0.65;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(cx - width * 0.33, y);
  c.lineTo(cx - 30, y);
  c.moveTo(cx + 30, y);
  c.lineTo(cx + width * 0.33, y);
  c.stroke();
  c.globalAlpha = 1;
  star(c, cx, y, 13, state.accent);

  const crestCY = Math.min(top + height - 150, y + 175);
  const parts = (state.year || "").split(/\s*[–—-]\s*/);
  const left = parts.length >= 2 ? parts[0] : state.year;
  const right = parts.length >= 2 ? parts.slice(1).join(" – ") : "";
  fittedText(c, left || "", cx - 420, crestCY + 22, 380, 62, state.accent, "Georgia, serif", "700");
  if (right) fittedText(c, right, cx + 420, crestCY + 22, 380, 62, state.accent, "Georgia, serif", "700");

  if (crest) {
    const ratio = Math.min(300 / crest.width, 300 / crest.height);
    const w = crest.width * ratio;
    const h = crest.height * ratio;
    c.drawImage(crest, cx - w / 2, crestCY - h / 2, w, h);
  } else {
    c.beginPath();
    c.arc(cx, crestCY, 125, 0, Math.PI * 2);
    c.strokeStyle = state.accent;
    c.lineWidth = 5;
    c.stroke();
    fittedText(c, "CREST", cx, crestCY + 12, 200, 38, state.accent, "Georgia, serif", "700");
  }
}

export function renderComposite(
  canvas: HTMLCanvasElement,
  state: StudioState,
  images: Map<string, HTMLImageElement>,
  crest: (CanvasImageSource & { width: number; height: number }) | null,
  selected: string | null
): Hitbox[] {
  const layout = computeLayout(state);
  canvas.width = Math.round(layout.W);
  canvas.height = Math.round(layout.H);
  const c = canvas.getContext("2d")!;
  const hitboxes: Hitbox[] = [];

  /* backdrop */
  c.fillStyle = state.background;
  c.fillRect(0, 0, layout.W, layout.H);
  c.strokeStyle = state.accent;
  c.globalAlpha = 0.58;
  c.lineWidth = 5;
  c.strokeRect(49, 49, layout.W - 98, layout.H - 98);
  c.lineWidth = 2;
  c.strokeRect(67, 67, layout.W - 134, layout.H - 134);
  c.globalAlpha = 1;
  for (const x of [93, layout.W - 93]) for (const y of [93, layout.H - 93]) star(c, x, y, 13, state.accent);

  drawBand(c, state, layout.band, crest);
  for (const slot of layout.slots) drawCard(c, state, slot, images.get(slot.p.id) || null, selected, hitboxes);

  return hitboxes;
}
