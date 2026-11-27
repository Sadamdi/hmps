/**
 * Peta bahasa repo (nama GitHub Linguist) → tag kanonik + kategori karya.
 *
 * strength:
 * - 'strong' : bahasa hampir pasti menunjuk satu kategori (Dart → mobile, HTML → web, Solidity → blockchain)
 * - 'weak'   : bahasa serbaguna (Python, Java, Go, C#, C) → hanya menambah sedikit bobot; kategori ditentukan
 *              bersama bukti lain (file konfigurasi, framework, topik, README)
 * Bahasa yang tidak ada di peta tetap jadi tag (huruf kecil) tanpa kategori.
 *
 * Urutan bahasa dari GitHub = urutan jumlah byte kode, jadi 3 bahasa teratas (dengan porsi ≥ 5%) dipakai
 * sebagai dasar kategori otomatis.
 */
export interface LanguageDef {
	tag: string;
	category?: string;
	strength?: 'strong' | 'weak';
}

type Row = [string, string, string?, ('strong' | 'weak')?];

const ROWS: Row[] = [
	// ── Web (frontend, template, server web) ──
	['HTML', 'html', 'web', 'strong'], ['CSS', 'css', 'web', 'strong'], ['SCSS', 'css', 'web', 'strong'], ['Sass', 'css', 'web', 'strong'],
	['Less', 'css', 'web', 'strong'], ['Stylus', 'css', 'web', 'strong'], ['PostCSS', 'css', 'web', 'strong'], ['Vue', 'vue', 'web', 'strong'],
	['Svelte', 'svelte', 'web', 'strong'], ['Astro', 'astro', 'web', 'strong'], ['TypeScript', 'typescript', 'web', 'strong'],
	['JavaScript', 'javascript', 'web', 'strong'], ['TSX', 'react', 'web', 'strong'], ['JSX', 'react', 'web', 'strong'],
	['MDX', 'react', 'web', 'weak'], ['PHP', 'php', 'web', 'strong'], ['Hack', 'php', 'web', 'strong'], ['Blade', 'laravel', 'web', 'strong'],
	['Twig', 'php', 'web', 'strong'], ['Smarty', 'php', 'web', 'strong'], ['Latte', 'php', 'web', 'strong'], ['EJS', 'node.js', 'web', 'strong'],
	['Handlebars', 'javascript', 'web', 'strong'], ['Pug', 'node.js', 'web', 'strong'], ['Mustache', 'javascript', 'web', 'weak'],
	['Nunjucks', 'javascript', 'web', 'strong'], ['Liquid', 'html', 'web', 'strong'], ['ERB', 'ruby on rails', 'web', 'strong'],
	['HTML+ERB', 'ruby on rails', 'web', 'strong'], ['Haml', 'ruby on rails', 'web', 'strong'], ['Slim', 'ruby on rails', 'web', 'strong'],
	['HTML+PHP', 'php', 'web', 'strong'], ['HTML+Razor', 'asp.net', 'web', 'strong'], ['Razor', 'asp.net', 'web', 'strong'],
	['ASP.NET', 'asp.net', 'web', 'strong'], ['Classic ASP', 'asp.net', 'web', 'strong'], ['JavaServer Pages', 'java', 'web', 'strong'],
	['Elm', 'elm', 'web', 'strong'], ['ReScript', 'rescript', 'web', 'strong'], ['ReasonML', 'reasonml', 'web', 'strong'],
	['CoffeeScript', 'javascript', 'web', 'strong'], ['LiveScript', 'javascript', 'web', 'strong'], ['PureScript', 'purescript', 'web', 'strong'],
	['Ruby', 'ruby', 'web', 'weak'], ['Elixir', 'elixir', 'web', 'weak'], ['HEEx', 'elixir', 'web', 'strong'], ['Erlang', 'erlang', 'web', 'weak'],
	['Crystal', 'crystal', 'web', 'weak'], ['Go', 'go', 'web', 'weak'], ['Templ', 'go', 'web', 'strong'], ['WebAssembly', 'webassembly', 'web', 'strong'],
	['GraphQL', 'graphql', 'web', 'strong'], ['Gleam', 'gleam', 'web', 'weak'], ['Clojure', 'clojure', 'web', 'weak'], ['ClojureScript', 'clojure', 'web', 'strong'],
	['Scala', 'scala', 'web', 'weak'], ['Groovy', 'groovy', 'web', 'weak'], ['Perl', 'perl', 'tools', 'weak'], ['Raku', 'raku', 'tools', 'weak'],
	['Mako', 'python', 'web', 'strong'], ['Jinja', 'flask', 'web', 'strong'], ['Django HTML', 'django', 'web', 'strong'],
	// ── Mobile ──
	['Dart', 'dart', 'mobile', 'strong'], ['Kotlin', 'kotlin', 'mobile', 'strong'], ['Swift', 'swift', 'mobile', 'strong'],
	['Objective-C', 'objective-c', 'mobile', 'strong'], ['Objective-C++', 'objective-c', 'mobile', 'strong'], ['Smali', 'android', 'mobile', 'strong'],
	['Java', 'java', 'mobile', 'weak'], ['Metal', 'ios', 'mobile', 'strong'], ['RenderScript', 'android', 'mobile', 'strong'],
	// ── AI / Data ──
	['Jupyter Notebook', 'jupyter', 'ai-data', 'strong'], ['R', 'r', 'ai-data', 'strong'], ['RMarkdown', 'r', 'ai-data', 'strong'],
	['Julia', 'julia', 'ai-data', 'strong'], ['MATLAB', 'matlab', 'ai-data', 'strong'], ['Stata', 'stata', 'ai-data', 'strong'],
	['SAS', 'sas', 'ai-data', 'strong'], ['Mathematica', 'mathematica', 'ai-data', 'strong'], ['Wolfram Language', 'mathematica', 'ai-data', 'strong'],
	['Cuda', 'cuda', 'ai-data', 'strong'], ['Mojo', 'mojo', 'ai-data', 'strong'], ['Python', 'python', 'ai-data', 'weak'],
	['Scilab', 'scilab', 'ai-data', 'strong'], ['Octave', 'matlab', 'ai-data', 'strong'], ['Fortran', 'fortran', 'riset', 'weak'],
	['Prolog', 'prolog', 'ai-data', 'weak'], ['Lean', 'lean', 'riset', 'strong'], ['Coq', 'coq', 'riset', 'strong'], ['Isabelle', 'isabelle', 'riset', 'strong'],
	// ── Game ──
	['GDScript', 'godot', 'game', 'strong'], ['ShaderLab', 'unity', 'game', 'strong'], ['HLSL', 'unity', 'game', 'strong'], ['GLSL', 'glsl', 'game', 'strong'],
	['GameMaker Language', 'gamemaker', 'game', 'strong'], ['Haxe', 'haxe', 'game', 'strong'], ['UnrealScript', 'unreal engine', 'game', 'strong'],
	['AngelScript', 'angelscript', 'game', 'strong'], ['Papyrus', 'papyrus', 'game', 'strong'], ['Pawn', 'pawn', 'game', 'strong'],
	['SourcePawn', 'sourcepawn', 'game', 'strong'], ['Squirrel', 'squirrel', 'game', 'strong'], ["Ren'Py", 'renpy', 'game', 'strong'],
	['Godot Resource', 'godot', 'game', 'strong'], ['Luau', 'roblox', 'game', 'strong'], ['Lua', 'lua', 'game', 'weak'], ['C#', 'c#', 'desktop', 'weak'],
	['Mirah', 'mirah', 'game', 'weak'], ['LoomScript', 'loomscript', 'game', 'strong'], ['PICO-8', 'pico-8', 'game', 'strong'],
	// ── IoT / embedded / hardware ──
	['C', 'c', 'iot', 'weak'], ['C++', 'c++', 'iot', 'weak'], ['Assembly', 'assembly', 'iot', 'weak'], ['VHDL', 'vhdl', 'iot', 'strong'],
	['Verilog', 'verilog', 'iot', 'strong'], ['SystemVerilog', 'verilog', 'iot', 'strong'], ['Processing', 'arduino', 'iot', 'strong'],
	['Arduino', 'arduino', 'iot', 'strong'], ['ASL', 'acpi', 'iot', 'weak'], ['Linker Script', 'embedded', 'iot', 'strong'],
	['OpenSCAD', 'openscad', 'robotika', 'strong'], ['G-code', 'cnc', 'robotika', 'strong'], ['KiCad Layout', 'pcb', 'iot', 'strong'],
	['KiCad Schematic', 'pcb', 'iot', 'strong'], ['Eagle', 'pcb', 'iot', 'strong'], ['LabVIEW', 'labview', 'iot', 'strong'],
	['Ladder Logic', 'plc', 'iot', 'strong'], ['Structured Text', 'plc', 'iot', 'strong'],
	// ── Desktop ──
	['Visual Basic .NET', 'vb.net', 'desktop', 'strong'], ['Visual Basic 6.0', 'visual basic', 'desktop', 'strong'], ['VBA', 'excel', 'desktop', 'strong'],
	['Pascal', 'pascal', 'desktop', 'strong'], ['Delphi', 'delphi', 'desktop', 'strong'], ['QML', 'qt', 'desktop', 'strong'], ['Vala', 'vala', 'desktop', 'strong'],
	['Xojo', 'xojo', 'desktop', 'strong'], ['AutoHotkey', 'autohotkey', 'tools', 'strong'], ['AutoIt', 'autoit', 'tools', 'strong'],
	['F#', 'f#', 'desktop', 'weak'], ['XAML', 'wpf', 'desktop', 'strong'], ['Inno Setup', 'windows', 'desktop', 'strong'], ['NSIS', 'windows', 'desktop', 'strong'],
	// ── Cloud / DevOps ──
	['Dockerfile', 'docker', 'cloud', 'strong'], ['HCL', 'terraform', 'cloud', 'strong'], ['Nix', 'nix', 'cloud', 'strong'], ['Jsonnet', 'jsonnet', 'cloud', 'strong'],
	['Puppet', 'puppet', 'cloud', 'strong'], ['Bicep', 'azure', 'cloud', 'strong'], ['Starlark', 'bazel', 'cloud', 'strong'], ['Nginx', 'nginx', 'cloud', 'strong'],
	['Jinja2', 'ansible', 'cloud', 'weak'], ['Procfile', 'heroku', 'cloud', 'strong'], ['Mustache2', 'helm', 'cloud', 'weak'], ['CUE', 'cue', 'cloud', 'strong'],
	// ── Blockchain ──
	['Solidity', 'solidity', 'blockchain', 'strong'], ['Vyper', 'vyper', 'blockchain', 'strong'], ['Cairo', 'cairo', 'blockchain', 'strong'],
	['Move', 'move', 'blockchain', 'strong'], ['Clarity', 'clarity', 'blockchain', 'strong'], ['Yul', 'solidity', 'blockchain', 'strong'],
	// ── Keamanan ──
	['YARA', 'yara', 'security', 'strong'], ['Zeek', 'zeek', 'security', 'strong'], ['Sigma', 'sigma', 'security', 'strong'],
	// ── Sistem informasi / database ──
	['PLpgSQL', 'postgresql', 'sistem-informasi', 'weak'], ['PLSQL', 'oracle db', 'sistem-informasi', 'weak'], ['TSQL', 'sql server', 'sistem-informasi', 'weak'],
	['SQL', 'sql', 'sistem-informasi', 'weak'], ['SQLPL', 'sql', 'sistem-informasi', 'weak'], ['ABAP', 'sap', 'sistem-informasi', 'strong'],
	['Apex', 'salesforce', 'sistem-informasi', 'strong'], ['COBOL', 'cobol', 'sistem-informasi', 'strong'], ['RPGLE', 'rpg', 'sistem-informasi', 'strong'],
	['PowerBuilder', 'powerbuilder', 'sistem-informasi', 'strong'], ['4D', '4d', 'sistem-informasi', 'strong'], ['DAX', 'power bi', 'ai-data', 'strong'],
	['Power Query', 'power bi', 'ai-data', 'strong'],
	// ── Jaringan ──
	['Cisco IOS', 'cisco', 'jaringan', 'strong'], ['Junos', 'juniper', 'jaringan', 'strong'], ['RouterOS Script', 'mikrotik', 'jaringan', 'strong'],
	['P4', 'p4', 'jaringan', 'strong'],
	// ── Tools / CLI / library / sistem ──
	['Shell', 'bash', 'tools', 'weak'], ['PowerShell', 'powershell', 'tools', 'weak'], ['Batchfile', 'batch', 'tools', 'weak'], ['Makefile', 'make', 'tools', 'weak'],
	['CMake', 'cmake', 'tools', 'weak'], ['Meson', 'meson', 'tools', 'weak'], ['Rust', 'rust', 'tools', 'weak'], ['Zig', 'zig', 'tools', 'weak'],
	['Nim', 'nim', 'tools', 'weak'], ['V', 'vlang', 'tools', 'weak'], ['Odin', 'odin', 'tools', 'weak'], ['D', 'dlang', 'tools', 'weak'],
	['Haskell', 'haskell', 'tools', 'weak'], ['OCaml', 'ocaml', 'tools', 'weak'], ['Standard ML', 'sml', 'tools', 'weak'], ['Racket', 'racket', 'tools', 'weak'],
	['Scheme', 'scheme', 'tools', 'weak'], ['Common Lisp', 'lisp', 'tools', 'weak'], ['Emacs Lisp', 'emacs', 'tools', 'strong'], ['Vim Script', 'vim', 'tools', 'strong'],
	['Vim Snippet', 'vim', 'tools', 'strong'], ['Fennel', 'lua', 'tools', 'weak'], ['Tcl', 'tcl', 'tools', 'weak'], ['AWK', 'awk', 'tools', 'weak'],
	['sed', 'sed', 'tools', 'weak'], ['Fish', 'bash', 'tools', 'weak'], ['Nushell', 'nushell', 'tools', 'weak'], ['Elvish', 'bash', 'tools', 'weak'],
	['Ada', 'ada', 'tools', 'weak'], ['Smalltalk', 'smalltalk', 'tools', 'weak'], ['Forth', 'forth', 'iot', 'weak'], ['Brainfuck', 'esolang', 'tools', 'weak'],
	['Carbon', 'carbon', 'tools', 'weak'], ['Hare', 'hare', 'tools', 'weak'], ['Pony', 'pony', 'tools', 'weak'], ['Idris', 'idris', 'riset', 'weak'],
	['Agda', 'agda', 'riset', 'strong'], ['Chapel', 'chapel', 'riset', 'weak'], ['APL', 'apl', 'tools', 'weak'], ['J', 'j', 'tools', 'weak'],
	// ── Riset / dokumen ──
	['TeX', 'latex', 'riset', 'strong'], ['BibTeX', 'latex', 'riset', 'strong'], ['Typst', 'typst', 'riset', 'strong'], ['Gnuplot', 'gnuplot', 'riset', 'strong'],
	['NetLogo', 'netlogo', 'riset', 'strong'], ['Modelica', 'modelica', 'riset', 'strong'], ['GAMS', 'gams', 'riset', 'strong'], ['AMPL', 'ampl', 'riset', 'strong'],
	// ── Multimedia / desain ──
	['SVG', 'svg', 'uiux', 'weak'], ['Blender', 'blender', 'multimedia', 'strong'], ['POV-Ray SDL', 'povray', 'multimedia', 'strong'],
	['ActionScript', 'flash', 'multimedia', 'strong'], ['SuperCollider', 'supercollider', 'multimedia', 'strong'], ['ChucK', 'chuck', 'multimedia', 'strong'],
	['Csound', 'csound', 'multimedia', 'strong'], ['Max', 'max msp', 'multimedia', 'strong'], ['Faust', 'faust', 'multimedia', 'strong'],
	// ── AR / VR ──
	['ShaderGraph', 'unity', 'ar-vr', 'weak'], ['USD', 'usd', 'ar-vr', 'strong'],
	// ── Bot / otomasi ──
	['AppleScript', 'applescript', 'bot', 'strong'],
];

export const LANGUAGE_DEFS: Record<string, LanguageDef> = Object.fromEntries(
	ROWS.map(([name, tag, category, strength]) => [name, { tag, ...(category ? { category } : {}), strength: strength || 'weak' }]),
);

/** Tag & kategori untuk satu nama bahasa GitHub (fallback: tag huruf kecil tanpa kategori). */
export function languageDef(name: string): LanguageDef {
	return LANGUAGE_DEFS[name] || { tag: String(name || '').toLowerCase().slice(0, 30), strength: 'weak' };
}
