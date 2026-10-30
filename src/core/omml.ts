// Word-Smith — omml: math for Word (B10). The MathML MathJax's `tex2mml` writes for the page (#102), turned into
// Office Math, the equations Word draws and edits as its own: a fraction a fraction, a sum a sum with its limits,
// not a line of TeX in monospace. Pure, no DOM: a phone builds the .docx as a desktop does, and the tests read it.

interface WsMNode { tag: string; attrs: Record<string, string>; kids: WsMNode[]; text: string }

const WS_MML_ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: '\u00A0' };
const unent = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m: string, e: string) => {
	if (e.charAt(0) !== '#') return WS_MML_ENT[e.toLowerCase()] != null ? WS_MML_ENT[e.toLowerCase()] : m;
	const n = /^#x/i.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
	try { return String.fromCodePoint(n); } catch { return m; }
});
// a name without its prefix: mml:mi is mi
const local = (name: string) => name.slice(name.indexOf(':') + 1).toLowerCase();

/** MathML as a tree: its elements, their attributes, the text inside each, entities read. Well-formed or not, never
 * a throw: an unclosed element closes at the end. */
export function wsParseMathml(src: string): WsMNode | null {
	const root: WsMNode = { tag: '#root', attrs: {}, kids: [], text: '' };
	const stack: WsMNode[] = [root];
	const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(String(src || '')))) {
		const top = stack[stack.length - 1];
		if (m[1] != null) { top.text += m[1]; continue; }
		if (m[3]) {
			const tag = local(m[3]);
			if (m[2]) {
				for (let k = stack.length - 1; k > 0; k--) if (stack[k].tag === tag) { stack.length = k; break; }
				continue;
			}
			const attrs: Record<string, string> = {};
			const ar = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
			let a: RegExpExecArray | null;
			while ((a = ar.exec(m[4] || ''))) attrs[local(a[1])] = unent(a[2] != null ? a[2] : a[3] || '');
			const node: WsMNode = { tag, attrs, kids: [], text: '' };
			top.kids.push(node);
			if (!m[5]) stack.push(node);
			continue;
		}
		if (m[6] != null) top.text += unent(m[6]);
	}
	const find = (n: WsMNode): WsMNode | null => {
		if (n.tag === 'math') return n;
		for (const k of n.kids) { const f = find(k); if (f) return f; }
		return null;
	};
	return find(root);
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// a token's text: XML's own spaces trimmed (a no-break space is the writer's: \ in TeX), the invisible operators
// (function application, invisible times) gone, which Word would draw as a box
const tokenText = (n: WsMNode) => n.text.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '').replace(/[\u2061-\u2064]/g, '');
const CAMBRIA = '<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr>';

// MathML's mathvariant as Office Math's script and style
const VARIANT: Record<string, [string, string]> = {
	normal: ['', 'p'], bold: ['', 'b'], italic: ['', 'i'], 'bold-italic': ['', 'bi'],
	'double-struck': ['double-struck', 'p'], script: ['script', 'p'], 'bold-script': ['script', 'b'],
	fraktur: ['fraktur', 'p'], 'bold-fraktur': ['fraktur', 'b'], 'sans-serif': ['sans-serif', 'p'],
	'bold-sans-serif': ['sans-serif', 'b'], 'sans-serif-italic': ['sans-serif', 'i'], 'sans-serif-bold-italic': ['sans-serif', 'bi'],
	monospace: ['monospace', 'p'],
};

// DOUBLE-STRUCK LETTERS AS UNICODE WRITES THEM (\mathbb{R} is \u211D): every editor draws those, where a script
// only Word reads; the seven Unicode set apart first, the rest in the Mathematical Alphanumeric block
const BB_OLD: Record<string, number> = { C: 0x2102, H: 0x210D, N: 0x2115, P: 0x2119, Q: 0x211A, R: 0x211D, Z: 0x2124 };
const doubleStruck = (t: string) => Array.from(t).map((c) => {
	if (BB_OLD[c]) return String.fromCodePoint(BB_OLD[c]);
	if (/[A-Z]/.test(c)) return String.fromCodePoint(0x1D538 + c.charCodeAt(0) - 65);
	if (/[a-z]/.test(c)) return String.fromCodePoint(0x1D552 + c.charCodeAt(0) - 97);
	if (/[0-9]/.test(c)) return String.fromCodePoint(0x1D7D8 + c.charCodeAt(0) - 48);
	return c;
}).join('');

