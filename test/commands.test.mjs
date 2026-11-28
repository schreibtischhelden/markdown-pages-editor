// Unit tests for the pure parts of markdown-pages-editor.js: text commands,
// option resolving, file names and saved HTML documents. The DOM part is not loaded here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import markdownPagesEditor, { commands, applyEdit, safeFileName, documentTitle, htmlDocument, compareHtml, resolveOptions, defaultToolbar, helpers } from '@schreibtischhelden/markdown-pages-editor';

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
		['highlight', '[x]', '==[x]=='],
		['highlight', '==[x]==', '[x]'],
		['subscript', 'H[2]O', 'H~[2]~O'],
		['superscript', 'x[2]', 'x^[2]^'],
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
		['definition', 'Term\n[meaning]', 'Term\n[: meaning]'],
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

/** runs a command on plain text (no markers, so the text may contain "[") and returns the new text and selection */
function runPlain(name, value, start, end = start) {
	const edit = commands[name].run({ value, start, end });
	const result = applyEdit(value, edit);
	return { text: result, selected: result.slice(edit.start, edit.end) };
}

test('image works like link, with alt text', () => {
	// Act + Assert
	assert.deepEqual(runPlain('image', 'a logo b', 2, 6), { text: 'a ![logo](https://) b', selected: 'https://' });
	assert.deepEqual(runPlain('image', 'https://example.com/a.png', 0, 25), { text: '![alt text](https://example.com/a.png)', selected: 'alt text' });
	assert.deepEqual(runPlain('image', '', 0), { text: '![alt text](https://)', selected: 'https://' });
});

test('codeBlock fences the selected lines and removes the fences again', async (t) => {
	const cases = [
		['a = 1\nb = 2', 0, 11, '```\na = 1\nb = 2\n```', 'a = 1\nb = 2'],
		['x = 1', 5, 5, '```\nx = 1\n```', 'x = 1'],
		['text\n', 5, 5, 'text\n```\ncode\n```', 'code'],
		['```js\ncode\n```', 0, 14, 'code', 'code'],
	];
	for (const [value, start, end, text, selected] of cases) {
		await t.test(JSON.stringify(value), () => {
			// Act + Assert
			assert.deepEqual(runPlain('codeBlock', value, start, end), { text, selected });
		});
	}
});

test('table inserts a template after the current line', () => {
	// Arrange
	const template = '| Column 1 | Column 2 |\n| --- | --- |\n| Text | Text |\n';

	// Act + Assert
	assert.deepEqual(runPlain('table', 'text\nnext', 2), { text: 'text\n\n' + template + '\nnext', selected: 'Column 1' });
	assert.deepEqual(runPlain('table', '', 0), { text: template, selected: 'Column 1' });
});

test('table turns selected lines into rows, split at tabs or pipes', () => {
	// Act + Assert
	assert.equal(runPlain('table', 'Name\tAge\nAnna\t30\nBen', 0, 18).text, '| Name | Age |\n| --- | --- |\n| Anna | 30 |\n| Ben |  |');
	assert.equal(runPlain('table', 'a | b\nc | d', 0, 11).text, '| a | b |\n| --- | --- |\n| c | d |');
});

