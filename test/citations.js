'use strict';
// The citer over a small library: what a style prints in the text and in the
// list. src/core/citations.ts is bundled in memory and loaded with the same
// stand-in for the `obsidian` package the smoke test uses.
//
//   node test/citations.js
const path = require('path');
const Module = require('module');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const is = (what, got, want) => {
	if (got === want) { pass++; return; }
	fail++;
	console.log('  FAIL ' + what + ': got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want));
};

const stub = {
	Plugin: class {}, PluginSettingTab: class {}, Setting: class {}, Modal: class {}, Menu: class {},
	MarkdownView: class {}, TFile: class {}, TFolder: class {}, ItemView: class {}, FuzzySuggestModal: class {},
	Notice: class {}, Component: class {}, Events: class {},
	setIcon() {}, addIcon() {}, sanitizeHTMLToDom() {}, normalizePath: (p) => p, Platform: {},
};
const load = Module._load;
Module._load = function (request) {
	if (request === 'obsidian') return stub;
	if (/^@codemirror\//.test(request)) return {};
	return load.apply(this, arguments);
};

const built = esbuild.buildSync({
	entryPoints: [path.join(ROOT, 'src/core/citations.ts')], bundle: true, platform: 'node', format: 'cjs',
	write: false, external: ['obsidian', '@codemirror/*'], logLevel: 'error',
});
const m = new Module(path.join(ROOT, 'src/core/citations.js'));
m.filename = m.id;
m.paths = Module._nodeModulePaths(ROOT);
m._compile(built.outputFiles[0].text, m.filename);
const { wsParseBibtex, wsParseCslJson, wsFindCitations, wsCiter, wsCiteTermsFor, wsCiteSections, wsCiteEntryText } = m.exports;

const lib = wsParseBibtex(`
@book{smith2020a, author={Smith, John}, title={First Book}, year={2020}, publisher={X}}
@book{smith2020b, author={Smith, John}, title={Second Book}, year={2020}, publisher={Y}}
@book{avila, author={{\\'A}vila, Ana}, title={Livro}, year={2019}, edition={2}, publisher={Z}}
@book{zeta, author={Zeta, Zed}, title={Z}, year={2019}, publisher={Z}}
@book{brown, author={Brown, Bob}, title={B}, year={2018}, publisher={Z}}
@phdthesis{silva, author={Silva, Maria}, title={Uma tese}, year={2021}, school={UFPE}}
@thesis{costa, author={Costa, Rui}, title={Estudo}, year={2022}, type={Disserta\\c{c}\\~ao (Mestrado)}, institution={CESAR School}}
@article{lee, author={Lee, Min}, title={An Article}, journal={J}, year={2020}, volume={3}, pages={1--9}}
`);

// one bracketed citation, in a style and a language, as the export writes it
const cite = (style, text, lang) => {
	const citer = wsCiter(style, lib, null, '', wsCiteTermsFor(lang || 'en'));
	return (citer.cite(wsFindCitations(text)[0]) || {}).text;
};
// a whole manuscript: its text and its list
const book = (style, text, lang) => {
	const sections = [{ title: 'One', markdown: text, path: 'one.md', depth: 1 }];
	wsCiteSections(sections, wsCiter(style, lib, null, '', wsCiteTermsFor(lang || 'en')));
	return { text: sections[0].markdown, list: (sections[1] && sections[1].entries) || [] };
};

// B1: the same author in the same year, lettered in the text and in the list
for (const style of ['apa', 'harvard', 'chicago-ad']) {
	const b = book(style, '[@smith2020b] and [@smith2020a].', 'en');
	is(style + ': a shared year takes letters in the text', /2020b\)? and .*2020a/.test(b.text), true);
	is(style + ': …and in the list', b.list.filter((e) => /2020[ab]/.test(e)).length, 2);
}
is('apa: a year shared with no one keeps no letter', book('apa', '[@zeta] [@brown]').text, '(Zeta, 2019) (Brown, 2018)');
is('ieee: a numbered style letters nothing', book('ieee', '[@smith2020a] [@smith2020b]').list.some((e) => /2020[ab]/.test(e)), false);

// B2, B3, B8: the locator's word
is('apa: chapter 3 is chap. 3', cite('apa', '[@lee, chapter 3]'), '(Lee, 2020, chap. 3)');
is('harvard: section 2 is sec. 2', cite('harvard', '[@lee, section 2]'), '(Lee, 2020, sec. 2)');
is('apa: p. 12-15 is pages', cite('apa', '[@lee, p. 12-15]'), '(Lee, 2020, pp. 12–15)');
is('apa: a bare 12 is a page', cite('apa', '[@lee, 12]'), '(Lee, 2020, p. 12)');
is('apa: cap. 3 is a chapter, in Portuguese', cite('apa', '[@lee, cap. 3]', 'pt-BR'), '(Lee, 2020, cap. 3)');
is('chicago-ad: cap. 3 in English is chap. 3', cite('chicago-ad', '[@lee, cap. 3]'), '(Lee 2020, chap. 3)');
is('apa: S. 12 is a page', cite('apa', '[@lee, S. 12]', 'de'), '(Lee, 2020, p. 12)');
is('apa: an unknown word prints as written', cite('apa', '[@lee, art. 5]'), '(Lee, 2020, art. 5)');
is('mla: chapter is ch. in English', cite('mla', '[@lee, chapter 3]'), '(Lee, ch. 3)');

// B4: the list in the book's alphabet
const order = book('apa', '[@zeta] [@avila] [@brown]', 'pt-BR').list.map((e) => e.split(',')[0]);
is('apa: Ávila sorts with the A\'s', order.join(' '), 'Ávila Brown Zeta');

// B5: a CSL-JSON item's citation key over its Zotero id
const csl = wsParseCslJson(JSON.stringify([
	{ id: 'http://zotero.org/users/1/items/ABC', 'citation-key': 'doe2020', type: 'book', title: 'T' },
	{ id: 'http://zotero.org/users/1/items/DEF', note: 'Citation Key: roe2021', type: 'book', title: 'U' },
	{ id: 'bbt2022', type: 'book', title: 'V' },
]));
is('csl: the keys are the ones written', Array.from(csl.keys()).join(' '), 'doe2020 roe2021 bbt2022');

// B6: the hover's entry in the book's language
is('hover: the edition in Portuguese', wsCiteEntryText('chicago-ad', lib.get('avila'), null, wsCiteTermsFor('pt-BR')), 'Ávila, Ana. 2019. Livro. 2.ª ed. Z.');
is('hover: English with no terms', wsCiteEntryText('chicago-ad', lib.get('avila')), 'Ávila, Ana. 2019. Livro. 2nd ed. Z.');

// B7: APA's sources in one parenthesis in the list's order, a prefix keeping the writer's
is('apa: several sources alphabetical', cite('apa', '[@zeta; @brown]'), '(Brown, 2018; Zeta, 2019)');
is('apa: a prefix keeps the order', cite('apa', '[see @zeta; @brown]'), '(see Zeta, 2019; Brown, 2018)');
is('chicago-ad: the writer\'s order', cite('chicago-ad', '[@zeta; @brown]'), '(Zeta 2019; Brown 2018)');

// B9: theses
const entry = (style, key, lang) => book(style, '[@' + key + ']', lang).list[0];
is('apa: a doctoral thesis', entry('apa', 'silva'), 'Silva, M. (2021). *Uma tese* [Doctoral dissertation, UFPE].');
is('apa: in Portuguese', entry('apa', 'silva', 'pt-BR'), 'Silva, M. (2021). *Uma tese* [Tese (Doutorado), UFPE].');
is('apa: the library\'s own words', entry('apa', 'costa', 'pt-BR'), 'Costa, R. (2022). *Estudo* [Dissertação (Mestrado), CESAR School].');
is('chicago-ad: a doctoral thesis', entry('chicago-ad', 'silva'), 'Silva, Maria. 2021. “Uma tese.” PhD diss., UFPE.');
is('harvard: a doctoral thesis', entry('harvard', 'silva'), 'Silva, M. (2021) *Uma tese*. PhD thesis. UFPE.');
is('mla: a doctoral thesis', entry('mla', 'silva'), 'Silva, Maria. *Uma tese*. 2021. UFPE, PhD dissertation.');
is('chicago-notes: a thesis note', /Maria Silva, “Uma tese” \(PhD diss\., UFPE, 2021\), 4\./.test(book('chicago-notes', 'As she says [@silva, 4].').text), true);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