// one run of math text: `sty` p (upright), b, i, bi or none (Word's own: a letter leans), `scr` a script; `nor`, plain
// text in the paragraph's font
function run(text: string, sty: string, scr = '', nor = false): string {
	if (!text) return '';
	const pr = nor ? '<m:nor/>' : (scr ? '<m:scr m:val="' + scr + '"/>' : '') + (sty ? '<m:sty m:val="' + sty + '"/>' : '');
	return '<m:r>' + (pr ? '<m:rPr>' + pr + '</m:rPr>' : '') + (nor ? '' : CAMBRIA) + '<m:t xml:space="preserve">' + xml(text) + '</m:t></m:r>';
}

// the operators Word sets as an n-ary with its limits and its operand
const NARY = '\u2211\u220F\u2210\u222B\u222C\u222D\u222E\u222F\u2230\u22C3\u22C2\u22C1\u22C0\u2A00\u2A01\u2A02\u2A04\u2A06';
// where an n-ary's operand ends at its own level: a relation, a plus or a minus, a comma
const STOP = '=<>\u2264\u2265\u2260\u2248\u2261\u223C\u2243\u2245\u2192\u2190\u2194\u21D2\u21D4+\u2212-\u00B1\u2213,;';
// an accent's combining character, as Word wants it
const ACCENT: Record<string, string> = {
	'^': '\u0302', '\u02C6': '\u0302', '\u00AF': '\u0304', '\u02C9': '\u0304', '\u2192': '\u20D7', '\u20D7': '\u20D7',
	'\u02D9': '\u0307', '\u00A8': '\u0308', '~': '\u0303', '\u02DC': '\u0303', '\u02C7': '\u030C', '\u00B4': '\u0301',
	'`': '\u0300', '\u02D8': '\u0306', '\u02DA': '\u030A', '\u2190': '\u20D6', '\u2194': '\u20E1',
};
// a line over or under, which Word draws as a bar
const BAR = '\u2015\u203E\u0305_\u2500\u2014';

// a single node through rows of one: the operator a sum's munderover holds, the brace under a group
function only(n: WsMNode | undefined): WsMNode | undefined {
	let k = n;
	while (k && (k.tag === 'mrow' || k.tag === 'mstyle') && k.kids.length === 1) k = k.kids[0];
	return k;
}
const moText = (n: WsMNode | undefined) => { const k = only(n); return k && k.tag === 'mo' ? tokenText(k) : null; };
const texClass = (n: WsMNode | undefined) => (n ? n.attrs['data-mjx-texclass'] || '' : '');
// \left( and \right), \bigl( and \bigr): an opening or a closing fence, and its character
function fence(n: WsMNode | undefined, side: 'OPEN' | 'CLOSE'): string | null {
	if (!n) return null;
	const k = only(n);
	if (!k || k.tag !== 'mo') return null;
	if (texClass(n) === side || texClass(k) === side || (k.attrs.fence === 'true' && k.attrs.form === (side === 'OPEN' ? 'prefix' : 'postfix'))) return tokenText(k);
	return null;
}

interface WsNary { chr: string; sub: WsMNode | null; sup: WsMNode | null; under: boolean }
// a sum, a product, an integral: the operator alone, or under its limits
function naryOf(n: WsMNode): WsNary | null {
	const t = (k: WsMNode | undefined) => { const s = moText(k); return s && s.length === 1 && NARY.indexOf(s) !== -1 ? s : null; };
	if (n.tag === 'mo') { const c = t(n); return c ? { chr: c, sub: null, sup: null, under: false } : null; }
	const c = t(n.kids[0]);
	if (!c) return null;
	switch (n.tag) {
		case 'munderover': return { chr: c, sub: n.kids[1] || null, sup: n.kids[2] || null, under: true };
		case 'msubsup': return { chr: c, sub: n.kids[1] || null, sup: n.kids[2] || null, under: false };
		case 'munder': return { chr: c, sub: n.kids[1] || null, sup: null, under: true };
		case 'msub': return { chr: c, sub: n.kids[1] || null, sup: null, under: false };
		case 'mover': return { chr: c, sub: null, sup: n.kids[1] || null, under: true };
		case 'msup': return { chr: c, sub: null, sup: n.kids[1] || null, under: false };
	}
	return null;
}

