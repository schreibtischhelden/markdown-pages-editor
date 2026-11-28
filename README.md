# markdown-pages-editor

[![CI](https://github.com/schreibtischhelden/markdown-pages-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/schreibtischhelden/markdown-pages-editor/actions/workflows/ci.yml)

A lightweight, configurable Markdown editor for the browser: a `<textarea>` with a toolbar and a live preview.

- **No dependencies, no build step** – one script and one stylesheet, plain ES5 UMD, works under a strict Content Security Policy (`script-src 'self'`)
- **Your renderer** – the editor does not convert Markdown itself. The preview uses the function you pass (Showdown, marked, markdown-it … plus a sanitizer), so it looks exactly like your site
- **Configurable** – choose the buttons and their order, add your own commands, pick the modes (write / side by side / preview), translate all texts
- **Nothing is sent anywhere** – download the text as `.md` or the rendered page as `.html`, keep a draft in `localStorage`, or read it with `getValue()`
- Keeps the browser's undo history, keyboard shortcuts, accessible toolbar

Used by [markdown-pages.js](https://github.com/schreibtischhelden/markdown-pages.js).

## Installation

```sh
npm install @schreibtischhelden/markdown-pages-editor
```

Or in the browser (global `markdownPagesEditor`):

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@schreibtischhelden/markdown-pages-editor@1/markdown-pages-editor.css">
<script src="https://cdn.jsdelivr.net/npm/@schreibtischhelden/markdown-pages-editor@1/markdown-pages-editor.js"></script>
```

For a strict CSP, copy both files to your site instead of loading them from a CDN.

## Usage

```javascript
import markdownPagesEditor from '@schreibtischhelden/markdown-pages-editor';
import '@schreibtischhelden/markdown-pages-editor/markdown-pages-editor.css';
import showdown from 'showdown';
import DOMPurify from 'dompurify';

const converter = new showdown.Converter();

const editor = markdownPagesEditor(document.getElementById('editor'), {
	value: '# Imprint\n\n…',
	fileName: 'imprint.md',
	render: (markdown) => DOMPurify.sanitize(converter.makeHtml(markdown)),
});

editor.getValue();
```

The first argument is a container the editor is appended to, or an existing `<textarea>`, which is enhanced and keeps its `name` – so it still works in a form.

> **Sanitize the preview.** The HTML returned by `render` is inserted as is. If the Markdown can come from someone else, pass it through a sanitizer such as [DOMPurify](https://github.com/cure53/DOMPurify).

## Options

| Option | Default | Description |
| :--- | :--- | :--- |
| `value` | the textarea's text | Initial text |
| `toolbar` | `['bold', 'italic', 'heading', '\|', 'link', 'code', '\|', 'quote', 'list', 'numbered']` | Buttons in this order, `'\|'` is a separator. `false` hides all formatting buttons |
| `commands` | – | Your own commands (or replacements), see below |
| `shortcuts` | `true` | Keyboard shortcuts of the commands in the toolbar (<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>B</kbd>, <kbd>I</kbd>, <kbd>K</kbd>) |
| `render` | – | `function (markdown, element)` returning HTML (or a Promise of it), or filling `element` itself and returning nothing. Without it there is no preview |
| `afterRender` | – | `function (element, editor)`, called after the HTML was inserted – e.g. to highlight code |
| `modes` | `['write', 'split', 'preview']` | Available modes. One mode hides the switcher. Without `render` only `'write'` is left |
| `mode` | `'split'` | Start mode. `'split'` shows text and preview side by side (stacked on narrow screens) |
| `fileName` | – | File name for the *Download* button; without it there is no button |
| `download` | `true` | `false` hides the download button even with a `fileName` |
| `saveHtml` | `false` | `true` adds a *Save HTML* button (needs `fileName` and `render`), see [Saving as HTML](#saving-as-html) |
| `htmlHead` | – | Extra HTML for the `<head>` of saved HTML files (string or `function (markdown, editor)`), e.g. a stylesheet link. Inserted as is |
| `htmlLang` | the page's `<html lang>` | `lang` attribute of saved HTML files |
| `storageKey` | – | Keeps an unsaved draft in `localStorage` under this key, so a reload does not lose it |
| `delay` | `200` | Milliseconds between typing and the preview update |
| `prefixIds` | `true` | Prefixes ids in the preview (`markdown-pages-editor-1-…`, also `for` and `#` links), so preview headings never clash with ids of the page |
| `labels` | English | Button texts and accessible names, e.g. `{ bold: 'Fett', preview: 'Vorschau', download: 'Herunterladen', saveHtml: 'Als HTML speichern' }` – all keys: `markdownPagesEditor.labels` |
| `onChange` | – | `function (value, editor)`, called after every change |

### Built-in commands

| Name | Button | Result |
| :--- | :--- | :--- |
| `bold` | **B** | `**bold**` – again to remove (<kbd>Ctrl</kbd>+<kbd>B</kbd>) |
| `italic` | _I_ | `_italic_` (<kbd>Ctrl</kbd>+<kbd>I</kbd>) |
| `strikethrough` | S | `~~text~~` |
| `heading` | H | Heading: none → `##` → `###` → none |
| `link` | Link | `[text](https://)` with the address selected (<kbd>Ctrl</kbd>+<kbd>K</kbd>) |
| `code` | `</>` | `` `code` ``, a fenced block if several lines are selected |
| `quote` | “ | `> ` before every selected line – again to remove |
| `list` | • | `- ` before every selected line |
| `numbered` | 1. | `1. `, `2. ` … |
| `tasks` | ☐ | `- [ ] ` before every selected line |
| `rule` | — | `---` after the current line |

`strikethrough`, `tasks` and `rule` are not in the default toolbar – add them with `toolbar`.

### Examples

Only a few buttons, no preview switcher, German texts:

```javascript
markdownPagesEditor(element, {
	toolbar: ['bold', 'italic', '|', 'link'],
	modes: ['split'],
	render,
	labels: { bold: 'Fett', italic: 'Kursiv', link: 'Link', preview: 'Vorschau' },
});
```

A plain textarea with buttons, no preview: leave out `render`.

### Own commands

A command gets the text and the selection and returns one edit – the replaced range and the new selection. It is applied as a single step, so undo works.

```javascript
markdownPagesEditor(element, {
	toolbar: [...markdownPagesEditor.defaultToolbar, '|', 'signature'],
	commands: {
		signature: {
			text: '✍',
			label: 'Insert signature',
			shortcut: 'j',
			run: ({ value, start, end }) => ({ from: end, to: end, text: '\n\n-- Jane', start: end + 9, end: end + 9 }),
		},
	},
});
```

`markdownPagesEditor.helpers` has the building blocks of the built-in commands: `wrap(state, before, after, placeholder)`, `prefixLines(state, prefix)` and `editLines(state, mapLines)`.

## Methods

`markdownPagesEditor()` returns an object:

| Name | Description |
| :--- | :--- |
| `getValue()`, `setValue(text)` | Read or replace the text |
| `isDirty()`, `markSaved()` | Whether the text changed since it was loaded or last marked as saved; `markSaved()` also removes the draft |
| `download([fileName])` | Downloads the text as a `.md` file (the name is reduced to a plain file name) |
| `saveHtml([fileName])`, `getHtml([fileName])` | Saves the rendered text as a complete `.html` file, or returns that document as a Promise of a string (see [Saving as HTML](#saving-as-html)) |
| `setMode(mode)`, `getMode()` | Switch between the configured modes |
| `render()` | Updates the preview now, returns a Promise |
| `exec(command)` | Runs a command by name |
| `focus()`, `destroy()` | Focus the text field; remove the editor (an enhanced textarea is put back) |
| `element`, `textarea`, `preview` | The DOM elements |

After every preview update a `markdown-pages-editor:preview` event bubbles from the preview element (`detail: { editor }`).

## Saving as HTML

With `saveHtml: true` (plus `fileName` and `render`) a *Save HTML* button saves the rendered page as a standalone file; `editor.saveHtml()` does the same without the button.

```javascript
markdownPagesEditor(element, {
	fileName: 'imprint.md',            // saved as imprint.html
	render: (markdown) => DOMPurify.sanitize(converter.makeHtml(markdown)),
	saveHtml: true,
	htmlHead: '<link rel="stylesheet" href="https://example.com/site.css">',
	labels: { saveHtml: 'Als HTML speichern' },
});
```

- The body is the output of `render` – the same HTML the preview shows, so sanitizing stays the job of `render`. `afterRender` and the id prefixes of the preview are not applied, so ids and `#` links stay as written.
- The document gets `<!doctype html>`, `charset` and `viewport`, a `<title>` from the first level 1 heading (or the file name) and `lang` from the page. No CSS is inlined; add a stylesheet with `htmlHead`.
- The file name is `fileName` with `.md` / `.markdown` replaced by `.html` (`.html` and `.htm` are kept).
- Without a `render` function there is no button and `saveHtml()` rejects.

## Preview behaviour

- Links in the preview do not navigate away from unsaved text (`#` links still scroll).
- Forms in the preview are not submitted, and their `submit` events do not reach handlers of the page.
- Ids are prefixed (see `prefixIds`).

## Styling

The stylesheet uses [Pico CSS](https://picocss.com) variables when they exist and otherwise the surrounding text colour. Adapt it with CSS variables:

```css
.markdown-pages-editor {
	--markdown-pages-editor-height: 30rem;
	--markdown-pages-editor-border: #ccc;
	--markdown-pages-editor-active: #2f3e4e;
	--markdown-pages-editor-active-text: #fff;
}
```

Classes: `.markdown-pages-editor`, `-toolbar`, `-format`, `-separator`, `-button`, `-<command>`, `-modes`, `-mode`, `-download`, `-save-html`, `-panes`, `-input`, `-preview`, `-empty`; the root has `data-mode="write|split|preview"`.

## Development

```sh
npm test
```

The tests need no dependencies. They cover the commands, option resolving, file names and the saved HTML document; keep logic in these pure functions.

## Releasing

1. Set the new version in `package.json` and commit it (`Release 1.2.3`).
2. Tag and push: `git tag v1.2.3 && git push origin v1.2.3`.
3. The [Release workflow](.github/workflows/release.yml) runs the tests, publishes to npm with provenance (npm Trusted Publishing; the secret `NPM_TOKEN` is only a fallback) and creates the GitHub release.

There is no changelog file: the release notes are generated from the commit messages since the previous tag ([`scripts/release-notes.mjs`](scripts/release-notes.mjs), `npm run release-notes` shows them locally). Changes are listed on the [releases page](https://github.com/schreibtischhelden/markdown-pages-editor/releases).

## License

[MIT](LICENSE)
