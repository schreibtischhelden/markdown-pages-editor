// Unit tests for the pure parts of markdown-pages-editor.js: text commands,
// option resolving, file names and saved HTML documents. The DOM part is not loaded here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import markdownPagesEditor, { commands, applyEdit, safeFileName, documentTitle, htmlDocument, resolveOptions, defaultToolbar, helpers } from '@schreibtischhelden/markdown-pages-editor';

/**
 * Runs a command on text with the selection marked by "|" (cursor) or
 * "[" and "]" (selection) and returns the result in the same notation.
 */
function run(name, marked) {
	let value = marked;
	let start;
	let end;
	if (value.includes('[')) {
		start = value.indexOf('[');
		value = value.replace('[', '');
		end = value.indexOf(']');
		value = value.replace(']', '');
	} else {
		start = end = value.indexOf('|');
		value = value.replace('|', '');
	}
	const edit = commands[name].run({ value, start, end });
	const result = applyEdit(value, edit);
	if (edit.start === edit.end) {
		return result.slice(0, edit.start) + '|' + result.slice(edit.start);
	}
	return result.slice(0, edit.start) + '[' + result.slice(edit.start, edit.end) + ']' + result.slice(edit.end);
}

test('ESM entry exposes the same API as CommonJS', async () => {
	// Arrange
	const { createRequire } = await import('node:module');

	// Act
	const cjs = createRequire(import.meta.url)('@schreibtischhelden/markdown-pages-editor');

	// Assert
	assert.equal(markdownPagesEditor, cjs);
	assert.equal(commands, cjs.commands);
	assert.equal(typeof cjs.resolveOptions, 'function');
});

test('inline commands wrap the selection and toggle it off again', async (t) => {
	const cases = [
		['bold', 'a [word] b', 'a **[word]** b'],
		['bold', 'a **[word]** b', 'a [word] b'],
		['bold', 'a [**word**] b', 'a [word] b'],
		['bold', 'a | b', 'a **[bold text]** b'],
		['bold', '[x]', '**[x]**'],
		['italic', '[x]', '_[x]_'],
		['italic', '_[x]_', '[x]'],
		['strikethrough', '[x]', '~~[x]~~'],
		['code', 'call [fn()] now', 'call `[fn()]` now'],
		['code', '[a = 1\nb = 2]', '```\n[a = 1\nb = 2]\n```'],
	];
	for (const [name, input, expected] of cases) {
		await t.test(`${name}: ${JSON.stringify(input)}`, () => {
			// Act + Assert
			assert.equal(run(name, input), expected);
		});
	}
});

test('line commands toggle on all selected lines', async (t) => {
	const cases = [
		['list', '[one\ntwo]', '[- one\n- two]'],
		['list', '[- one\n- two]', '[one\ntwo]'],
		['list', 'on|e', '- one|'],
		['quote', 'x\n[y]\nz', 'x\n[> y]\nz'],
		['numbered', '[a\nb\nc]', '[1. a\n2. b\n3. c]'],
		['numbered', '[1. a\n2. b]', '[a\nb]'],
		['tasks', '[a\nb]', '[- [ ] a\n- [ ] b]'],
		// a selection that ends at the start of a line does not include that line
		['list', '[a\n]b', '[- a]\nb'],
		['heading', 'Ti|tle', '## Title|'],
		['heading', '## Ti|tle', '### Title|'],
		['heading', '### Ti|tle', 'Title|'],
		['heading', '# Ti|tle', '## Title|'],
	];
	for (const [name, input, expected] of cases) {
		await t.test(`${name}: ${JSON.stringify(input)}`, () => {
			// Act + Assert
			assert.equal(run(name, input), expected);
		});
	}
});

test('link selects the part that is still missing', () => {
	// Act + Assert
	assert.equal(run('link', 'see [docs]'), 'see [docs]([https://])');
	assert.equal(run('link', '|'), '[link text]([https://])');
	assert.equal(run('link', '[https://example.org]'), '[[link text]](https://example.org)');
	assert.equal(run('link', '[?page=menu]'), '[[link text]](?page=menu)');
});

test('rule is inserted after the current line', () => {
	// Act + Assert
	assert.equal(run('rule', 'te|xt\nnext'), 'text\n\n---\n|\nnext');
	assert.equal(run('rule', '|'), '---\n|');
});

test('resolveOptions: default toolbar, all modes with a render function', () => {
	// Act
	const config = resolveOptions({ render: () => '' });

	// Assert
	assert.deepEqual([...config.toolbar], defaultToolbar);
	assert.deepEqual([...config.modes], ['write', 'split', 'preview']);
	assert.equal(config.mode, 'split');
	assert.equal(config.download, false);
	assert.equal(config.shortcuts, true);
});

test('resolveOptions: custom toolbar keeps order, drops unknown names and stray separators', () => {
	// Act
	const config = resolveOptions({ toolbar: ['|', 'link', 'nope', '|', '|', 'bold', '|'] });

	// Assert
	assert.deepEqual([...config.toolbar], ['link', '|', 'bold']);
	assert.deepEqual([...resolveOptions({ toolbar: ['bold', '|', '|'] }).toolbar], ['bold']);
});

test('resolveOptions: toolbar false hides all formatting buttons', () => {
	// Act + Assert
	assert.deepEqual([...resolveOptions({ toolbar: false }).toolbar], []);
});

test('resolveOptions: without render function only the write mode is left', () => {
	// Act
	const config = resolveOptions({ modes: ['split', 'preview'], mode: 'preview' });

	// Assert
	assert.deepEqual([...config.modes], ['write']);
	assert.equal(config.mode, 'write');
});

