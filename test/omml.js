'use strict';
// Math for Word (B10): MathJax's MathML, as Obsidian's MathJax writes it, turned into Office Math, and a .docx
// carrying it. src/core/omml.ts and src/core/export-page.ts are bundled in memory (test/bundle.js).
//
//   node test/omml.js
const { bundle, tally } = require('./bundle');

const { is, done } = tally();
const has = (what, text, bit) => is(what + ' (' + bit + ')', String(text).indexOf(bit) !== -1, true);
const { wsMathmlToOmml, wsParseMathml } = bundle('src/core/omml.ts');
const { wsBuildDocx } = bundle('src/core/export-page.ts');

// MathJax 3's tex2mml, display or inline as the TeX names
const MML = {
	sum: '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><munderover><mo data-mjx-texclass="OP">&#x2211;</mo><mrow data-mjx-texclass="ORD"><mi>i</mi><mo>=</mo><mn>1</mn></mrow><mrow data-mjx-texclass="ORD"><mi>n</mi></mrow></munderover><msubsup><mi>x</mi><mi>i</mi><mn>2</mn></msubsup><mo>=</mo><mfrac><mi>a</mi><mi>b</mi></mfrac></math>',
	int: '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow data-mjx-texclass="INNER"><mo data-mjx-texclass="OPEN">(</mo><msubsup><mo data-mjx-texclass="OP">&#x222B;</mo><mn>0</mn><mn>1</mn></msubsup><mi>f</mi><mo stretchy="false">(</mo><mi>x</mi><mo stretchy="false">)</mo><mstyle scriptlevel="0"><mspace width="0.167em"></mspace></mstyle><mi>d</mi><mi>x</mi><mo data-mjx-texclass="CLOSE">)</mo></mrow></math>',
	acc: '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow data-mjx-texclass="ORD"><mover><mi>x</mi><mo stretchy="false">^</mo></mover></mrow><mo>+</mo><mover><mrow><mi>a</mi><mi>b</mi></mrow><mo accent="true">&#x2015;</mo></mover><mo>+</mo><mroot><mi>z</mi><mn>3</mn></mroot><mo>+</mo><msqrt><mi>y</mi></msqrt></math>',
	mat: '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow data-mjx-texclass="INNER"><mo data-mjx-texclass="OPEN">(</mo><mtable columnspacing="1em" rowspacing="4pt"><mtr><mtd><mi>a</mi></mtd><mtd><mi>b</mi></mtd></mtr><mtr><mtd><mi>c</mi></mtd><mtd><mi>d</mi></mtd></mtr></mtable><mo data-mjx-texclass="CLOSE">)</mo></mrow></math>',
	tag: '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mtable displaystyle="true"><mlabeledtr><mtd id="mjx-eqn:1"><mtext>(1)</mtext></mtd><mtd><mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup></mtd></mlabeledtr></mtable></math>',
	al: '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mtable displaystyle="true" columnalign="right left" columnspacing="0em" rowspacing="3pt"><mtr><mtd><mi>a</mi></mtd><mtd><mi></mi><mo>=</mo><mi>b</mi></mtd></mtr><mtr><mtd><mi>c</mi></mtd><mtd><mi></mi><mo>=</mo><mi>d</mi></mtd></mtr></mtable></math>',
	lim: '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><munder><mo data-mjx-texclass="OP" movablelimits="true">lim</mo><mrow data-mjx-texclass="ORD"><mi>n</mi><mo accent="false" stretchy="false">&#x2192;</mo><mi mathvariant="normal">&#x221E;</mi></mrow></munder><mfrac><mn>1</mn><mi>n</mi></mfrac><mo>=</mo><mn>0</mn></math>',
	bb: '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi><mo>&#x2208;</mo><mrow data-mjx-texclass="ORD"><mi mathvariant="double-struck">R</mi></mrow></math>',
	binom: '<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow data-mjx-texclass="ORD"><mrow data-mjx-texclass="OPEN"><mo minsize="1.2em" maxsize="1.2em">(</mo></mrow><mfrac linethickness="0"><mi>n</mi><mi>k</mi></mfrac><mrow data-mjx-texclass="CLOSE"><mo minsize="1.2em" maxsize="1.2em">)</mo></mrow></mrow></math>',
	brace: '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><munder><mrow data-mjx-texclass="OP"><munder><mrow><mi>a</mi><mo>+</mo><mi>b</mi></mrow><mo>&#x23DF;</mo></munder></mrow><mrow data-mjx-texclass="ORD"><mi>c</mi></mrow></munder></math>',
	text: '<math xmlns="http://www.w3.org/1998/Math/MathML"><mtext>se&#xA0;</mtext><mi>x</mi></math>',
};
const omml = (k, display) => wsMathmlToOmml(MML[k], display !== false);