test('footnote adds the next free number at the cursor and the note at the end', () => {
	// Act + Assert
	assert.deepEqual(runPlain('footnote', 'Claim here.', 5), { text: 'Claim[^1] here.\n\n[^1]: footnote text\n', selected: 'footnote text' });
	assert.deepEqual(runPlain('footnote', 'A[^1] and B.\n\n[^1]: one\n', 11), { text: 'A[^1] and B[^2].\n\n[^1]: one\n[^2]: footnote text\n', selected: 'footnote text' });
	assert.deepEqual(runPlain('footnote', 'x source', 2, 8), { text: 'x [^1]\n\n[^1]: source\n', selected: 'source' });
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

test('resolveOptions: help link to the Markdown Guide, configurable, only safe addresses', async (t) => {
	const cases = [
		[undefined, 'https://markdownguide.offshoot.io/'],
		['https://markdownguide.offshoot.io/hacks/', 'https://markdownguide.offshoot.io/hacks/'],
		['?page=writing-pages', '?page=writing-pages'],
		['/help.html', '/help.html'],
		['help.html', 'help.html'],
		[false, null],
		['', null],
		['javascript:alert(1)', null],
		[' JavaScript:alert(1)', null],
		['data:text/html,x', null],
	];
	for (const [helpUrl, expected] of cases) {
		await t.test(String(helpUrl), () => {
			// Act + Assert
			assert.equal(resolveOptions({ helpUrl }).helpUrl, expected);
		});
	}
});

test('resolveOptions: buttons show icons unless icons is false', () => {
	// Act + Assert
	assert.equal(resolveOptions({}).icons, true);
	assert.equal(resolveOptions({ icons: false }).icons, false);
});

test('resolveOptions: the HTML download is opt-in and needs a file name and a render function', () => {
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

test('documentTitle and htmlDocument stay fast on long unusual input (no ReDoS)', () => {
	// Arrange
	const n = 100000;
	const backslash = String.fromCharCode(92);

	// Act
	const start = Date.now();
	documentTitle('# ' + ' '.repeat(n) + 'x');
	documentTitle('# ' + '[]('.repeat(n));
	documentTitle('# ' + ('[' + backslash).repeat(n));
	documentTitle('#' + '\t'.repeat(n) + '#a');
	htmlDocument('x' + ' '.repeat(n) + 'y', { head: 'a' + ' '.repeat(n) + 'b' });

	// Assert
	assert.ok(Date.now() - start < 1000, `took ${Date.now() - start} ms`);
});

test('documentTitle removes links, closing hashes and inline marks', () => {
	// Act + Assert
	assert.equal(documentTitle('# A [b](c) ![d](e) [x] ##'), 'A b d [x]');
	assert.equal(documentTitle('# C#'), 'C#');
	assert.equal(documentTitle('# #'), '');
});

const page = htmlDocument('<main id="main">\n<h1>A &amp; B</h1>\n<p class="x y">Hi</p>\n<pre>a  b</pre>\n</main>', {
	title: 'Page',
	lang: 'de',
	head: '<link rel="stylesheet" href="site.css">',
});

test('compareHtml: the same document is the same', () => {
	// Act + Assert
	assert.deepEqual(JSON.parse(JSON.stringify(compareHtml(page, page))), { same: true, differences: [] });
});

test('compareHtml ignores formatting that does not change the content', async (t) => {
	const cases = [
		['line endings', page.replace(/\n/g, '\r\n')],
		['whitespace between tags', page.replace(/>\n</g, '>\n    \n<')],
		['comments', page.replace('<h1>', '<!-- generated -->\n<h1>')],
		['attribute order', page.replace('<link rel="stylesheet" href="site.css">', '<link href="site.css" rel="stylesheet">')],
		['class order', page.replace('class="x y"', 'class="y  x"')],
		['entity spelling', page.replace('A &amp; B', 'A &#38; B')],
		['quotes and case', page.replace('<p class="x y">', "<P CLASS='x y'>").replace('</p>', '</P>')],
		['self-closing void elements', page.replace('<meta charset="utf-8">', '<meta charset="utf-8" />')],
	];
	for (const [name, actual] of cases) {
		await t.test(name, () => {
			// Act + Assert
			assert.equal(compareHtml(page, actual).same, true);
		});
	}
});

test('compareHtml reports the first difference of each part with its path', () => {
	// Arrange
	const actual = page.replace('Hi', 'Hallo').replace('site.css', 'other.css').replace('<title>Page', '<title>Seite').replace('lang="de"', 'lang="en"');

	// Act
	const result = compareHtml(page, actual);

	// Assert
	assert.equal(result.same, false);
	assert.deepEqual(JSON.parse(JSON.stringify(result.differences)), [
		{ part: 'lang', path: '', expected: 'de', actual: 'en' },
		{ part: 'title', path: '', expected: 'Page', actual: 'Seite' },
		{ part: 'head', path: '', expected: '<link href="site.css" rel="stylesheet">', actual: '<link href="other.css" rel="stylesheet">' },
		{ part: 'body', path: 'main > p', expected: 'Hi', actual: 'Hallo' },
	]);
});

test('compareHtml keeps whitespace inside pre and reports missing content', () => {
	// Act
	const spaces = compareHtml(page, page.replace('a  b', 'a b'));
	const shorter = compareHtml(page, page.replace('<pre>a  b</pre>\n', ''));

	// Assert
	assert.equal(spaces.differences[0].path, 'main > pre');
	assert.deepEqual(JSON.parse(JSON.stringify(shorter.differences)), [{ part: 'body', path: 'main', expected: '<pre>', actual: '</main>' }]);
});

test('compareHtml with select compares only that element of the body', () => {
	// Arrange
	const wrapped = page.replace('<main id="main">', '<header>Site</header>\n<main id="main">').replace('</main>', '</main>\n<footer>Links</footer>');

	// Act + Assert
	assert.equal(compareHtml(page, wrapped).same, false);
	assert.equal(compareHtml(page, wrapped, { select: 'main' }).same, true);
	assert.equal(compareHtml(page, wrapped, { select: '#main' }).same, true);
	assert.equal(compareHtml(page, wrapped, { select: 'main#main' }).same, true);
	assert.deepEqual(JSON.parse(JSON.stringify(compareHtml(page, '<p>x</p>', { select: 'main' }).differences.pop())), { part: 'body', path: '', expected: 'main', actual: null });
	assert.throws(() => compareHtml(page, page, { select: 'main p' }), /unsupported selector/);
});

test('compareHtml works with fragments and broken HTML', () => {
	// Act + Assert
	assert.equal(compareHtml('<p>a</p>', '<p>a</p>\n').same, true);
	assert.equal(compareHtml('<p>a < b</p>', '<p>a &lt; b</p>').same, true);
	assert.equal(compareHtml('<p>a', '<p>a').same, true);
	assert.equal(compareHtml('<p title="x>y">a</p>', '<p title="x&gt;y">a</p>').same, true);
	assert.equal(compareHtml('<script>if (a<b) x()</script>', '<script>\nif (a<b) x()\n</script>').same, true);
});

test('compareHtml stays fast on long or broken input (no ReDoS)', () => {
	// Arrange
	const n = 100000;
	const inputs = ['<'.repeat(n), '<a '.repeat(n), '<p title="'.repeat(n), '&#'.repeat(n), '<script>'.repeat(n), ' '.repeat(n) + 'x'];

	// Act
	const start = Date.now();
	inputs.forEach((html) => compareHtml(html, html + 'x'));

	// Assert
	assert.ok(Date.now() - start < 2000, `took ${Date.now() - start} ms`);
});

test('compareHtml with select uses the whole body of a generated document without that element', () => {
	// Arrange
	const generated = htmlDocument('<h1>Title</h1>\n<p>Text</p>', { title: 'T' });
	const file = htmlDocument('<header>Site</header>\n<main>\n<h1>Title</h1>\n<p>Text</p>\n</main>\n<footer>Links</footer>', { title: 'T' });

	// Act + Assert
	assert.equal(compareHtml(generated, file, { select: 'main' }).same, true);
	assert.equal(compareHtml(generated, file.replace('Text', 'Edited'), { select: 'main' }).differences[0].path, 'p');
});
