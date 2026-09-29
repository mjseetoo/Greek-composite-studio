import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./fonts/fonts.css";
import "@fontsource/grenze-gotisch/latin-400.css";
import "@fontsource/pirata-one/latin-400.css";
import "./studio.css";
import {
  GROUPS,
  renderComposite,
  type BrotherLayout,
  type Group,
  type Hitbox,
  type Person,
  type Shape,
  type StudioState,
  type TitleFont,
} from "./composite";

/* ----------------------------------------------------------------- */
/* helpers                                                             */
/* ----------------------------------------------------------------- */

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());

const makePerson = (name = "", role = "", group: Group = "Brothers", src: string | null = null): Person => ({
  id: uid(),
  name,
  role,
  group,
  src,
  x: 0,
  y: 0,
  zoom: 1,
});

const readFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const imageFromData = (data: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = data;
  });

const ROSTER: Record<Group, [string, string][]> = {
  Officers: [

  ],
  Sweethearts: [

  ],
  Brothers: (
    [

    ] as string[]
  ).map((n) => [n, ""] as [string, string]),
};

const INITIAL: StudioState = {
  title: "Delta Tau Delta",
  subtitle: "Kappa Iota Chapter",
  school: "East Carolina University",
  year: "2025 – 2026",
  background: "#422950",
  accent: "#e1bb65",
  ink: "#fff7df",
  shape: "oval",
  titleFont: "blackletter",
  titleSize: 1,
  portraitSize: 1,
  spacing: 1,
  showRole: true,
  brotherLayout: "ring",
  officerEmphasis: true,
  removeWhite: true,
  threshold: 35,
  crest: null,
  people: [],
};

/** Flood fill near-white pixels from the edges and make them transparent. */
function stripWhite(img: HTMLImageElement, limit: number) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.drawImage(img, 0, 0);
  const data = x.getImageData(0, 0, c.width, c.height);
  const a = data.data;
  const w = c.width;
  const h = c.height;
  const seen = new Uint8Array(w * h);
  const q = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const near = (i: number) => {
    const z = i * 4;
    return a[z] > 255 - limit && a[z + 1] > 255 - limit && a[z + 2] > 255 - limit;
  };
  const push = (i: number) => {
    if (!seen[i] && near(i)) {
      seen[i] = 1;
      q[tail++] = i;
    }
  };
  for (let xx = 0; xx < w; xx++) {
    push(xx);
    push((h - 1) * w + xx);
  }
  for (let yy = 0; yy < h; yy++) {
    push(yy * w);
    push(yy * w + w - 1);
  }
  while (head < tail) {
    const i = q[head++];
    const xx = i % w;
    const yy = (i / w) | 0;
    if (xx) push(i - 1);
    if (xx < w - 1) push(i + 1);
    if (yy) push(i - w);
    if (yy < h - 1) push(i + w);
  }
  for (let i = 0; i < w * h; i++) if (seen[i]) a[i * 4 + 3] = 0;
  x.putImageData(data, 0, 0);
  return c;
}

/* ----------------------------------------------------------------- */
/* app                                                                 */
/* ----------------------------------------------------------------- */

