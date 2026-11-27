export type Mode = 'write' | 'split' | 'preview';

/** Text and selection a command works on. */
export interface EditorState {
	value: string;
	start: number;
	end: number;
}

/** One replacement of value[from..to] by text, and the selection afterwards. */
export interface Edit {
	from: number;
	to: number;
	text: string;
	start: number;
	end: number;
}

export interface Command {
	/** Visible button text, default: the label. */
	text?: string;
	/** Accessible name and tooltip. */
	label?: string;
	/** Key that runs the command together with Ctrl / Cmd, e.g. "b". */
	shortcut?: string;
	run(state: EditorState): Edit | null | undefined;
}

export interface EditorOptions {
	/** Initial text, default: the textarea's value. */
	value?: string;
	/** Command names in order; "|" is a separator. false: no formatting buttons. */
	toolbar?: Array<string> | false;
	/** Additional or replaced commands, usable in toolbar. */
	commands?: Record<string, Command>;
	/** Keyboard shortcuts of the commands in the toolbar, default true. */
	shortcuts?: boolean;
	/**
	 * Renders the preview: return HTML (inserted as is - sanitize it!) or fill
	 * the element yourself and return nothing. Without it there is no preview.
	 */
	render?: (markdown: string, element: HTMLElement) => string | void | Promise<string | void>;
	/** Called after the HTML was inserted, before ids are prefixed. */
	afterRender?: (element: HTMLElement, editor: Editor) => unknown;
	/** Prefix ids in the preview so they cannot clash with the page, default true. */
	prefixIds?: boolean;
	/** Available modes, default all; a single mode hides the switcher. */
	modes?: Mode[];
	/** Start mode, default "split". */
	mode?: Mode;
	/** File name for the download button; without it there is no button. */
	fileName?: string;
	/** false hides the download button even with fileName. */
	download?: boolean;
	/** Keep an unsaved draft in localStorage under this key. */
	storageKey?: string;
	/** Milliseconds between typing and the preview update, default 200. */
	delay?: number;
	/** Overrides for the button texts and accessible names. */
	labels?: Partial<Record<string, string>>;
	onChange?: (value: string, editor: Editor) => void;
}

export interface Editor {
	element: HTMLElement;
	textarea: HTMLTextAreaElement;
	preview: HTMLElement;
	getValue(): string;
	setValue(value: string): void;
	isDirty(): boolean;
	markSaved(): void;
	setMode(mode: Mode): void;
	getMode(): Mode;
	render(): Promise<void>;
	exec(command: string): void;
	download(fileName?: string): void;
	focus(): void;
	destroy(): void;
}

export interface ResolvedOptions {
	toolbar: string[];
	commands: Record<string, Command>;
	modes: Mode[];
	mode: Mode;
	download: boolean;
	shortcuts: boolean;
}

declare function markdownPagesEditor(target: HTMLElement, options?: EditorOptions): Editor;

declare namespace markdownPagesEditor {
	const commands: Record<string, Command>;
	const labels: Record<string, string>;
	const defaultToolbar: string[];
	function resolveOptions(options?: EditorOptions): ResolvedOptions;
	function applyEdit(value: string, edit: Edit): string;
	function safeFileName(name?: string): string;
	function prefixIds(root: ParentNode, prefix: string): void;
	const helpers: {
		wrap(state: EditorState, before: string, after: string, placeholder: string): Edit;
		prefixLines(state: EditorState, prefix: string): Edit;
		editLines(state: EditorState, mapLines: (lines: string[]) => string[]): Edit;
	};
}

export default markdownPagesEditor;
export declare const commands: typeof markdownPagesEditor.commands;
export declare const labels: typeof markdownPagesEditor.labels;
export declare const defaultToolbar: typeof markdownPagesEditor.defaultToolbar;
export declare const resolveOptions: typeof markdownPagesEditor.resolveOptions;
export declare const applyEdit: typeof markdownPagesEditor.applyEdit;
export declare const safeFileName: typeof markdownPagesEditor.safeFileName;
export declare const prefixIds: typeof markdownPagesEditor.prefixIds;
export declare const helpers: typeof markdownPagesEditor.helpers;