// lim, max, min, sup, inf under their limits: a function Word sets with its operand, as it writes them itself
function limitOf(n: WsMNode): boolean {
	if (n.tag !== 'munder' && n.tag !== 'mover' && n.tag !== 'munderover') return false;
	const b = only(n.kids[0]);
	return !!b && (b.tag === 'mo' || b.tag === 'mi') && /^(lim|lim sup|lim inf|liminf|limsup|max|min|sup|inf|arg ?max|arg ?min)$/.test(tokenText(b));
}
// where an operand ends: the next relation, plus, minus or comma at its own level, or the row's end
function operandEnd(kids: WsMNode[], from: number): number {
	let j = from;
	while (j < kids.length) { const s = moText(kids[j]); if (s && s.length === 1 && STOP.indexOf(s) !== -1) break; j++; }
	return j;
}

// a row: its fences as one delimiter, each n-ary and each limit with the operand after it
function seq(kids: WsMNode[]): string {
	// \left( … \right) around the whole row, with no other fence at its level between them
	if (kids.length >= 2) {
		const beg = fence(kids[0], 'OPEN'), endc = fence(kids[kids.length - 1], 'CLOSE');
		const inner = kids.slice(1, -1);
		if (beg != null && endc != null && !inner.some((k) => fence(k, 'OPEN') != null || fence(k, 'CLOSE') != null)) {
			return '<m:d><m:dPr><m:begChr m:val="' + xml(beg) + '"/><m:endChr m:val="' + xml(endc) + '"/><m:ctrlPr>' + CAMBRIA + '</m:ctrlPr></m:dPr><m:e>' + seq(inner) + '</m:e></m:d>';
		}
	}
	let out = '';
	for (let i = 0; i < kids.length; i++) {
		if (limitOf(kids[i])) {
			const j = operandEnd(kids, i + 1);
			out += '<m:func><m:funcPr><m:ctrlPr>' + CAMBRIA + '</m:ctrlPr></m:funcPr><m:fName>' + conv(kids[i]) + '</m:fName><m:e>' + seq(kids.slice(i + 1, j)) + '</m:e></m:func>';
			i = j - 1;
			continue;
		}
		const nary = naryOf(kids[i]);
		if (!nary) { out += conv(kids[i]); continue; }
		const j = operandEnd(kids, i + 1);
		const pr = '<m:chr m:val="' + nary.chr + '"/><m:limLoc m:val="' + (nary.under ? 'undOvr' : 'subSup') + '"/>'
			+ (nary.sub ? '' : '<m:subHide m:val="1"/>') + (nary.sup ? '' : '<m:supHide m:val="1"/>');
		out += '<m:nary><m:naryPr>' + pr + '<m:ctrlPr>' + CAMBRIA + '</m:ctrlPr></m:naryPr><m:sub>' + (nary.sub ? conv(nary.sub) : '') + '</m:sub><m:sup>'
			+ (nary.sup ? conv(nary.sup) : '') + '</m:sup><m:e>' + seq(kids.slice(i + 1, j)) + '</m:e></m:nary>';
		i = j - 1;
	}
	return out;
}

const arg = (n: WsMNode | undefined) => (n ? conv(n) : '');
// an em space or less for \, \; \quad and \qquad
function space(n: WsMNode): string {
	const w = /^(-?[\d.]+)(em|ex|pt|px|mu)?$/.exec(String(n.attrs.width || '').trim());
	if (!w) return '';
	const em = Number(w[1]) * (w[2] === 'ex' ? 0.5 : w[2] === 'pt' || w[2] === 'px' ? 0.1 : w[2] === 'mu' ? 1 / 18 : 1);
	if (em <= 0.05) return '';
	if (em >= 1.9) return run('\u2003\u2003', 'p');
	return run(em >= 0.9 ? '\u2003' : em >= 0.4 ? '\u2002' : em >= 0.25 ? '\u2005' : '\u2009', 'p');
}

