// Lecture d'étiquette sur le téléphone : gratuite, hors-ligne après le premier usage,
// aucune photo n'est envoyée sur internet. Tesseract lit le texte, puis des règles simples
// en tirent la fiche du vin.
const SCAN = (() => {
  const TAILLE_LECTURE = 2000;
  const TAILLE_PHOTO = 800;
  const ANNEE = new Date().getFullYear();

  const CEPAGES = ['Cabernet Sauvignon', 'Cabernet Franc', 'Merlot', 'Malbec', 'Petit Verdot', 'Carménère', 'Pinot Noir', 'Pinot Gris',
    'Pinot Blanc', 'Pinot Meunier', 'Chardonnay', 'Sauvignon Blanc', 'Sauvignon', 'Sémillon', 'Muscadelle', 'Chenin', 'Melon de Bourgogne',
    'Gamay', 'Syrah', 'Shiraz', 'Grenache', 'Mourvèdre', 'Carignan', 'Cinsault', 'Viognier', 'Marsanne', 'Roussanne', 'Vermentino',
    'Rolle', 'Riesling', 'Gewurztraminer', 'Sylvaner', 'Muscat', 'Tannat', 'Négrette', 'Fer Servadou', 'Savagnin', 'Trousseau',
    'Poulsard', 'Aligoté', 'Picpoul', 'Colombard', 'Ugni Blanc', 'Sangiovese', 'Nebbiolo', 'Tempranillo', 'Zinfandel'];
  const MOTS_DOMAINE = /\b(ch[aâ]teau|chateau|domaine|clos|mas|maison|cave|cellier|vignobles?|famille|abbaye|prieur[ée]|commanderie|bodega|tenuta|cantina|quinta)\b/i;
  const MOTS_HORS_NOM = /(depuis|fond[ée]e? en|since|founded|appellation|contr[oô]l[ée]e|prot[ée]g[ée]e|mis en bouteille|bottled|produit de|product of|produce of|contient|contains|sulfit|% ?vol|\bcl\b|\bml\b|www\.|grand vin de|vin de france|lot\b)/i;

  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9%.,]+/g, ' ').trim();
  const nettoyer = (s) => s.replace(/^[^\p{L}\d]+|[^\p{L}\d.)]+$/gu, '').replace(/\s{2,}/g, ' ').trim();
  const casse = (s) => (s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()) : s);

  // ---------- Image ----------
  function charger(fichier) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(fichier);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Impossible de lire cette photo.')); };
      img.src = url;
    });
  }

  function canvasReduit(img, taille) {
    const ratio = Math.min(1, taille / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * ratio);
    c.height = Math.round(img.height * ratio);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  // Niveaux de gris et contraste étiré : aide Tesseract sur les photos mal éclairées.
  function preparer(img) {
    const c = canvasReduit(img, TAILLE_LECTURE);
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height);
    const p = d.data;
    let min = 255, max = 0;
    for (let i = 0; i < p.length; i += 4) {
      const g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
      p[i] = g;
      if (g < min) min = g;
      if (g > max) max = g;
    }
    const etendue = Math.max(1, max - min);
    for (let i = 0; i < p.length; i += 4) {
      const g = ((p[i] - min) * 255) / etendue;
      p[i] = p[i + 1] = p[i + 2] = g;
    }
    ctx.putImageData(d, 0, 0);
    return c;
  }

  async function photoFiche(fichier) {
    return canvasReduit(await charger(fichier), TAILLE_PHOTO).toDataURL('image/jpeg', 0.7);
  }

  // ---------- Lecture du texte ----------
  let workerPromesse = null;
  let suivi = () => {};

  function worker() {
    if (!workerPromesse) {
      const chemin = (f) => new URL(f, location.href).href;
      workerPromesse = Tesseract.createWorker('fra', 1, {
        workerPath: chemin('vendor/tesseract/worker.min.js'),
        corePath: chemin('vendor/tesseract'),
        langPath: chemin('vendor/tesseract/lang'),
        logger: (m) => {
          if (m.status === 'recognizing text') suivi(`Lecture de l'étiquette… ${Math.round(m.progress * 100)} %`);
          else if (/load|initiali/.test(m.status)) suivi('Préparation du lecteur (plus long la première fois)…');
        },
      }).catch((e) => { workerPromesse = null; throw e; });
    }
    return workerPromesse;
  }

  async function lireTexte(canvas) {
    const w = await worker();
    // Mode « texte épars » : adapté aux étiquettes, où le texte est dispersé et de tailles très différentes.
    await w.setParameters({ tessedit_pageseg_mode: '11' });
    const { data } = await w.recognize(canvas, {}, { text: true, blocks: true });
    const lignes = [];
    for (const b of data.blocks || []) for (const p of b.paragraphs) for (const l of p.lines) {
      const texte = nettoyer(l.text);
      const utile = (texte.match(/\p{L}/gu) || []).length >= 2 || /\b(19|20)\d\d\b/.test(texte);
      if (l.confidence >= 45 && utile) lignes.push({ texte, hauteur: l.bbox.y1 - l.bbox.y0 });
    }
    // « CHÂTEAU » seul sur sa ligne : le nom est sur la ligne suivante.
    for (let i = 0; i < lignes.length - 1; i++) {
      if (/^(ch[aâ]teau|chateau|domaine|clos|mas|maison|cave|cellier|abbaye|quinta|tenuta|bodega)$/i.test(lignes[i].texte)) {
        lignes[i] = { texte: `${lignes[i].texte} ${lignes[i + 1].texte}`, hauteur: Math.max(lignes[i].hauteur, lignes[i + 1].hauteur) };
        lignes.splice(i + 1, 1);
      }
    }
    return { texte: data.text || '', lignes };
  }

  // ---------- Analyse ----------
  // Parmi les appellations trouvées, garde la plus précise : « Chablis » plutôt que « Bourgogne ».
  function choisirAppellation(n) {
    const trouvees = APPELLATIONS.filter((a) => n.includes(` ${a.cle} `));
    const precises = trouvees.filter((a) => !trouvees.some((b) => b !== a && b.cle.includes(a.cle)));
    const specifiques = precises.filter((a) => a.nom !== a.region);
    const pool = specifiques.length ? specifiques : precises;
    return pool.sort((a, b) => n.indexOf(` ${a.cle} `) - n.indexOf(` ${b.cle} `))[0];
  }

  function analyser({ texte, lignes }) {
    const n = ` ${norm(texte)} `;
    const doutes = new Set();
    const fiche = { domaine: '', cuvee: '', millesime: null, couleur: '', type: '', pays: '', region: '', appellation: '',
      cepages: '', degre: null, contenance: '75 cl', profilGarde: '' };

    // Appellation : d'abord la liste connue, sinon la formule « Appellation X Contrôlée ».
    const app = choisirAppellation(n);
    if (app) {
      Object.assign(fiche, { appellation: app.nom, region: app.region, pays: app.pays });
    } else {
      const m = texte.match(/appellation\s+(.{3,40}?)\s+(?:contr[oô]l[ée]e|prot[ée]g[ée]e)/i);
      if (m) { fiche.appellation = casse(nettoyer(m[1])); doutes.add('appellation'); }
    }
    if (!fiche.pays) {
      if (/\b(france|francais|french)\b/.test(n)) fiche.pays = 'France';
      else if (/\b(italia|italy|italie)\b/.test(n)) fiche.pays = 'Italie';
      else if (/\b(espana|spain|espagne)\b/.test(n)) fiche.pays = 'Espagne';
      else if (/\bportugal\b/.test(n)) fiche.pays = 'Portugal';
    }

    // Millésime : une année plausible, en écartant « depuis 1850 » et les dates de fondation.
    const annees = [];
    for (const l of lignes.length ? lignes.map((x) => x.texte) : texte.split('\n')) {
      if (/(depuis|since|fond|found|[ée]tabli|est\.|n[ée] en)/i.test(l)) continue;
      for (const m of l.matchAll(/\b(19[5-9]\d|20[0-9]\d)\b/g)) if (Number(m[1]) <= ANNEE) annees.push(Number(m[1]));
    }
    if (annees.length) {
      fiche.millesime = annees.sort((a, b) => annees.filter((x) => x === b).length - annees.filter((x) => x === a).length)[0];
      if (new Set(annees).size > 1) doutes.add('millesime');
    } else doutes.add('millesime');

    // Degré et contenance.
    const deg = texte.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*%/);
    if (deg) {
      const v = Number(deg[1].replace(',', '.'));
      if (v >= 7 && v <= 23) fiche.degre = v;
    }
    if (/\b(150\s*cl|1[.,]5\s*l\b|1500\s*ml|magnum)/i.test(texte)) fiche.contenance = '150 cl (magnum)';
    else if (/\b(37[.,]5\s*cl|375\s*ml)/i.test(texte)) fiche.contenance = '37,5 cl';
    else if (/\b(50\s*cl|500\s*ml)/i.test(texte)) fiche.contenance = '50 cl';
    else if (/\b(300\s*cl|3\s*l\b)/i.test(texte)) fiche.contenance = '300 cl';
    else if (!/\b(75\s*cl|750\s*ml)/i.test(texte)) doutes.add('contenance');

    // Type et couleur : les mots de l'étiquette d'abord, l'appellation ensuite.
    if (/\b(brut|extra brut|demi sec|cremant|mousseux|methode traditionnelle|champagne|petillant|prosecco|cava)\b/.test(n)) fiche.type = 'effervescent';
    else if (/\b(liquoreux|moelleux|vendanges tardives|selection de grains nobles|late harvest)\b/.test(n)) fiche.type = 'liquoreux';
    else if (/\b(vin doux naturel|porto|port wine|banyuls|maury)\b/.test(n)) fiche.type = 'mute';
    else fiche.type = app?.type || 'tranquille';

    // « Rouge », « Blanc » ou « Rosé » seul sur une ligne, ou une formule comme « vin blanc ».
    const seul = (mot) => lignes.some((l) => norm(l.texte).split(' ').filter((x) => !/\d|%/.test(x)).join(' ') === mot);
    if (/\b(rose|rosato|rosado)\b/.test(n)) fiche.couleur = 'rose';
    else if (/\b(vin blanc|white wine|blanc de blancs|bianco|blanco)\b/.test(n) || seul('blanc')) fiche.couleur = 'blanc';
    else if (/\b(vin rouge|red wine|rosso|tinto)\b/.test(n) || seul('rouge')) fiche.couleur = 'rouge';
    else if (app) fiche.couleur = app.couleur;
    else { fiche.couleur = 'rouge'; doutes.add('couleur'); }
    // Une appellation qui existe en plusieurs couleurs reste à vérifier.
    if (app && !/(vin blanc|vin rouge|rose|white wine|red wine)/.test(n) && !seul('rouge') && !seul('blanc') && ['Bordeaux', 'Bourgogne', 'Côtes du Rhône', 'Sancerre', 'Côtes de Provence', 'Languedoc', 'Anjou', 'Touraine', 'Graves', 'Mâcon'].includes(app.nom)) doutes.add('couleur');

    // Cépages cités.
    const cep = CEPAGES.filter((c) => n.includes(` ${norm(c)} `));
    fiche.cepages = cep.filter((c) => !(c === 'Sauvignon' && cep.includes('Sauvignon Blanc'))).join(', ');

    // Cuvée : « Cuvée X ».
    const cuv = lignes.find((l) => /cuv[ée]e\s+\S/i.test(l.texte));
    if (cuv) fiche.cuvee = casse(nettoyer(cuv.texte.replace(/.*cuv[ée]e\s+/i, '')));

    // Domaine : la plus grande ligne avec « Château », « Domaine »… sinon la plus grande ligne restante.
    const candidates = lignes.filter((l) => !MOTS_HORS_NOM.test(l.texte) && !(app && norm(l.texte) === app.cle) && !/^\d+$/.test(l.texte));
    const avecMot = candidates.filter((l) => MOTS_DOMAINE.test(l.texte)).sort((a, b) => b.hauteur - a.hauteur)[0];
    const plusGrande = candidates.filter((l) => l !== cuv && (l.texte.match(/\p{L}/gu) || []).length >= 4).sort((a, b) => b.hauteur - a.hauteur)[0];
    const dom = avecMot || plusGrande;
    if (dom) {
      fiche.domaine = casse(nettoyer(dom.texte.replace(/\b(19|20)\d\d\b/g, '')));
      if (!avecMot) doutes.add('domaine');
    } else doutes.add('domaine');

    // Profil de garde.
    const grandCru = /\b(grand cru|premier cru|1er cru|cru classe|premier grand cru)\b/.test(n);
    if (fiche.type === 'effervescent') fiche.profilGarde = fiche.millesime ? 'champagne_mill' : 'champagne_nm';
    else if (fiche.type === 'liquoreux' || fiche.type === 'mute') fiche.profilGarde = 'liquoreux';
    else if (fiche.couleur === 'rose' || /nouveau|primeur/.test(n) || ['Muscadet', 'Muscadet Sèvre et Maine', 'Picpoul de Pinet', 'Entre-Deux-Mers', 'Côtes de Gascogne'].includes(fiche.appellation)) fiche.profilGarde = 'leger';
    else if (fiche.couleur === 'rouge' && grandCru) fiche.profilGarde = 'grand_rouge';
    else if (fiche.couleur === 'rouge' && ['Beaujolais', 'Loire'].includes(fiche.region)) fiche.profilGarde = 'rouge_leger';
    else fiche.profilGarde = GARDE.suggerer(fiche.couleur, fiche.type);

    if (!fiche.appellation) doutes.add('appellation');
    if (!fiche.pays) { fiche.pays = 'France'; doutes.add('pays'); }
    fiche.champsIncertains = [...doutes];
    return fiche;
  }

  async function lireEtiquette(fichier, onProgres = () => {}) {
    suivi = onProgres;
    if (typeof Tesseract === 'undefined') throw new Error("Le lecteur d'étiquettes n'est pas encore chargé. Vérifie ta connexion et réessaie.");
    const img = await charger(fichier);
    let lu;
    try { lu = await lireTexte(preparer(img)); } catch (e) {
      console.error(e);
      throw new Error("Le lecteur d'étiquettes n'a pas pu démarrer. Vérifie ta connexion pour le premier usage, puis réessaie.");
    }
    if ((lu.texte.match(/\p{L}/gu) || []).length < 12) {
      throw new Error("Je n'arrive pas à lire l'étiquette. Reprends la photo de face, bien éclairée et nette.");
    }
    return { fiche: analyser(lu), photo: canvasReduit(img, TAILLE_PHOTO).toDataURL('image/jpeg', 0.7), texte: lu.texte };
  }

  return { lireEtiquette, photoFiche, analyser };
})();
