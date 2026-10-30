'use strict';
// The citer over a small library: what a style prints in the text and in the
// list. src/core/citations.ts is bundled in memory (test/bundle.js).
//
//   node test/citations.js
const { bundle, tally } = require('./bundle');

const { is, done } = tally();
const { wsParseBibtex, wsParseCslJson, wsFindCitations, wsCiter, wsCiteTermsFor, wsCiteSections, wsCiteEntryText } = bundle('src/core/citations.ts');

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

// ABNT: NBR 10520:2023 in the text, NBR 6023:2018 in the list, in Brazilian Portuguese whatever the book's language
const abnt = wsParseBibtex(String.raw`
@book{gil, author={Gil, Antonio Carlos}, title={Como elaborar projetos de pesquisa}, year={2017}, edition={6}, publisher={Atlas}, address={S{\~a}o Paulo}}
@book{gil2, author={Gil, Antonio Carlos}, title={M{\'e}todos e t{\'e}cnicas de pesquisa social}, year={2019}, edition={7}, publisher={Atlas}, address={S{\~a}o Paulo}}
@article{ml, author={Marconi, Marina de Andrade and Lakatos, Eva Maria}, title={Fundamentos de metodologia}, journal={Revista X}, volume={12}, number={3}, pages={10--25}, year={2020}, doi={10.1590/abc.123}}
@incollection{cap, author={Souza, Jo{\~a}o}, title={Um cap{\'i}tulo}, booktitle={Livro organizado: estudos}, editor={Lima, Ana}, publisher={Vozes}, address={Petr{\'o}polis}, year={2018}, pages={33--50}}
@phdthesis{tese, author={Silva, Maria}, title={{\'E}tica em IA: um estudo}, school={UFPE}, address={Recife}, year={2021}}
@online{web, author={{Brasil}}, title={Lei Geral de Prote{\c c}{\~a}o de Dados}, url={https://www.gov.br/lgpd}, urldate={2026-10-13}, year={2018}}
@book{four, author={A, Ana and B, Bia and C, Caio and D, Davi}, title={Quatro}, year={2022}, publisher={Ed}}
@book{bare, author={Costa, Rui}, title={Sem editora}}
@book{anon, title={Manual de normaliza{\c c}{\~a}o}, year={2020}, publisher={UFPE}, address={Recife}}`);
const abntBook = (text, lang, upper) => {
	const sections = [{ title: 'One', markdown: text, path: 'one.md', depth: 1 }];
	wsCiteSections(sections, wsCiter('abnt', abnt, null, '', wsCiteTermsFor(lang || 'pt-BR'), { abntUpper: !!upper }));
	return { text: sections[0].markdown, list: (sections[1] && sections[1].entries) || [], head: sections[1] && sections[1].title, flush: sections[1] && sections[1].flush };
};
is('abnt: a page, its range with a hyphen', abntBook('[@gil, p. 12-15]').text, '(Gil, 2017, p. 12-15)');
is('abnt: in a sentence', abntBook('@gil says').text, 'Gil (2017) says');
is('abnt: two authors, a semicolon', abntBook('[@ml]').text, '(Marconi; Lakatos, 2020)');
is('abnt: two authors in a sentence, "e"', abntBook('@ml').text, 'Marconi e Lakatos (2020)');
is('abnt: four, et al.', abntBook('[@four]').text, '(A et al., 2022)');
is('abnt: alphabetical, one author\'s years together', abntBook('[@ml; @gil2; @gil]').text, '(Gil, 2017, 2019; Marconi; Lakatos, 2020)');
is('abnt: a chapter in Portuguese, in an English book', abntBook('[@gil, chapter 3]', 'en').text, '(Gil, 2017, cap. 3)');
is('abnt: no year', abntBook('[@bare]').text, '(Costa, [s. d.])');
is('abnt: no author, the title\'s first word', abntBook('[@anon]').text, '(Manual [...], 2020)');
is('abnt: 2002\'s capitals, a switch', abntBook('[@ml] and @ml', 'pt-BR', true).text, '(MARCONI; LAKATOS, 2020) and Marconi e Lakatos (2020)');
const all = abntBook('[@gil] [@ml] [@cap] [@tese] [@web] [@four] [@bare] [@anon]');
is('abnt: the list\'s heading', all.head, 'REFERÊNCIAS');
is('abnt: the list at the margin', all.flush, true);
const entryOfKey = (k) => all.list.find((e) => e.indexOf(k) === 0) || '';
is('abnt: a book', entryOfKey('GIL'), 'GIL, Antonio Carlos. **Como elaborar projetos de pesquisa**. 6. ed. São Paulo: Atlas, 2017.');
is('abnt: an article', entryOfKey('MARCONI'), 'MARCONI, Marina de Andrade; LAKATOS, Eva Maria. Fundamentos de metodologia. **Revista X**, v. 12, n. 3, p. 10-25, 2020. DOI: 10.1590/abc.123.');
is('abnt: a chapter', entryOfKey('SOUZA'), 'SOUZA, João. Um capítulo. In: LIMA, Ana (org.). **Livro organizado**: estudos. Petrópolis: Vozes, 2018. p. 33-50.');
is('abnt: a thesis', entryOfKey('SILVA'), 'SILVA, Maria. **Ética em IA**: um estudo. 2021. Tese (Doutorado) – UFPE, Recife, 2021.');
is('abnt: a web page', entryOfKey('BRASIL'), 'BRASIL. **Lei Geral de Proteção de Dados**. 2018. Disponível em: https://www.gov.br/lgpd. Acesso em: 13 out. 2026.');
is('abnt: four authors', entryOfKey('A,'), 'A, Ana et al. **Quatro**. [S. l.]: Ed, 2022.');
is('abnt: no place, publisher or year', entryOfKey('COSTA'), 'COSTA, Rui. **Sem editora**. [S. l.: s. n.], [s. d.].');
is('abnt: no author', entryOfKey('MANUAL'), 'MANUAL de normalização. Recife: UFPE, 2020.');
is('abnt: the hover in Portuguese, in an English book', wsCiteEntryText('abnt', abnt.get('gil'), null, wsCiteTermsFor('en')), 'GIL, Antonio Carlos. Como elaborar projetos de pesquisa. 6. ed. São Paulo: Atlas, 2017.');

// …and the Word file sets ABNT's list at the margin, single spaced, where the others hang
const { wsBuildDocx } = bundle('src/core/export-page.ts');
const listed = (flush) => Buffer.from(wsBuildDocx([{ title: 'One', markdown: 'Text.', path: 'one.md', depth: 1 },
	{ title: 'REFERÊNCIAS', markdown: 'GIL. Livro.', path: '', depth: 0, bib: true, entries: ['GIL. **Livro**.'], flush }], { format: 'docx' })).toString('latin1');
is('docx: ABNT\'s list single spaced', /<w:spacing w:before="0" w:after="240" w:line="240" w:lineRule="auto"\/><w:ind w:firstLine="0"\/>/.test(listed(true)), true);
is('docx: another style\'s list hangs', /<w:ind w:left="720" w:hanging="720"\/>/.test(listed(false)), true);

done();