is('nothing to read is nothing', wsMathmlToOmml('<p>not math</p>', true), '');
is('the tree reads entities', wsParseMathml('<math><mo>&#x2211;</mo></math>').kids[0].text, '\u2211');

const sum = omml('sum');
has('a display formula is a centered paragraph of math', sum, '<m:oMathPara><m:oMathParaPr><m:jc m:val="center"/>');
has('a sum is an n-ary', sum, '<m:chr m:val="\u2211"/><m:limLoc m:val="undOvr"/>');
is('…its operand, up to the equals sign', /<m:e><m:sSubSup>[\s\S]*?<\/m:sSubSup><\/m:e><\/m:nary><m:r>[\s\S]*?=<\/m:t>/.test(sum), true);
has('a fraction', sum, '<m:f><m:num>');
has('a letter leans, as Word sets it', sum, '<m:r><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr><m:t xml:space="preserve">x</m:t></m:r>');

const integral = omml('int');
has('\left( \right) is a delimiter', integral, '<m:d><m:dPr><m:begChr m:val="("/><m:endChr m:val=")"/>');
has('an integral is an n-ary with limits beside it', integral, '<m:chr m:val="\u222B"/><m:limLoc m:val="subSup"/>');
has('a thin space', integral, '\u2009');

const acc = omml('acc');
has('a hat is an accent', acc, '<m:acc><m:accPr><m:chr m:val="\u0302"/>');
has('an overline is a bar', acc, '<m:bar><m:barPr><m:pos m:val="top"/>');
has('a cube root has its degree', acc, '<m:rad><m:deg>');
has('a square root hides its degree', acc, '<m:degHide m:val="1"/>');

const mat = omml('mat');
has('a matrix', mat, '<m:m><m:mPr><m:mcs>');
is('…two rows of two', (mat.match(/<m:mr>/g) || []).length + ':' + (mat.match(/<m:mr><m:e>[\s\S]*?<\/m:e><m:e>/g) || []).length, '2:2');

const tag = omml('tag');
has('an equation keeps its number', tag, '(1)</m:t>');
is('…with no matrix around it', tag.indexOf('<m:m>'), -1);

const al = omml('al');
has('aligned equations are an equation array', al, '<m:eqArr>');
has('…lined up at the &', al, '<m:aln/>');

has('lim is a function with its operand', omml('lim'), '<m:func><m:funcPr>');
is('…which ends before the equals sign', /<\/m:e><\/m:func><m:r>[\s\S]*?=<\/m:t>/.test(omml('lim')), true);
has('\mathbb{R} is the letter Unicode writes', omml('bb', false), '\u211D');
is('an inline formula is no paragraph', /^<m:oMath>/.test(omml('bb', false)), true);
has('\binom has no bar', omml('binom', false), '<m:type m:val="noBar"/>');
has('an underbrace is a group character', omml('brace'), '<m:groupChr><m:groupChrPr><m:chr m:val="\u23DF"/><m:pos m:val="bot"/>');
has('\text is the paragraph\'s own text', omml('text', false), '<m:rPr><m:nor/></m:rPr><m:t xml:space="preserve">se');

// THE .DOCX: the formulas as Word's math, in the text and on a line of their own, the namespace declared
const md = 'Inline $x \\in \\mathbb{R}$ here.\n\n$$\\sum_{i=1}^{n} x_i^2 = \\frac{a}{b}$$\n\n$$\\unknown$$\n';
const math = new Map([['I\nx \\in \\mathbb{R}', MML.bb], ['D\n\\sum_{i=1}^{n} x_i^2 = \\frac{a}{b}', MML.sum]]);
const docx = Buffer.from(wsBuildDocx([{ title: 'One', markdown: md, path: 'one.md', depth: 1 }], { format: 'docx', figures: { math, mermaid: new Map() } })).toString('latin1');
has('docx: the math namespace', docx, 'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"');
has('docx: an inline formula between the words', docx, 'Inline </w:t></w:r><m:oMath>');
has('docx: a display formula', docx, '<m:oMathPara>');
has('docx: a formula with no MathML stays as written', docx, '\\unknown');
const plain = Buffer.from(wsBuildDocx([{ title: 'One', markdown: md, path: 'one.md', depth: 1 }], { format: 'docx' })).toString('latin1');
is('docx: no figures, no math', plain.indexOf('<m:oMath'), -1);
has('docx: …the TeX as written', plain, '$x \\in \\mathbb{R}$');

done();
