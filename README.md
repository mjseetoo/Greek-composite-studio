# Composite Studio

**Build a chapter composite in your browser. One file. No install. No uploads.**

Composite Studio is a self-contained HTML app for making the classic fraternity-style chapter composite: blackletter title, oval portraits, officers and sweethearts up front, brothers surrounding the crest. Drop in photos, tweak the layout, and export a print-ready image.

---

## Α · Quick Start

1. Download the **Greek-composite-studio** as a zip file.
2. Unzip the folder
3. Double-click **Composite studio**. It opens in your browser.
4. That's the whole setup.

It works offline, and nothing leaves your device. Your photos are never uploaded anywhere.

> **Heads up:** Use a modern browser (Chrome, Edge, Firefox, Safari). Open the built `Composite-Studio.html` file directly. If you see a "Wrong file opened" message, you grabbed an unbuilt source file instead.

---

## Β · Features

- **Live preview.** Every change redraws the composite instantly.
- **Drag-and-drop portraits.** Drop in one photo or fifty. Names are guessed from filenames.
- **Three sections.** Officers, Sweethearts, and Brothers, each with its own placement rules.
- **Per-portrait cropping.** Drag inside a portrait to reposition, scroll to zoom, or use the sliders.
- **Two brother layouts.** Brothers *surrounding* the composite (traditional) or *stacked rows* below the crest.
- **Crest support.** Upload your crest and the app can strip the white backdrop automatically, with an adjustable threshold.
- **Ornate lettering.** Blackletter, Fraktur, Gothic, or classic serif for the headline.
- **Full styling control.** Background, accent, and text colors, portrait shape (oval, arch, rounded rectangle), size, and spacing.
- **Roster tools.** Paste a list of names, or load the built-in DTD name roster and edit from there.
- **Save and resume.** Export your work as an editable project file and reopen it later.
- **High-res export.** Download a PNG or print / save as PDF.

---

## Γ · How to Use It

### 1. People tab
- Pick which section new uploads go to (Brothers, Officers, or Sweethearts).
- Drop in portraits, or click **+ Add person** for an empty slot.
- Select someone from the list, or click their portrait in the preview, to edit their name, role, section, and crop.
- Use the ↑ / ↓ arrows to reorder people within a section. Order controls placement around the ring.

### 2. Design tab
- Set the chapter name, subtitle, school, and year.
- Choose a headline typeface and size.
- Upload a crest and adjust backdrop removal.
- Pick a layout, portrait shape, colors, size, and spacing.

### 3. Project tab
- **Export:** Download a high-resolution PNG, or print / save as PDF.
- **Save / Open:** Keep an editable `.json` project file.
- **Quick import:** Paste one person per line in this format:

```
Name | Role | Section
```

For example:

```
Alex Smith | President | Officers
Jane Doe | | Sweethearts
Sam Adams | | Brothers
```

Section can be `Officers`, `Sweethearts`, or `Brothers`. If it's blank or unrecognized, the person is added to Brothers.

---

## Δ · Important: Save Your Project

Composite Studio keeps your work in memory only. **Refreshing or closing the tab loses unsaved changes.** Use **Project → Save editable project** regularly. The project file includes names, settings, and the uploaded images, so you can pick up right where you left off.

---

## Ε · Exporting

| Option | Best for | Notes |
|---|---|---|
| **Download PNG** | Sharing, printing at a shop | Exports at full canvas resolution, not the preview size |
| **Print / Save as PDF** | Quick hard copies | Choose landscape. Allow pop-ups when prompted |
| **Save project (.json)** | Editing later | Includes all images and settings |

---

## Ζ · Customizing for Your Chapter

The defaults are set up for Delta Tau Delta, Kappa Iota Chapter at East Carolina University, but everything in the **Design** tab is editable, so any chapter or organization can use it as-is.

The **Load name roster** button loads a preset list of names. It's just seed data. If you'd like your own preset, edit the roster and default settings in the source before building.

---

## Η · Under the Hood

- Built with **React**, bundled into a **single HTML file** (about 360 KB).
- Everything is drawn on an HTML **`<canvas>`**, so the preview and the export come from the same drawing code.
- Fonts are **embedded in the file**, so the lettering looks right offline.
- Photos are read locally with the browser's **File API**. There are no servers and no network requests.
- Downloads use **Blobs**, so exports are generated right on your machine.

---

## Θ · Why HTML

HTML is extremely powerful, and it's underutilized for tools like this one.

Most people think of HTML as "web pages." But a modern browser is a complete application runtime that almost everyone already has. For a project like Composite Studio, that means:

- **Zero install.** No app store, no admin rights, no installer, no "which version do I need?" Just open the file.
- **It runs anywhere.** Mac, Windows, Linux, Chromebook, and even a phone. If it has a browser, it works.
- **Distribution is trivial.** The whole app is *one file*. Email it, drop it in a group chat, put it on a flash drive, or host it on any static site.
- **Privacy by default.** Because the app runs entirely on the user's device, photos never touch a server. There's no account, no backend, and nothing to leak.
- **It works offline.** No connection, no problem. Great for chapter houses with terrible Wi-Fi.
- **Real capabilities.** Canvas gives high-resolution drawing, the File API handles drag-and-drop photos, and Blobs power downloads. That's enough to replace a lot of "real" desktop software.
- **It lasts.** HTML files don't rot. A file saved today should still open years from now, without waiting on updates, subscriptions, or a company staying in business.
- **Anyone can inspect and modify it.** It's just text. Open it, read it, change it.

We reach for heavyweight frameworks, hosted platforms, and subscription software for problems that a single HTML file can solve better. This project is proof that it can be enough.

---

## Ι · Troubleshooting

| Problem | Fix |
|---|---|
| Blank page or "Wrong file opened" message | Open the built `Composite-Studio.html`, not an unbuilt source file |
| Print / PDF does nothing | Allow pop-ups for the page, then try again |
| Crest has a white box around it | Turn on **Remove white backdrop** and raise the threshold |
| Portraits look cropped wrong | Select the portrait, then drag to reposition and scroll to zoom. **Reset crop** starts over |
| Lost my work after refreshing | The app doesn't auto-save. Use **Save editable project** and reopen the `.json` next time |

---

## Ω · Credits

Built for chapters that want a great-looking composite without the hassle, the fees, or the wait.

Rah rah Delta Tau