function conv(n: WsMNode): string {
	const k = n.kids;
	switch (n.tag) {
		case 'math': case 'mrow': case 'mstyle': case 'mpadded': case 'merror': case 'mtd':
			return seq(k);
		case 'semantics': return k.length ? conv(k[0]) : '';
		case 'annotation': case 'annotation-xml': case 'none': case 'mprescripts': case 'maligngroup': case 'malignmark': case 'mglyph':
			return '';
		case 'mi': {
			const t = tokenText(n);
			if (n.attrs.mathvariant === 'double-struck') return run(doubleStruck(t), 'p');
			const v = VARIANT[n.attrs.mathvariant || ''];
			if (v) return run(t, v[1], v[0]);
			// one letter leans, as Word sets it; a name (sin, log) stands upright
			return run(t, Array.from(t).length > 1 ? 'p' : '');
		}
		case 'mn': case 'mo': {
			const v = VARIANT[n.attrs.mathvariant || ''];
			return run(tokenText(n), v ? v[1] : 'p', v ? v[0] : '');
		}
		case 'mtext': return run(tokenText(n), '', '', true);
		case 'ms': return run('"' + tokenText(n) + '"', '', '', true);
		case 'mspace': return space(n);
		case 'msup': return '<m:sSup><m:e>' + arg(k[0]) + '</m:e><m:sup>' + arg(k[1]) + '</m:sup></m:sSup>';
		case 'msub': return '<m:sSub><m:e>' + arg(k[0]) + '</m:e><m:sub>' + arg(k[1]) + '</m:sub></m:sSub>';
		case 'msubsup': return '<m:sSubSup><m:e>' + arg(k[0]) + '</m:e><m:sub>' + arg(k[1]) + '</m:sub><m:sup>' + arg(k[2]) + '</m:sup></m:sSubSup>';
		case 'mfrac': {
			// \binom's fraction has no bar
			const none = /^0(\.0*)?([a-z]+)?$/i.test(String(n.attrs.linethickness || '').trim());
			return '<m:f>' + (none ? '<m:fPr><m:type m:val="noBar"/></m:fPr>' : '') + '<m:num>' + arg(k[0]) + '</m:num><m:den>' + arg(k[1]) + '</m:den></m:f>';
		}
		case 'msqrt': return '<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>' + seq(k) + '</m:e></m:rad>';
		case 'mroot': return '<m:rad><m:deg>' + arg(k[1]) + '</m:deg><m:e>' + arg(k[0]) + '</m:e></m:rad>';
		case 'mover': case 'munder': {
			const over = n.tag === 'mover';
			const mark = moText(k[1]);
			if (mark && mark.length === 1) {
				if (mark === (over ? '\u23DE' : '\u23DF') || mark === (over ? '\u23B4' : '\u23B5')) {
					return '<m:groupChr><m:groupChrPr><m:chr m:val="' + mark + '"/><m:pos m:val="' + (over ? 'top' : 'bot') + '"/><m:vertJc m:val="' + (over ? 'bot' : 'top') + '"/></m:groupChrPr><m:e>' + arg(k[0]) + '</m:e></m:groupChr>';
				}
				if (BAR.indexOf(mark) !== -1) return '<m:bar><m:barPr><m:pos m:val="' + (over ? 'top' : 'bot') + '"/></m:barPr><m:e>' + arg(k[0]) + '</m:e></m:bar>';
				if (over && ACCENT[mark]) return '<m:acc><m:accPr><m:chr m:val="' + ACCENT[mark] + '"/></m:accPr><m:e>' + arg(k[0]) + '</m:e></m:acc>';
			}
			const tag = over ? 'limUpp' : 'limLow';
			return '<m:' + tag + '><m:e>' + arg(k[0]) + '</m:e><m:lim>' + arg(k[1]) + '</m:lim></m:' + tag + '>';
		}
		case 'munderover':
			return '<m:limUpp><m:e><m:limLow><m:e>' + arg(k[0]) + '</m:e><m:lim>' + arg(k[1]) + '</m:lim></m:limLow></m:e><m:lim>' + arg(k[2]) + '</m:lim></m:limUpp>';
		case 'mtable': return table(n);
		case 'mfenced': {
			const open = n.attrs.open != null ? n.attrs.open : '(', close = n.attrs.close != null ? n.attrs.close : ')';
			const sep = n.attrs.separators != null ? n.attrs.separators.trim().charAt(0) : ',';
			return '<m:d><m:dPr><m:begChr m:val="' + xml(open) + '"/><m:sepChr m:val="' + xml(sep) + '"/><m:endChr m:val="' + xml(close) + '"/></m:dPr>'
				+ (k.length ? k.map((x) => '<m:e>' + conv(x) + '</m:e>').join('') : '<m:e/>') + '</m:d>';
		}
		case 'menclose':
			return /box/.test(n.attrs.notation || '') ? '<m:borderBox><m:e>' + seq(k) + '</m:e></m:borderBox>' : seq(k);
		case 'mphantom': return '<m:phant><m:e>' + seq(k) + '</m:e></m:phant>';
		default: return seq(k) + (n.text.trim() ? run(tokenText(n), 'p') : '');
	}
}

