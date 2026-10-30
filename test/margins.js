'use strict';
// The margins (B11): the paper's own, a style's, or the writer's four, read once and set alike in the .docx, the
// PDF's options and the table and picture widths. src/core/export-page.ts is bundled in memory (test/bundle.js).
//
//   node test/margins.js
const { bundle, tally } = require('./bundle');

const { is, done } = tally();
const { wsLengthTwips, wsParseMargins, wsMarginsOf, wsHeaderDistances, wsPaperMicrons, wsPaperOf, wsBuildDocx, wsTable } = bundle('src/core/export-page.ts');
const sides = (m) => [m.top, m.right, m.bottom, m.left].join(' ');

// a length as a writer types it
is('1in', wsLengthTwips('1in'), 1440);
is('2.54cm is an inch', wsLengthTwips('2.54cm'), 1440);
is('a comma for the decimal', wsLengthTwips('2,5 cm'), 1417);
is('mm', wsLengthTwips('25.4mm'), 1440);
is('pt', wsLengthTwips('72pt'), 1440);
is('a bare 0', wsLengthTwips('0'), 0);
is('a number with no unit is no length', wsLengthTwips('3'), null);
is('a word is no length', wsLengthTwips('wide'), null);

// as CSS's margin reads one to four
is('one for every side', sides(wsParseMargins('1in')), '1440 1440 1440 1440');
is('two: top and bottom, the sides', sides(wsParseMargins('1in 2in')), '1440 2880 1440 2880');
is('three: top, the sides, bottom', sides(wsParseMargins('1in 2in 3in')), '1440 2880 4320 2880');
is('four: top, right, bottom, left', sides(wsParseMargins('3cm 2cm 2cm 3cm')), '1701 1134 1134 1701');
is('five is too many', wsParseMargins('1in 1in 1in 1in 1in'), null);
is('one bad length spoils them', wsParseMargins('3cm 2 2cm 3cm'), null);

// an export's
is('the paper\'s own: Letter, an inch', sides(wsMarginsOf({})), '1440 1440 1440 1440');
is('the paper\'s own: digest, three quarters', sides(wsMarginsOf({ paperId: 'digest' })), '1080 1080 1080 1080');
is('ABNT on A4', sides(wsMarginsOf({ paperId: 'a4', margins: 'abnt' })), '1701 1134 1134 1701');
is('an inch on digest', sides(wsMarginsOf({ paperId: 'digest', margins: '1in' })), '1440 1440 1440 1440');
is('the writer\'s own', sides(wsMarginsOf({ margins: 'custom', marginsCustom: '2cm 2cm 2cm 4cm' })), '1134 1134 1134 2268');
is('the writer\'s, not lengths: the paper\'s', sides(wsMarginsOf({ margins: 'custom', marginsCustom: 'wide' })), '1440 1440 1440 1440');
is('custom with nothing typed: the paper\'s', sides(wsMarginsOf({ margins: 'custom' })), '1440 1440 1440 1440');
is('an unknown preset: the paper\'s', sides(wsMarginsOf({ margins: 'huge' })), '1440 1440 1440 1440');
is('less than an inch of text left: the paper\'s', sides(wsMarginsOf({ paperId: 'pocket', margins: 'custom', marginsCustom: '2in' })), '720 720 720 720');

// Word's header and footer: half an inch as ever, half the margin with the writer's
is('header: the paper\'s own', JSON.stringify(wsHeaderDistances({ paperId: 'digest' })), '{"header":720,"footer":720}');
is('header: ABNT', JSON.stringify(wsHeaderDistances({ paperId: 'a4', margins: 'abnt' })), '{"header":851,"footer":567}');

// the PDF's options, in inches
const pdf = wsPaperMicrons(wsPaperOf({ paperId: 'a4' }), wsMarginsOf({ paperId: 'a4', margins: 'abnt' })).margins;
is('PDF: ABNT top', pdf.top.toFixed(3), (1701 / 1440).toFixed(3));
is('PDF: ABNT right', pdf.right.toFixed(3), (1134 / 1440).toFixed(3));
is('PDF: the paper\'s own with no margins given', wsPaperMicrons(wsPaperOf({})).margins.left, 1);

// the .docx: its sections' margins, its table across the text's width
const docx = (o) => Buffer.from(wsBuildDocx([{ title: 'One', markdown: 'Text.', path: 'one.md', depth: 1 }], Object.assign({ format: 'docx' }, o))).toString('latin1');
is('docx: the paper\'s own, as before', /<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"\/>/.test(docx({})), true);
is('docx: ABNT', /<w:pgMar w:top="1701" w:right="1134" w:bottom="1134" w:left="1701" w:header="851" w:footer="567" w:gutter="0"\/>/.test(docx({ paperId: 'a4', margins: 'abnt' })), true);
is('docx: the title page\'s section too', (docx({ paperId: 'a4', margins: 'abnt', titlePage: true }).match(/<w:pgMar w:top="1701"/g) || []).length, 2);
is('docx: a table across ABNT\'s text width', /<w:tblW w:w="9070"/.test(wsTable([['a', 'b']], { paperId: 'a4', margins: 'abnt' })), true);

done();
