import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { isolateHistory } from "@codemirror/commands";
import type { SyntaxNode } from "@lezer/common";
import { DEFAULT_FIGURES_FOLDER, FolderSuggest, registerFigureMover } from "./figures";

interface NoteHelperSettings {
	autoArrows: boolean;
	autoMoveFigures: boolean;
	figuresFolder: string;
}

const DEFAULT_SETTINGS: NoteHelperSettings = {
	autoArrows: true,
	autoMoveFigures: true,
	figuresFolder: DEFAULT_FIGURES_FOLDER,
};

const CALLOUT_TYPES = [
	"note", "abstract", "info", "todo", "tip", "success", "question",
	"warning", "failure", "danger", "bug", "example", "quote",
];

export default class NoteHelpersPlugin extends Plugin {
	settings: NoteHelperSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		// 1. "/callout" → popup with callout types → inserts "> [!type] "
		this.registerEditorSuggest(new CalloutSuggest(this.app));

		// 2a. Live conversion while typing: -> → , <- ← , <-> ↔
		this.registerEditorExtension(this.arrowInputHandler());

		// 2b. Command (bind a hotkey in Settings → Hotkeys) for existing text
		this.addCommand({
			id: "convert-arrows",
			name: "Convert arrows in selection (or whole note)",
			editorCallback: (editor: Editor) => {
				if (editor.somethingSelected()) {
					editor.replaceSelection(convertArrows(editor.getSelection()));
				} else {
					const cursor = editor.getCursor();
					editor.setValue(convertArrows(editor.getValue()));
					editor.setCursor(cursor);
				}
			},
		});

		// 3. Images in the vault root move to the figures folder once a note links them
		registerFigureMover(this);

		this.addSettingTab(new NoteHelpersSettingTab(this.app, this));
	}

	private arrowInputHandler() {
		return EditorView.inputHandler.of((view, from, to, text) => {
			if (!this.settings.autoArrows) return false;
			if (text !== ">" && text !== "-") return false;
			if (isInCode(view.state, from)) return false;

			const before = view.state.sliceDoc(Math.max(0, from - 2), from);
			let start = -1;
			let arrow = "";

			if (text === ">") {
				if (before.endsWith("←")) { start = from - 1; arrow = "↔"; }
				else if (before.endsWith("<-")) { start = from - 2; arrow = "↔"; }
				else if (before.endsWith("-")) { start = from - 1; arrow = "→"; }
			} else if (before.endsWith("<")) {
				start = from - 1; arrow = "←";
			}
			if (start < 0) return false;

			// Insert the typed character first, then convert in a separate,
			// history-isolated step: Ctrl/Cmd+Z undoes only the conversion.
			view.dispatch({
				changes: { from, to, insert: text },
				selection: { anchor: from + text.length },
				userEvent: "input.type",
			});
			view.dispatch({
				changes: { from: start, to: from + text.length, insert: arrow },
				annotations: isolateHistory.of("before"),
				userEvent: "input.type",
			});
			return true;
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<NoteHelperSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class CalloutSuggest extends EditorSuggest<string> {
	onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile | null): EditorSuggestTriggerInfo | null {
		const textBefore = editor.getLine(cursor.line).slice(0, cursor.ch);
		// Only at the start of a line, e.g. "/callout" or "/callout war"
		const match = textBefore.match(/^(\s*)\/callout\s?(\w*)$/i);
		if (!match) return null;
		return {
			start: { line: cursor.line, ch: (match[1] ?? "").length },
			end: cursor,
			query: (match[2] ?? "").toLowerCase(),
		};
	}

	getSuggestions(context: EditorSuggestContext): string[] {
		return CALLOUT_TYPES.filter((t) => t.startsWith(context.query));
	}

	renderSuggestion(type: string, el: HTMLElement) {
		el.setText(type);
	}

	selectSuggestion(type: string) {
		if (!this.context) return;
		const { editor, start, end } = this.context;
		const text = `> [!${type}] `;
		editor.replaceRange(text, start, end);
		// Cursor lands where the (optional) title goes; Enter continues with "> "
		editor.setCursor({ line: start.line, ch: start.ch + text.length });
	}
}

/** True if pos is inside inline code, a code block or math. */
function isInCode(state: EditorState, pos: number): boolean {
	for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1); node; node = node.parent) {
		if (/code|math/i.test(node.type.name)) return true;
	}
	return false;
}

/** Replace arrows in text, skipping fenced code blocks and inline code. */
function convertArrows(text: string): string {
	let inFence = false;
	return text
		.split("\n")
		.map((line) => {
			if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; return line; }
			if (inFence) return line;
			return line
				.split("`")
				.map((part, i) => (i % 2 ? part : part.replace(/<->/g, "↔").replace(/->/g, "→").replace(/<-/g, "←")))
				.join("`");
		})
		.join("\n");
}

class NoteHelpersSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: NoteHelpersPlugin) {
		super(app, plugin);
	}

	display() {
		this.containerEl.empty();
		new Setting(this.containerEl)
			.setName("Convert arrows while typing")
			.setDesc("Turns ->, <- and <-> into →, ← and ↔ as you type (not inside code).")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.autoArrows).onChange(async (v) => {
					this.plugin.settings.autoArrows = v;
					await this.plugin.saveSettings();
				})
			);
		new Setting(this.containerEl)
			.setName("Move linked images to figures folder")
			.setDesc("When a note links an image that sits in the vault root, move it to the figures folder.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.autoMoveFigures).onChange(async (v) => {
					this.plugin.settings.autoMoveFigures = v;
					await this.plugin.saveSettings();
				})
			);
		new Setting(this.containerEl)
			.setName("Figures folder")
			.setDesc("Where linked images are moved. Created if it doesn't exist.")
			.addText((t) => {
				new FolderSuggest(this.app, t.inputEl);
				t.setPlaceholder(DEFAULT_FIGURES_FOLDER)
					.setValue(this.plugin.settings.figuresFolder)
					.onChange(async (v) => {
						this.plugin.settings.figuresFolder = v.trim();
						await this.plugin.saveSettings();
					});
			});
	}
}