// A TABLE: a matrix, aligned equations. Its rows as Word's matrix rows, as many cells in each, every column aligned
// as MathML says (aligned's right then left); an equation's number, \tag, after the row it labels
function table(n: WsMNode): string {
	const rows = n.kids.filter((r) => r.tag === 'mtr' || r.tag === 'mlabeledtr');
	if (!rows.length) return '';
	const cells = rows.map((r) => (r.tag === 'mlabeledtr' ? r.kids.slice(1) : r.kids).filter((c) => c.tag === 'mtd'));
	// an equation's number, upright, two em spaces after it
	const labels = rows.map((r) => (r.tag === 'mlabeledtr' && r.kids[0] ? run(r.kids[0].kids.map((x) => (/^m[tno]/.test(x.tag) ? tokenText(x) : '')).join(''), 'p') : ''));
	const label = (i: number) => (labels[i] ? run('\u2003\u2003', 'p') + labels[i] : '');
	// one equation numbered: the equation and its number, no matrix around it
	if (rows.length === 1 && cells[0].length === 1) return seq(cells[0][0].kids) + label(0);
	const width = Math.max(1, ...cells.map((c) => c.length));
	const aligns = String(n.attrs.columnalign || '').trim().split(/\s+/).filter(Boolean);
	// ALIGNED EQUATIONS (aligned, align, split: right, left, right…): Word's equation array, a row an equation, each
	// & a point the rows line up on
	if (aligns[0] === 'right' && aligns[1] === 'left') {
		const aln = '<m:r><m:rPr><m:aln/></m:rPr>' + CAMBRIA + '<m:t></m:t></m:r>';
		return '<m:eqArr><m:eqArrPr><m:ctrlPr>' + CAMBRIA + '</m:ctrlPr></m:eqArrPr>' + cells.map((row, i) => '<m:e>'
			+ row.map((c, k) => (k ? aln : '') + seq(c.kids)).join('') + label(i) + '</m:e>').join('') + '</m:eqArr>';
	}
	const jc = (i: number) => { const a = aligns[Math.min(i, aligns.length - 1)] || 'center'; return a === 'left' || a === 'right' ? a : 'center'; };
	const mcs = Array.from({ length: width }, (_, i) => '<m:mc><m:mcPr><m:count m:val="1"/><m:mcJc m:val="' + jc(i) + '"/></m:mcPr></m:mc>').join('');
	const body = cells.map((row, i) => '<m:mr>' + Array.from({ length: width }, (_, c) => '<m:e>' + (row[c] ? seq(row[c].kids) : '') + (c === width - 1 ? label(i) : '') + '</m:e>').join('') + '</m:mr>').join('');
	return '<m:m><m:mPr><m:mcs>' + mcs + '</m:mcs><m:ctrlPr>' + CAMBRIA + '</m:ctrlPr></m:mPr>' + body + '</m:m>';
}

/** MathML as Office Math: an inline formula's `<m:oMath>`, a display one's `<m:oMathPara>`, centered; '' where there
 * is no math to read, so the caller keeps the TeX as written. */
export function wsMathmlToOmml(mml: string, display: boolean): string {
	const math = wsParseMathml(mml);
	if (!math) return '';
	let body = '';
	try { body = conv(math); } catch { return ''; }
	if (!body) return '';
	const one = '<m:oMath>' + body + '</m:oMath>';
	return display ? '<m:oMathPara><m:oMathParaPr><m:jc m:val="center"/></m:oMathParaPr>' + one + '</m:oMathPara>' : one;
}
