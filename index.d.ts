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

/** One SVG shape: element name and attributes, e.g. ['path', { d: 'M3 8h10' }]. */
export type IconShape = [string, Record<string, string>];

export interface Command {
	/** Visible button text, default: the label. */
	text?: string;
	/** Icon shown instead of the text (unless icons: false), SVG shapes on a 16x16 grid. */
	icon?: IconShape[];
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
	/** Mode buttons and commands with an icon show it (label as tooltip), default true. */
	icons?: boolean;
	/** Markdown help link in the toolbar, default "https://markdownguide.offshoot.io/"; false hides it. */
	helpUrl?: string | false;
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
	/**
	 * true turns the download button into a menu (Markdown / HTML; needs fileName and render) that also saves the
	 * rendered text as a complete .html document.
	 */
	saveHtml?: boolean;
	/** Extra HTML for the <head> of saved HTML documents, e.g. a stylesheet link. Inserted as is. */
	htmlHead?: string | ((markdown: string, editor: Editor) => string);
	/** lang attribute of saved HTML documents, default: the page's <html lang>. */
	htmlLang?: string;
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
	/** The text as a complete HTML document, rendered with render (without afterRender and id prefixes). */
	getHtml(fileName?: string): Promise<string>;
	/** Saves getHtml() as a .html file. */
	saveHtml(fileName?: string): Promise<void>;
	focus(): void;
	destroy(): void;
}

export interface ResolvedOptions {
	toolbar: string[];
	commands: Record<string, Command>;
	modes: Mode[];
	mode: Mode;
	download: boolean;
	saveHtml: boolean;
	shortcuts: boolean;
	icons: boolean;
	helpUrl: string | null;
}

declare function markdownPagesEditor(target: HTMLElement, options?: EditorOptions): Editor;

declare namespace markdownPagesEditor {
	const commands: Record<string, Command>;
	const labels: Record<string, string>;
	const icons: Record<string, IconShape[]>;
	const defaultToolbar: string[];
	function resolveOptions(options?: EditorOptions): ResolvedOptions;
	function applyEdit(value: string, edit: Edit): string;
	function safeFileName(name?: string, format?: 'markdown' | 'html'): string;
	function documentTitle(markdown: string): string;
	function htmlDocument(body: string, options?: { title?: string; lang?: string; head?: string }): string;
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
export declare const icons: typeof markdownPagesEditor.icons;
export declare const defaultToolbar: typeof markdownPagesEditor.defaultToolbar;
export declare const resolveOptions: typeof markdownPagesEditor.resolveOptions;
export declare const applyEdit: typeof markdownPagesEditor.applyEdit;
export declare const safeFileName: typeof markdownPagesEditor.safeFileName;
export declare const prefixIds: typeof markdownPagesEditor.prefixIds;
export declare const documentTitle: typeof markdownPagesEditor.documentTitle;
export declare const htmlDocument: typeof markdownPagesEditor.htmlDocument;
export declare const helpers: typeof markdownPagesEditor.helpers;
