# Note Helpers

A small [Obsidian](https://obsidian.md) plugin with a couple of shortcuts that make note-taking faster: quick callout insertion and automatic arrow conversion.

## Features

### Callout suggester

Type `/callout` at the start of a line and pick a callout type from the popup. Keep typing to filter the list (e.g. `/callout war` → `warning`).

Selecting a type inserts:

```markdown
> [!warning] 
```

The cursor lands where the optional title goes.

Supported types: `note`, `abstract`, `info`, `todo`, `tip`, `success`, `question`, `warning`, `failure`, `danger`, `bug`, `example`, `quote`.

### Arrow conversion

Text arrows are turned into Unicode arrows as you type:

| You type | You get |
| -------- | ------- |
| `->`     | →       |
| `<-`     | ←       |
| `<->`    | ↔       |

- Arrows inside inline code, code blocks and math are left alone.
- Press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>Z</kbd> right after a conversion to undo just the conversion and keep the plain text.
- Live conversion can be turned off in **Settings → Note helper**.

To convert arrows in existing text, run the command **Note helper: Convert arrows in selection (or whole note)** from the command palette. It converts the selection, or the whole note if nothing is selected. You can bind it to a hotkey in **Settings → Hotkeys**.

### Figures folder

Pasted screenshots and other images land in the vault root. As soon as a note links one (`![[…]]`, `[[…]]`, `![](…)` or `[](…)`), the image is moved to your figures folder and the links are updated automatically.

- Only images in the vault root are moved (`png`, `jpg`, `jpeg`, `gif`, `webp`, `svg`). Images in other folders are left alone.
- If a file with the same name already exists in the figures folder, the moved image gets a number suffix (`image 1.png`).
- Turn the feature on or off and choose the folder in **Settings → Note helper**. The folder is created if it doesn't exist.

To tidy up images already in the root, run **Note helper: Move linked images from vault root to figures folder**.

## Installation

The plugin is not in the community plugin list. Install it manually:

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/EdouarddDw/note-helpers/releases), or build them yourself (see below).
2. Copy them into `<your vault>/.obsidian/plugins/note-helpers/`.
3. Reload Obsidian and enable **Note helper** in **Settings → Community plugins**.

## Development

Requires Node.js 18 or newer.

```bash
git clone https://github.com/EdouarddDw/note-helpers.git
cd note-helpers
npm install
npm run dev     # watch mode, rebuilds main.js on save
```

Other scripts:

| Command         | Description                          |
| --------------- | ------------------------------------ |
| `npm run build` | Type-check and build for production  |
| `npm run lint`  | Run ESLint                           |

Source code lives in `src/` (`main.ts` for the plugin lifecycle, `figures.ts` for the figures folder feature). For a fast loop, clone the repo directly into a vault's `.obsidian/plugins/` folder and reload Obsidian after each build.

## License

[0BSD](LICENSE). Based on the [Obsidian sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin).