test('resolveOptions: modes are filtered and the start mode must be one of them', () => {
	// Act
	const config = resolveOptions({ render: () => '', modes: ['preview', 'write', 'preview', 'x'], mode: 'split' });

	// Assert
	assert.deepEqual([...config.modes], ['preview', 'write']);
	assert.equal(config.mode, 'preview');
});

test('resolveOptions: download button needs a file name and can be switched off', () => {
	// Act + Assert
	assert.equal(resolveOptions({ fileName: 'a.md' }).download, true);
	assert.equal(resolveOptions({ fileName: 'a.md', download: false }).download, false);
});

test('resolveOptions: the Save HTML button is opt-in and needs a file name and a render function', () => {
	// Arrange
	const render = () => '';

	// Act + Assert
	assert.equal(resolveOptions({ fileName: 'a.md', render }).saveHtml, false);
	assert.equal(resolveOptions({ fileName: 'a.md', render, saveHtml: true }).saveHtml, true);
	assert.equal(resolveOptions({ fileName: 'a.md', saveHtml: true }).saveHtml, false);
	assert.equal(resolveOptions({ render, saveHtml: true }).saveHtml, false);
});

test('resolveOptions: custom commands can be added and used in the toolbar', () => {
	// Arrange
	const signature = { text: 'Sig', run: (state) => ({ from: state.end, to: state.end, text: '-- me', start: state.end + 5, end: state.end + 5 }) };

	// Act
	const config = resolveOptions({ commands: { signature, broken: {} }, toolbar: ['bold', 'signature', 'broken'] });

	// Assert
	assert.deepEqual([...config.toolbar], ['bold', 'signature']);
	assert.equal(config.commands.signature, signature);
	assert.equal(commands.signature, undefined, 'the built-in commands are not changed');
});

test('helpers.prefixLines can build custom line commands', () => {
	// Act
	const edit = helpers.prefixLines({ value: 'a\nb', start: 0, end: 3 }, '% ');

	// Assert
	assert.equal(applyEdit('a\nb', edit), '% a\n% b');
});

test('safeFileName keeps only a plain .md file name', async (t) => {
	const cases = [
		['imprint.md', 'imprint.md'],
		['imprint', 'imprint.md'],
		['pages/about.md', 'about.md'],
		['..\\..\\evil.md', 'evil.md'],
		['.hidden', 'hidden.md'],
		['a<b>:c?.md', 'abc.md'],
		['', 'document.md'],
		[undefined, 'document.md'],
		['notes.markdown', 'notes.markdown'],
	];
	for (const [input, expected] of cases) {
		await t.test(String(input), () => {
			// Act + Assert
			assert.equal(safeFileName(input), expected);
		});
	}
});

test('safeFileName with format html ends in .html', async (t) => {
	const cases = [
		['imprint.md', 'imprint.html'],
		['notes.MARKDOWN', 'notes.html'],
		['imprint', 'imprint.html'],
		['page.html', 'page.html'],
		['page.htm', 'page.htm'],
		['pages/about.md', 'about.html'],
		['..\..\evil.md', 'evil.html'],
		['.hidden', 'hidden.html'],
		['', 'document.html'],
		[undefined, 'document.html'],
	];
	for (const [input, expected] of cases) {
		await t.test(String(input), () => {
			// Act + Assert
			assert.equal(safeFileName(input, 'html'), expected);
		});
	}
});

test('documentTitle takes the first level 1 heading outside code blocks', async (t) => {
	const cases = [
		['# Imprint\n\ntext', 'Imprint'],
		['intro\n\n## Sub\n\n#  Main title  ##\n', 'Main title'],
		['Setext title\n===\n\ntext', 'Setext title'],
		['```\n# not a title\n```\n# Real', 'Real'],
		['~~~~\n```\n# still code\n~~~~\n# After', 'After'],
		['# **Bold** and [link](https://example.com) `code`', 'Bold and link code'],
		['#hashtag\n\n## Only h2', ''],
		['#\n\n# Second', 'Second'],
		['', ''],
	];
	for (const [input, expected] of cases) {
		await t.test(JSON.stringify(input), () => {
			// Act + Assert
			assert.equal(documentTitle(input), expected);
		});
	}
});

test('htmlDocument wraps the body in a complete document', () => {
	// Act
	const html = htmlDocument('<h1>A &amp; B</h1>\n', { title: 'A & <B>', lang: 'de', head: '<link rel="stylesheet" href="site.css">' });

	// Assert
	assert.equal(html, [
		'<!doctype html>',
		'<html lang="de">',
		'<head>',
		'<meta charset="utf-8">',
		'<meta name="viewport" content="width=device-width, initial-scale=1">',
		'<title>A &amp; &lt;B&gt;</title>',
		'<link rel="stylesheet" href="site.css">',
		'</head>',
		'<body>',
		'<h1>A &amp; B</h1>',
		'</body>',
		'</html>',
		'',
	].join('\n'));
});

test('htmlDocument without options has a default title, no lang and no extra head', () => {
	// Act
	const html = htmlDocument('<p>x</p>');

	// Assert
	assert.match(html, /^<!doctype html>\n<html>\n/);
	assert.match(html, /<title>Document<\/title>\n<\/head>/);
});

test('htmlDocument keeps only valid characters of lang', () => {
	// Act + Assert
	assert.match(htmlDocument('', { lang: 'de" onload="x' }), /<html lang="deonloadx">/);
});
