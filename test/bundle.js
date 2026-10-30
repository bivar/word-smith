'use strict';
// A source module, bundled in memory and loaded with the stand-in for the `obsidian` package the smoke test uses:
// what test/citations.js, test/omml.js and test/margins.js test against.
const path = require('path');
const Module = require('module');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
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

module.exports.bundle = (entry) => {
	const built = esbuild.buildSync({ entryPoints: [path.join(ROOT, entry)], bundle: true, platform: 'node', format: 'cjs',
		write: false, external: ['obsidian', '@codemirror/*'], logLevel: 'error' });
	const m = new Module(path.join(ROOT, entry.replace(/\.ts$/, '.js')));
	m.filename = m.id;
	m.paths = Module._nodeModulePaths(ROOT);
	m._compile(built.outputFiles[0].text, m.filename);
	return m.exports;
};

// the checks' tally: `is` an exact answer, `done` the line and the exit code
module.exports.tally = () => {
	let pass = 0, fail = 0;
	const is = (what, got, want) => {
		if (got === want) { pass++; return; }
		fail++;
		console.log('  FAIL ' + what + ': got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want));
	};
	const done = () => { console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0); };
	return { is, done };
};
