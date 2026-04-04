/**
 * Nama layer di template PSD (`attached_assets/templates/tamplate_benner.psd` / salinan di `psd/`) —
 * harus persis seperti di panel Lapisan Photopea.
 *
 * Pohon layer (dev): jalankan `node scripts/dump-psd-layers.mjs` setelah menginstal devDependency `ag-psd`.
 * Ringkasan dari dump `psd/tamplate_benner.psd` (npm run dump-psd-layers):
 *   potret `Lapisan 7` / `7` / `Layer 7` [raster], teks `ALIFIYA`, teks `TECHNOPRENEURSHIP`,
 *   shape `Rectangle 1/2/3`, adjustment `Gradient Map 1` (2 stops: #6b2896→#4b78c8),
 *   logo `Logo Techno` [raster], raster `Layer 0–3`.
 * Sesuaikan konstanta jika file PSD berubah.
 *
 * Jika PSD diubah, sesuaikan nilai di sini saja.
 */
export const BANNER_TEMPLATE_LAYERS = {
	/** Potret kecil template yang diganti foto upload (Photopea bisa menampilkan sebagai "7" atau "Layer 7") */
	templatePortrait: '7',
	/** Alias umum jika layer dinamai otomatis di Photoshop */
	templatePortraitAlt: 'Layer 7',
	/** Teks nama orang — default UI; PSD bisa memakai ejaan lain (lihat kandidat) */
	nameText: 'ALIFIYA',
	/** Teks vertikal nama divisi */
	divisionText: 'TECHNOPRENEURSHIP',
	/** Blok warna utama */
	backgroundRect: 'Rectangle 2',
	/** Blok aksen / sekunder */
	accentRect: 'Rectangle 3',
	/** Shape tambahan yang ikut warna BG */
	extraRect: 'Rectangle 1',
	/** Gradient Map adjustment layer (2 stop: BG → Accent) */
	gradientMap: 'Gradient Map 1',
	/** Logo divisi / organisasi (layer grup di PSD: "Logo Techno") */
	logo: 'Logo Techno',
} as const;

/**
 * Nama layer teks di PSD bisa bervariasi (typo Photoshop / template lama).
 * Urutan: cocokkan dari kiri ke kanan.
 */
/** Urutan: nama di PSD Anda dulu (ALIFIYA), lalu varian umum */
export const BANNER_NAME_LAYER_CANDIDATES = ['ALIFIYA', 'ALFIYA'] as const;

export const BANNER_DIVISION_LAYER_CANDIDATES = ['TECHNOPRENEURSHIP'] as const;

/** Layer foto potret (Photoshop EN/ID) */
export const BANNER_PORTRAIT_LAYER_CANDIDATES = [
	'Lapisan 7',
	'7',
	'Layer 7',
] as const;

export const BANNER_TEMPLATE_DEFAULTS: { personName: string } = {
	personName: 'ALFIYA',
};

