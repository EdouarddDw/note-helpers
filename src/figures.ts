import { AbstractInputSuggest, App, CachedMetadata, getLinkpath, normalizePath, Notice, TFile, TFolder } from "obsidian";
import type NoteHelpersPlugin from "./main";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);

export const DEFAULT_FIGURES_FOLDER = "figures";

/**
 * Images in the vault root that get linked from a note ([[…]], ![[…]], [](…), ![](…))
 * are moved to the figures folder. Images anywhere else are left alone.
 */
export function registerFigureMover(plugin: NoteHelpersPlugin) {
	const { app } = plugin;
	const moving = new Set<string>();

	const moveImages = async (images: TFile[]) => {
		const folder = figuresFolder(plugin);
		let moved = 0;
		for (const img of images) {
			if (moving.has(img.path)) continue;
			moving.add(img.path);
			try {
				await ensureFolder(app, folder);
				// renameFile also rewrites every link that points to the image
				await app.fileManager.renameFile(img, uniqueTarget(app, folder, img));
				moved++;
			} catch (e) {
				console.error("Note helper: could not move image", img.path, e);
			} finally {
				moving.delete(img.path);
			}
		}
		return moved;
	};

	app.workspace.onLayoutReady(() => {
		plugin.registerEvent(
			app.metadataCache.on("changed", (file, _data, cache) => {
				if (!plugin.settings.autoMoveFigures) return;
				const images = linkedRootImages(app, file, cache);
				if (images.length) void moveImages(images);
			})
		);
	});

	plugin.addCommand({
		id: "move-linked-root-images",
		name: "Move linked images from vault root to figures folder",
		callback: async () => {
			const images = new Set<TFile>();
			for (const targets of Object.values(app.metadataCache.resolvedLinks)) {
				for (const path of Object.keys(targets)) {
					const f = app.vault.getFileByPath(path);
					if (f && isRootImage(f)) images.add(f);
				}
			}
			const moved = await moveImages([...images]);
			new Notice(`Moved ${moved} image${moved === 1 ? "" : "s"} to ${figuresFolder(plugin)}.`);
		},
	});
}

function figuresFolder(plugin: NoteHelpersPlugin): string {
	return normalizePath(plugin.settings.figuresFolder.trim() || DEFAULT_FIGURES_FOLDER);
}

function isRootImage(file: TFile): boolean {
	return IMAGE_EXTENSIONS.has(file.extension.toLowerCase()) && file.parent?.path === "/";
}

function linkedRootImages(app: App, file: TFile, cache: CachedMetadata): TFile[] {
	const refs = [...(cache.embeds ?? []), ...(cache.links ?? [])];
	const images = new Set<TFile>();
	for (const ref of refs) {
		const dest = app.metadataCache.getFirstLinkpathDest(getLinkpath(ref.link), file.path);
		if (dest && isRootImage(dest)) images.add(dest);
	}
	return [...images];
}

async function ensureFolder(app: App, path: string) {
	if (!app.vault.getAbstractFileByPath(path)) await app.vault.createFolder(path);
}

/** "folder/name.ext", or "folder/name 1.ext", "folder/name 2.ext", … if taken. */
function uniqueTarget(app: App, folder: string, file: TFile): string {
	let target = normalizePath(`${folder}/${file.name}`);
	for (let i = 1; app.vault.getAbstractFileByPath(target); i++) {
		target = normalizePath(`${folder}/${file.basename} ${i}.${file.extension}`);
	}
	return target;
}

/** Folder autocomplete for a settings text field. */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	constructor(app: App, private inputEl: HTMLInputElement) {
		super(app, inputEl);
	}

	getSuggestions(query: string): TFolder[] {
		const q = query.toLowerCase();
		return this.app.vault.getAllFolders().filter((f) => f.path.toLowerCase().includes(q));
	}

	renderSuggestion(folder: TFolder, el: HTMLElement) {
		el.setText(folder.path);
	}

	selectSuggestion(folder: TFolder) {
		this.setValue(folder.path);
		this.inputEl.dispatchEvent(new Event("input"));
		this.close();
	}
}