export default function App() {
  const [state, setState] = useState<StudioState>(INITIAL);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"people" | "design" | "project">("people");
  const [status, setStatus] = useState("");
  const [uploadGroup, setUploadGroup] = useState<Group>("Brothers");
  const [rosterText, setRosterText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [tick, setTick] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesRef = useRef(new Map<string, HTMLImageElement>());
  const crestSrcRef = useRef<HTMLImageElement | null>(null);
  const crestRef = useRef<HTMLCanvasElement | HTMLImageElement | null>(null);
  const hitRef = useRef<Hitbox[]>([]);
  const dragRef = useRef<{ p: Person; box: Hitbox; sx: number; sy: number; x: number; y: number } | null>(null);
  const statusTimer = useRef<number | undefined>(undefined);

  const bump = () => setTick((t) => t + 1);
  const notify = useCallback((s: string) => {
    setStatus(s);
    window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatus(""), 4000);
  }, []);

  const update = useCallback(<K extends keyof StudioState>(key: K, value: StudioState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  }, []);

  const patchPerson = useCallback((id: string, patch: Partial<Person>) => {
    setState((s) => ({ ...s, people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  }, []);

  const current = useMemo(() => state.people.find((p) => p.id === selected) || null, [state.people, selected]);

  /* fonts – re-render once the blackletter webfonts are available */
  useEffect(() => {
    const families = [
      '168px "UnifrakturMaguntia"',
      '168px "UnifrakturCook"',
      '168px "Grenze Gotisch"',
      '168px "Pirata One"',
    ];
    Promise.all(families.map((f) => document.fonts.load(f).catch(() => null)))
      .then(() => document.fonts.ready)
      .then(() => bump())
      .catch(() => undefined);
  }, []);

  /* crest preparation */
  const prepareCrest = useCallback((img: HTMLImageElement | null, remove: boolean, threshold: number) => {
    if (!img) {
      crestRef.current = null;
      bump();
      return;
    }
    crestRef.current = remove ? stripWhite(img, threshold) : img;
    bump();
  }, []);

  useEffect(() => {
    if (crestSrcRef.current) prepareCrest(crestSrcRef.current, state.removeWhite, state.threshold);
  }, [state.removeWhite, state.threshold, prepareCrest]);

  /* main render loop */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    hitRef.current = renderComposite(canvas, state, imagesRef.current, crestRef.current as never, selected);
  }, [state, selected, tick]);

  /* ---------------- people ---------------- */

  const addFiles = async (files: File[]) => {
    const added: Person[] = [];
    for (const f of files) {
      if (!f.type.startsWith("image/")) continue;
      const src = await readFile(f);
      const name = f.name
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .replace(/^(IMG|DSC)\s*\d+$/i, "")
        .trim();
      const p = makePerson(name, "", uploadGroup, src);
      try {
        imagesRef.current.set(p.id, await imageFromData(src));
      } catch {
        /* ignore */
      }
      added.push(p);
    }
    if (!added.length) return;
    setState((s) => ({ ...s, people: [...s.people, ...added] }));
    setSelected(added[added.length - 1].id);
    notify(`${added.length} portrait${added.length === 1 ? "" : "s"} added`);
  };

  const replaceImage = async (file: File) => {
    if (!current) return;
    const src = await readFile(file);
    try {
      imagesRef.current.set(current.id, await imageFromData(src));
    } catch {
      /* ignore */
    }
    patchPerson(current.id, { src, x: 0, y: 0, zoom: 1 });
  };

  const move = (p: Person, delta: number) => {
    setState((s) => {
      const peers = s.people.filter((x) => x.group === p.group);
      const idx = peers.indexOf(peers.find((x) => x.id === p.id)!);
      const other = peers[idx + delta];
      if (!other) return s;
      const people = [...s.people];
      const a = people.findIndex((x) => x.id === p.id);
      const b = people.findIndex((x) => x.id === other.id);
      [people[a], people[b]] = [people[b], people[a]];
      return { ...s, people };
    });
  };

  const loadRoster = () => {
    if (state.people.length && !confirm("Add the 31 roster names to your existing people?")) return;
    const people = [...state.people];
    for (const g of GROUPS) for (const [n, r] of ROSTER[g]) people.push(makePerson(n, r, g));
    setState((s) => ({ ...s, people }));
    notify("31 editable roster entries added");
  };

  const importNames = () => {
    const rows = rosterText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const people = [...state.people];
    for (const row of rows) {
      const [name = "", role = "", g = ""] = row.split("|").map((s) => s.trim());
      if (name)
        people.push(makePerson(name, role, GROUPS.find((x) => x.toLowerCase() === g.toLowerCase()) || "Brothers"));
    }
    setState((s) => ({ ...s, people }));
    setRosterText("");
    notify(`${rows.length} names added`);
  };

  /* ---------------- canvas interaction ---------------- */

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * canvas.width) / r.width,
      y: ((e.clientY - r.top) * canvas.height) / r.height,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = point(e);
    const box = [...hitRef.current].reverse().find((b) => pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h);
    if (!box) {
      dragRef.current = null;
      return;
    }
    const p = state.people.find((x) => x.id === box.id)!;
    setSelected(box.id);
    dragRef.current = { p, box, sx: pos.x, sy: pos.y, x: p.x, y: p.y };
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const pos = point(e);
    const nx = Math.max(-1, Math.min(1, d.x + (2 * (pos.x - d.sx)) / d.box.w));
    const ny = Math.max(-1, Math.min(1, d.y + (2 * (pos.y - d.sy)) / d.box.h));
    patchPerson(d.p.id, { x: nx, y: ny });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!current) return;
    const box = hitRef.current.find((b) => b.id === current.id);
    if (!box) return;
    const zoom = Math.max(1, Math.min(3, current.zoom + (e.deltaY < 0 ? 0.05 : -0.05)));
    patchPerson(current.id, { zoom });
  };

  /* ---------------- export ---------------- */

  const download = (blob: Blob, name: string) => {
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const exportPng = () =>
    canvasRef.current?.toBlob((b) => (b ? download(b, "Chapter-Composite.png") : notify("Could not export PNG")), "image/png");

  const printPdf = () => {
    const url = canvasRef.current?.toDataURL("image/png");
    const w = window.open("", "_blank");
    if (!w || !url) {
      notify("Allow pop-ups to print the composite");
      return;
    }
    w.document.write(
      '<!doctype html><title>Print composite</title><style>@page{size:landscape;margin:0}body{margin:0}img{display:block;width:100%;height:auto}</style><img src="' +
        url +
        '" onload="setTimeout(()=>print(),400)">'
    );
    w.document.close();
  };

  const saveProject = () =>
    download(
      new Blob([JSON.stringify({ format: "composite-studio-v2", state }, null, 2)], { type: "application/json" }),
      "Composite-Project.json"
    );

  const openProject = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!data?.state || !Array.isArray(data.state.people)) throw new Error("Not a Composite Studio project");
      const next: StudioState = { ...INITIAL, ...data.state };
      imagesRef.current = new Map();
      for (const p of next.people) {
        if (!p.src) continue;
        try {
          imagesRef.current.set(p.id, await imageFromData(p.src));
        } catch {
          /* ignore */
        }
      }
      crestSrcRef.current = next.crest ? await imageFromData(next.crest).catch(() => null) : null;
      setSelected(null);
      setState(next);
      prepareCrest(crestSrcRef.current, next.removeWhite, next.threshold);
      notify("Project opened");
    } catch (err) {
      notify((err as Error).message);
    }
  };

  /* ---------------- render ---------------- */

  const counts = GROUPS.map((g) => ({ g, list: state.people.filter((p) => p.group === g) }));

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">D</div>
          <h1>Composite Studio</h1>
        </div>
        <div className="subtle">Build and export a chapter composite. Images stay on this device while you edit.</div>

        <div className="tabs">
          {(["people", "design", "project"] as const).map((t) => (
            <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* ---------------- PEOPLE ---------------- */}
        <div className={"panel" + (tab === "people" ? " active" : "")}>
          <div className="section first">
            <h2>Add portraits</h2>
            <label
              className={"upload" + (dragOver ? " drag" : "")}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void addFiles([...e.dataTransfer.files]);
              }}
            >
              Drop images here or click to select
              <br />
              Multiple portraits are supported
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  void addFiles([...(e.target.files || [])]);
                  e.target.value = "";
                }}
              />
            </label>
            <label className="field">
              <span>Add uploads to</span>
              <select value={uploadGroup} onChange={(e) => setUploadGroup(e.target.value as Group)}>
                {GROUPS.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <div className="actions">
              <button
                className="button"
                onClick={() => {
                  const p = makePerson("", "", uploadGroup);
                  setState((s) => ({ ...s, people: [...s.people, p] }));
                  setSelected(p.id);
                }}
              >
                + Add person
              </button>
              <button className="button ghost" onClick={loadRoster}>
                Load DTD name roster
              </button>
            </div>
            <p className="subtle">
              Brothers are placed around the outside of the composite, officers and sweethearts sit inside with the
              crest.
            </p>
          </div>

          <div className="section">
            <h2>Portrait list</h2>
            <div>
              {counts.map(({ g, list }) => (
                <div key={g}>
                  <div className="group-title">
                    <span>{g}</span>
                    <span>{list.length}</span>
                  </div>
                  <div className="members">
                    {list.length === 0 && <div className="empty-state">No one here yet.</div>}
                    {list.map((p) => (
                      <div
                        key={p.id}
                        className={"member" + (p.id === selected ? " selected" : "")}
                        onClick={() => setSelected(p.id)}
                      >
                        {p.src ? <img src={p.src} alt="" /> : <div className="empty">+</div>}
                        <div className="info">
                          <strong>{p.name || "Untitled person"}</strong>
                          <small>{p.role || "No role"}</small>
                        </div>
                        <button
                          className="tiny"
                          title="Move earlier"
                          onClick={(e) => {
                            e.stopPropagation();
                            move(p, -1);
                          }}
                        >
                          ↑
                        </button>
                        <button
                          className="tiny"
                          title="Move later"
                          onClick={(e) => {
                            e.stopPropagation();
                            move(p, 1);
                          }}
                        >
                          ↓
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="section">
            <h2>Selected portrait</h2>
            {!current && <div className="empty-state">Select a person from the list or click a portrait in the preview.</div>}
            {current && (
              <div>
                <label className="field">
                  <span>Name</span>
                  <input
                    type="text"
                    value={current.name}
                    placeholder="First Last"
                    onChange={(e) => patchPerson(current.id, { name: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Role (optional)</span>
                  <input
                    type="text"
                    value={current.role}
                    placeholder="e.g. President"
                    onChange={(e) => patchPerson(current.id, { role: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Section</span>
                  <select value={current.group} onChange={(e) => patchPerson(current.id, { group: e.target.value as Group })}>
                    {GROUPS.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
                <div className="actions">
                  <label className="button filelabel">
                    Replace portrait
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void replaceImage(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button className="button ghost" onClick={() => patchPerson(current.id, { x: 0, y: 0, zoom: 1 })}>
                    Reset crop
                  </button>
                </div>
                <label className="field">
                  <span>
                    Zoom <output>{Math.round(current.zoom * 100)}%</output>
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={current.zoom}
                    onChange={(e) => patchPerson(current.id, { zoom: +e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Horizontal position</span>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.01}
                    value={current.x}
                    onChange={(e) => patchPerson(current.id, { x: +e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Vertical position</span>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.01}
                    value={current.y}
                    onChange={(e) => patchPerson(current.id, { y: +e.target.value })}
                  />
                </label>
                <div className="actions">
                  <button
                    className="button danger ghost"
                    onClick={() => {
                      setState((s) => ({ ...s, people: s.people.filter((p) => p.id !== current.id) }));
                      setSelected(null);
                    }}
                  >
                    Remove person
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ---------------- DESIGN ---------------- */}
        <div className={"panel" + (tab === "design" ? " active" : "")}>
          <div className="section first">
            <h2>Chapter details</h2>
            {([
              ["title", "Chapter / organization"],
              ["subtitle", "Chapter subtitle"],
              ["school", "School"],
              ["year", "Year"],
            ] as const).map(([k, label]) => (
              <label className="field" key={k}>
                <span>{label}</span>
                <input type="text" value={state[k]} onChange={(e) => update(k, e.target.value)} />
              </label>
            ))}
          </div>

          <div className="section">
            <h2>Title lettering</h2>
            <div className="preview-font">{state.title || "Delta Tau Delta"}</div>
            <label className="field">
              <span>Headline typeface</span>
              <select value={state.titleFont} onChange={(e) => update("titleFont", e.target.value as TitleFont)}>
                <option value="blackletter">Catholic Blackstone (blackletter)</option>
                <option value="fraktur">Fraktur calligraphic</option>
                <option value="gothic">Gothic condensed</option>
                <option value="serif">Classic serif</option>
              </select>
            </label>
            <label className="field">
              <span>
                Headline size <output>{Math.round(state.titleSize * 100)}%</output>
              </span>
              <input
                type="range"
                min={0.6}
                max={1.4}
                step={0.01}
                value={state.titleSize}
                onChange={(e) => update("titleSize", +e.target.value)}
              />
            </label>
            <p className="subtle">
              The headline is drawn in a Catholic Blackstone style blackletter — the same ornate gothic lettering used
              on traditional fraternity composites.
            </p>
          </div>

          <div className="section">
            <h2>Crest</h2>
            <label className="button filelabel">
              Upload crest image
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const src = await readFile(f);
                    crestSrcRef.current = await imageFromData(src).catch(() => null);
                    update("crest", src);
                    prepareCrest(crestSrcRef.current, state.removeWhite, state.threshold);
                  }
                  e.target.value = "";
                }}
              />
            </label>
            <label className="check">
              <input type="checkbox" checked={state.removeWhite} onChange={(e) => update("removeWhite", e.target.checked)} />
              Remove white backdrop around crest
            </label>
            <label className="field">
              <span>
                Backdrop removal threshold <output>{state.threshold}</output>
              </span>
              <input
                type="range"
                min={5}
                max={85}
                value={state.threshold}
                onChange={(e) => update("threshold", +e.target.value)}
              />
            </label>
            <div className="actions">
              <button
                className="button ghost"
                onClick={() => {
                  crestSrcRef.current = null;
                  crestRef.current = null;
                  update("crest", null);
                }}
              >
                Remove crest
              </button>
            </div>
          </div>

          <div className="section">
            <h2>Layout</h2>
            <label className="field">
              <span>Brothers placement</span>
              <select value={state.brotherLayout} onChange={(e) => update("brotherLayout", e.target.value as BrotherLayout)}>
                <option value="ring">Surrounding the composite (traditional)</option>
                <option value="rows">Stacked rows below the crest</option>
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={state.officerEmphasis}
                onChange={(e) => update("officerEmphasis", e.target.checked)}
              />
              Enlarge officer portraits
            </label>
            <label className="check">
              <input type="checkbox" checked={state.showRole} onChange={(e) => update("showRole", e.target.checked)} />
              Show roles below names
            </label>
          </div>

          <div className="section">
            <h2>Appearance</h2>
            <div className="row">
              {([
                ["background", "Background"],
                ["accent", "Accent"],
                ["ink", "Text"],
              ] as const).map(([k, label]) => (
                <label className="field" key={k}>
                  <span>{label}</span>
                  <input type="color" value={state[k]} onChange={(e) => update(k, e.target.value)} />
                </label>
              ))}
            </div>
            <label className="field">
              <span>Portrait shape</span>
              <select value={state.shape} onChange={(e) => update("shape", e.target.value as Shape)}>
                <option value="oval">Oval (reference style)</option>
                <option value="arch">Arched</option>
                <option value="rect">Rounded rectangle</option>
              </select>
            </label>
            <label className="field">
              <span>
                Portrait size <output>{Math.round(state.portraitSize * 100)}%</output>
              </span>
              <input
                type="range"
                min={0.8}
                max={1.2}
                step={0.01}
                value={state.portraitSize}
                onChange={(e) => update("portraitSize", +e.target.value)}
              />
            </label>
            <label className="field">
              <span>
                Spacing <output>{Math.round(state.spacing * 100)}%</output>
              </span>
              <input
                type="range"
                min={0.7}
                max={1.5}
                step={0.01}
                value={state.spacing}
                onChange={(e) => update("spacing", +e.target.value)}
              />
            </label>
          </div>
        </div>

        {/* ---------------- PROJECT ---------------- */}
        <div className={"panel" + (tab === "project" ? " active" : "")}>
          <div className="section first">
            <h2>Export composite</h2>
            <div className="actions">
              <button className="button gold" onClick={exportPng}>
                Download high-resolution PNG
              </button>
              <button className="button" onClick={printPdf}>
                Print / Save as PDF
              </button>
            </div>
            <p className="subtle">
              PNG export uses the full resolution canvas. For PDF, choose “Save as PDF” in the print dialog and set
              landscape orientation.
            </p>
          </div>

          <div className="section">
            <h2>Keep editing later</h2>
            <div className="actions">
              <button className="button" onClick={saveProject}>
                Save editable project
              </button>
              <label className="button filelabel">
                Open project
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void openProject(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <p className="subtle">The project file includes names, layout settings, and uploaded images.</p>
          </div>

          <div className="section">
            <h2>Quick names import</h2>
            <p className="subtle">
              One person per line: <b>Name | Role | Section</b>. Section can be Officers, Sweethearts, or Brothers.
            </p>
            <label className="field">
              <span>Paste roster</span>
              <textarea
                value={rosterText}
                placeholder={"Wyatt Davis | President | Officers\nAubrie Dolan | | Sweethearts\nSam Adams | | Brothers"}
                onChange={(e) => setRosterText(e.target.value)}
              />
            </label>
            <button className="button" onClick={importNames}>
              Add names
            </button>
          </div>

          <div className="section">
            <h2>Starting over</h2>
            <button
              className="button danger ghost"
              onClick={() => {
                if (!confirm("Remove all people and the crest from this project?")) return;
                imagesRef.current = new Map();
                crestSrcRef.current = null;
                crestRef.current = null;
                setSelected(null);
                setState((s) => ({ ...s, people: [], crest: null }));
              }}
            >
              Clear people and crest
            </button>
          </div>
        </div>

        <div className="footer">Composite Studio · runs locally in your browser</div>
      </aside>

      <main className="work">
        <div className="topbar">
          <div>
            <h2>Live composite preview</h2>
            <p>
              {state.people.length} portrait{state.people.length === 1 ? "" : "s"} ·{" "}
              {state.brotherLayout === "ring" ? "brothers surrounding" : "brothers in rows"}
            </p>
          </div>
          <div className="actions">
            <span className="pill">Landscape · high resolution</span>
            <button className="button gold" onClick={exportPng}>
              Export PNG
            </button>
          </div>
        </div>
        <div className="canvas-wrap">
          <canvas
            ref={canvasRef}
            aria-label="Composite preview"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onWheel={onWheel}
          />
        </div>
        <p className="hint">
          Click a portrait to edit it. Drag inside the selected portrait to reposition its crop, scroll to zoom. Use the
          arrows in the list to move people around the ring.
        </p>
        <div className="status" role="status">
          {status}
        </div>
      </main>
    </div>
  );
}