/** Escape string untuk disisipkan ke skrip Photopea (quoted) */
export function escapeForPhotopeaString(s: string): string {
	return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/* ------------------------------------------------------------------ */
/*  Blok helper yang dipakai di semua skrip Photopea (ppFindPsdDoc,   */
/*  ppFindLayer, ppFindPhotoDoc, ppNum, ppDocNameLower).               */
/* ------------------------------------------------------------------ */
function ppHelperBlock(): string {
	const L = BANNER_TEMPLATE_LAYERS;
	const nameCands = JSON.stringify([...BANNER_NAME_LAYER_CANDIDATES]);
	const divCands = JSON.stringify([...BANNER_DIVISION_LAYER_CANDIDATES]);
	return `
	var __ppNameCands = ${nameCands};
	var __ppDivCands = ${divCands};
	function ppNum(v) { return typeof v === "number" ? v : parseFloat(v); }
	function ppDocNameLower(d) {
		try { return String(d.name || "").toLowerCase(); } catch (e) { return ""; }
	}
	function ppFindLayer(doc, name) {
		function walk(container) {
			var layers = container.layers;
			for (var i = 0; i < layers.length; i++) {
				var L = layers[i];
				if (L.name === name) return L;
				if (L.typename === "LayerSet") {
					var f = walk(L);
					if (f) return f;
				}
			}
			return null;
		}
		return walk(doc);
	}
	function ppFindLayerCI(doc, want) {
		var wl = String(want).toLowerCase();
		function walk(container) {
			var layers = container.layers;
			for (var i = 0; i < layers.length; i++) {
				var L = layers[i];
				if (String(L.name).toLowerCase() === wl) return L;
				if (L.typename === "LayerSet") {
					var f = walk(L);
					if (f) return f;
				}
			}
			return null;
		}
		return walk(doc);
	}
	function ppFindTextLayerByCandidates(doc, cands) {
		var i, L;
		for (i = 0; i < cands.length; i++) {
			L = ppFindLayer(doc, cands[i]);
			if (L) return L;
		}
		for (i = 0; i < cands.length; i++) {
			L = ppFindLayerCI(doc, cands[i]);
			if (L) return L;
		}
		return null;
	}
	function ppTemplateScore(d) {
		var s = 0;
		if (ppFindTextLayerByCandidates(d, __ppNameCands)) s += 3;
		if (ppFindTextLayerByCandidates(d, __ppDivCands)) s += 3;
		if (ppFindTextLayerByCandidates(d, __ppPortraitCands)) s += 2;
		if (ppFindLayer(d, "${L.backgroundRect}")) s += 1;
		if (ppFindLayer(d, "${L.accentRect}")) s += 1;
		if (ppFindLayer(d, "${L.extraRect}")) s += 1;
		if (ppFindLayer(d, "${L.logo}")) s += 1;
		return s;
	}
	function ppFindPsdDoc() {
		var i, d, nm, best = null, bestScore = -9999, bestLayers = 0, score, lc;
		for (i = 0; i < app.documents.length; i++) {
			d = app.documents[i];
			nm = ppDocNameLower(d);
			score = ppTemplateScore(d);
			if (nm.indexOf(".psd") >= 0) score += 5;
			if (/\\.(png|jpe?g|webp|gif)$/i.test(nm)) score -= 20;
			lc = 0;
			try { lc = d.layers.length; } catch (e3) {}
			if (score > bestScore || (score === bestScore && lc > bestLayers)) {
				bestScore = score; bestLayers = lc; best = d;
			}
		}
		if (best && bestScore >= 3) return best;
		for (i = 0; i < app.documents.length; i++) {
			d = app.documents[i]; nm = ppDocNameLower(d);
			if (nm.indexOf(".psd") >= 0 && !/\\.(png|jpe?g|webp|gif)$/i.test(nm)) return d;
		}
		best = null; bestLayers = 0;
		for (i = 0; i < app.documents.length; i++) {
			d = app.documents[i];
			try { lc = d.layers.length; if (lc > bestLayers) { bestLayers = lc; best = d; } } catch (e4) {}
		}
		if (best && bestLayers > 3) return best;
		return app.documents.length ? app.documents[0] : null;
	}
	function ppFindPhotoDoc(psdDoc) {
		var i, d, nm;
		for (i = 0; i < app.documents.length; i++) {
			d = app.documents[i];
			if (d === psdDoc) continue;
			nm = ppDocNameLower(d);
			if (/\\.(png|jpe?g|webp|gif)$/i.test(nm)) return d;
		}
		for (i = 0; i < app.documents.length; i++) {
			d = app.documents[i];
			if (d !== psdDoc) return d;
		}
		return null;
	}
`;
}

/** Skrip teks: nama saja (dipisah agar Photopea lebih stabil + `done` per langkah). */
export function buildPhotopeaTextInitScriptNameOnly(personName: string): string {
	const nameEsc = escapeForPhotopeaString(personName);
	return `
(function(){
	${ppHelperBlock()}
	try {
		var psdDoc = ppFindPsdDoc();
		if (!psdDoc) return;
		app.activeDocument = psdDoc;
		var nameLayer = ppFindTextLayerByCandidates(psdDoc, __ppNameCands);
		try { if (nameLayer) nameLayer.textItem.contents = "${nameEsc}"; } catch (e1) {}
	} catch (e) {}
})();
`;
}

/** Skrip teks: divisi saja */
export function buildPhotopeaTextInitScriptDivisionOnly(divisionText: string): string {
	const divEsc = escapeForPhotopeaString(divisionText);
	return `
(function(){
	${ppHelperBlock()}
	try {
		var psdDoc = ppFindPsdDoc();
		if (!psdDoc) return;
		app.activeDocument = psdDoc;
		var divLayer = ppFindTextLayerByCandidates(psdDoc, __ppDivCands);
		try { if (divLayer) divLayer.textItem.contents = "${divEsc}"; } catch (e2) {}
	} catch (e) {}
})();
`;
}

/**
 * Skrip PASTE FOTO: setelah foto dibuka sebagai dokumen terpisah (via postMessage ArrayBuffer),
 * copy isi foto, tempel ke layer potret di PSD template, tutup dokumen foto.
 */
export function buildPhotopeaPhotoPasteScript(): string {
	return `
(function(){
	${ppHelperBlock()}
	try {
		var psdDoc = ppFindPsdDoc();
		if (!psdDoc) return;
		var photoDoc = ppFindPhotoDoc(psdDoc);
		if (!photoDoc) return;
		app.activeDocument = psdDoc;
		var refL = ppFindTextLayerByCandidates(psdDoc, __ppPortraitCands);
		if (refL) {
			var bb = refL.bounds;
			var left = ppNum(bb[0]), top = ppNum(bb[1]), right = ppNum(bb[2]), bottom = ppNum(bb[3]);
			var targetW = right - left;
			var targetH = bottom - top;
			var cx = (left + right) / 2;
			var cy = (top + bottom) / 2;
			refL.remove();
			app.activeDocument = photoDoc;
			photoDoc.selection.selectAll();
			photoDoc.selection.copy();
			photoDoc.close(SaveOptions.DONOTSAVECHANGES);
			app.activeDocument = psdDoc;
			psdDoc.paste();
			var pasted = psdDoc.activeLayer;
			var pb = pasted.bounds;
			var pl = ppNum(pb[0]), pt = ppNum(pb[1]), pr = ppNum(pb[2]), pbb = ppNum(pb[3]);
			var lw = pr - pl;
			var lh = pbb - pt;
			var scaleW = (targetW / lw) * 100;
			var scaleH = (targetH / lh) * 100;
			var sc = Math.max(scaleW, scaleH);
			pasted.resize(sc, sc, AnchorPosition.MIDDLECENTER);
			var nb = pasted.bounds;
			var ncx = (ppNum(nb[0]) + ppNum(nb[2])) / 2;
			var ncy = (ppNum(nb[1]) + ppNum(nb[3])) / 2;
			pasted.translate(cx - ncx, cy - ncy);
		} else {
			try { photoDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (ec) {}
		}
		try { app.activeDocument = psdDoc; } catch(ef) {}
	} catch (e) {
		try { app.activeDocument = app.documents[0]; } catch(e9) {}
	}
})();
`;
}

export function buildPhotopeaFillRectScript(
	hexNoHash: string,
	rectLayerName: string,
): string {
	return `
(function(){
	function ppNum(v) { return typeof v === "number" ? v : parseFloat(v); }
	function ppFindLayer(doc, name) {
		function walk(container) {
			var layers = container.layers;
			for (var i = 0; i < layers.length; i++) {
				var L = layers[i];
				if (L.name === name) return L;
				if (L.typename === "LayerSet") {
					var f = walk(L);
					if (f) return f;
				}
			}
			return null;
		}
		return walk(doc);
	}
	try {
		var doc = app.activeDocument;
		var layer = ppFindLayer(doc, "${rectLayerName.replace(/"/g, '\\"')}");
		if (!layer) return;
		doc.activeLayer = layer;
		var b = layer.bounds;
		var l = ppNum(b[0]), t = ppNum(b[1]), r = ppNum(b[2]), bt = ppNum(b[3]);
		doc.selection.select([[l, t], [r, t], [r, bt], [l, bt]]);
		var c = new SolidColor();
		c.rgb.hexValue = "${hexNoHash}";
		doc.selection.fill(c);
		doc.selection.deselect();
	} catch (e) {}
})();
`;
}

export function buildPhotopeaSetTextScript(layerName: string, text: string): string {
	const esc = escapeForPhotopeaString(text);
	const ln = escapeForPhotopeaString(layerName);
	return `
(function(){
	function ppFindLayer(doc, name) {
		function walk(container) {
			var layers = container.layers;
			for (var i = 0; i < layers.length; i++) {
				var L = layers[i];
				if (L.name === name) return L;
				if (L.typename === "LayerSet") {
					var f = walk(L);
					if (f) return f;
				}
			}
			return null;
		}
		return walk(doc);
	}
	try {
		var L = ppFindLayer(app.activeDocument, "${ln}");
		if (L) L.textItem.contents = "${esc}";
	} catch (e) {}
})();
`;
}

/** Ubah teks pada layer pertama yang cocok dari daftar nama (panel PSD bisa beda ejaan). */
export function buildPhotopeaSetTextScriptFromCandidates(
	candidates: readonly string[],
	text: string,
): string {
	const esc = escapeForPhotopeaString(text);
	const cj = JSON.stringify([...candidates]);
	return `
(function(){
	${ppHelperBlock()}
	try {
		var L = ppFindTextLayerByCandidates(app.activeDocument, ${cj});
		if (L) L.textItem.contents = "${esc}";
	} catch (e) {}
})();
`;
}

export function buildPhotopeaToggleLayerScript(
	layerName: string,
	visible: boolean,
): string {
	const ln = escapeForPhotopeaString(layerName);
	return `
(function(){
	function ppFindLayer(doc, name) {
		function walk(container) {
			var layers = container.layers;
			for (var i = 0; i < layers.length; i++) {
				var L = layers[i];
				if (L.name === name) return L;
				if (L.typename === "LayerSet") {
					var f = walk(L);
					if (f) return f;
				}
			}
			return null;
		}
		return walk(doc);
	}
	try {
		var L = ppFindLayer(app.activeDocument, "${ln}");
		if (L) L.visible = ${visible ? 'true' : 'false'};
	} catch (e) {}
})();
`;
}

/** Sembunyikan / tampilkan teks nama & divisi (nama layer bisa bervariasi). */
export function buildPhotopeaToggleNameDivisionScript(visible: boolean): string {
	const v = visible ? 'true' : 'false';
	return `
(function(){
	${ppHelperBlock()}
	try {
		var d = app.activeDocument;
		var a = ppFindTextLayerByCandidates(d, __ppNameCands);
		if (a) a.visible = ${v};
		var b = ppFindTextLayerByCandidates(d, __ppDivCands);
		if (b) b.visible = ${v};
	} catch (e) {}
})();
`;
}

/**
 * Update Gradient Map adjustment layer (2-stop gradient: BG → Accent).
 * Uses Action Descriptors (Photoshop-compatible scripting); fails silently if unsupported.
 */
export function buildPhotopeaGradientMapScript(
	bgHexNoHash: string,
	accentHexNoHash: string,
): string {
	const ln = escapeForPhotopeaString(BANNER_TEMPLATE_LAYERS.gradientMap);
	const bR = parseInt(bgHexNoHash.slice(0, 2), 16);
	const bG = parseInt(bgHexNoHash.slice(2, 4), 16);
	const bB = parseInt(bgHexNoHash.slice(4, 6), 16);
	const aR = parseInt(accentHexNoHash.slice(0, 2), 16);
	const aG = parseInt(accentHexNoHash.slice(2, 4), 16);
	const aB = parseInt(accentHexNoHash.slice(4, 6), 16);

	return `
(function(){
	function ppFindLayer(doc, name) {
		function walk(container) {
			var layers = container.layers;
			for (var i = 0; i < layers.length; i++) {
				var L = layers[i];
				if (L.name === name) return L;
				if (L.typename === "LayerSet") { var f = walk(L); if (f) return f; }
			}
			return null;
		}
		return walk(doc);
	}
	try {
		var doc = app.activeDocument;
		var gml = ppFindLayer(doc, "${ln}");
		if (!gml) return;
		doc.activeLayer = gml;
		var d1 = new ActionDescriptor();
		var r1 = new ActionReference();
		r1.putEnumerated(charIDToTypeID("AdjL"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
		d1.putReference(charIDToTypeID("null"), r1);
		var adjD = new ActionDescriptor();
		var gD = new ActionDescriptor();
		gD.putString(charIDToTypeID("Nm  "), "Custom");
		gD.putEnumerated(charIDToTypeID("GrdF"), charIDToTypeID("GrdF"), charIDToTypeID("CstS"));
		gD.putDouble(charIDToTypeID("Intr"), 4096);
		var cL = new ActionList();
		var cs1 = new ActionDescriptor(); var cc1 = new ActionDescriptor();
		cc1.putDouble(charIDToTypeID("Rd  "), ${bR});
		cc1.putDouble(charIDToTypeID("Grn "), ${bG});
		cc1.putDouble(charIDToTypeID("Bl  "), ${bB});
		cs1.putObject(charIDToTypeID("Clr "), charIDToTypeID("RGBC"), cc1);
		cs1.putEnumerated(charIDToTypeID("Type"), charIDToTypeID("Clry"), charIDToTypeID("UsrS"));
		cs1.putInteger(charIDToTypeID("Lctn"), 0);
		cs1.putInteger(charIDToTypeID("Mdpn"), 50);
		cL.putObject(charIDToTypeID("Clrt"), cs1);
		var cs2 = new ActionDescriptor(); var cc2 = new ActionDescriptor();
		cc2.putDouble(charIDToTypeID("Rd  "), ${aR});
		cc2.putDouble(charIDToTypeID("Grn "), ${aG});
		cc2.putDouble(charIDToTypeID("Bl  "), ${aB});
		cs2.putObject(charIDToTypeID("Clr "), charIDToTypeID("RGBC"), cc2);
		cs2.putEnumerated(charIDToTypeID("Type"), charIDToTypeID("Clry"), charIDToTypeID("UsrS"));
		cs2.putInteger(charIDToTypeID("Lctn"), 4096);
		cs2.putInteger(charIDToTypeID("Mdpn"), 50);
		cL.putObject(charIDToTypeID("Clrt"), cs2);
		gD.putList(charIDToTypeID("Clrs"), cL);
		var oL = new ActionList();
		var o1 = new ActionDescriptor();
		o1.putUnitDouble(charIDToTypeID("Opct"), charIDToTypeID("#Prc"), 100);
		o1.putInteger(charIDToTypeID("Lctn"), 0);
		o1.putInteger(charIDToTypeID("Mdpn"), 50);
		oL.putObject(charIDToTypeID("TrnS"), o1);
		var o2 = new ActionDescriptor();
		o2.putUnitDouble(charIDToTypeID("Opct"), charIDToTypeID("#Prc"), 100);
		o2.putInteger(charIDToTypeID("Lctn"), 4096);
		o2.putInteger(charIDToTypeID("Mdpn"), 50);
		oL.putObject(charIDToTypeID("TrnS"), o2);
		gD.putList(charIDToTypeID("Trns"), oL);
		adjD.putObject(charIDToTypeID("Grad"), charIDToTypeID("Grdn"), gD);
		d1.putObject(charIDToTypeID("T   "), charIDToTypeID("GdMp"), adjD);
		executeAction(charIDToTypeID("setd"), d1, DialogModes.NO);
	} catch (e) {}
})();
`;
}
