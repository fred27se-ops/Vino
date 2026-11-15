// Lecture d'étiquette par Gemini (Google), facultative : active seulement si une clé est enregistrée.
// La clé reste sur le téléphone et n'est jamais incluse dans les sauvegardes.
const GEMINI = (() => {
  const BASE = 'https://generativelanguage.googleapis.com/v1beta';
  const CONTENANCES = ['75 cl', '37,5 cl', '50 cl', '150 cl (magnum)', '300 cl'];
  const CHAMPS = ['domaine', 'cuvee', 'millesime', 'couleur', 'type', 'pays', 'region', 'appellation', 'cepages', 'degre', 'contenance'];

  const CONSIGNE = `Tu lis la photo d'une étiquette de bouteille de vin (avant ou arrière) pour remplir la fiche de la cave de son propriétaire.
Réponds uniquement par un objet JSON avec exactement ces clés :
- "lisible" (booléen) : false si la photo ne montre pas d'étiquette de vin lisible.
- "domaine" (texte) : domaine, château ou producteur tel qu'écrit sur l'étiquette ; "" si absent.
- "cuvee" (texte) : nom de la cuvée ; "" si aucune.
- "millesime" (entier ou null) : année de récolte ; null si elle n'est pas visible.
- "couleur" : "rouge", "blanc", "rose" ou "orange".
- "type" : "tranquille", "effervescent", "liquoreux" ou "mute".
- "pays", "region" (grande région viticole, ex. Bordeaux, Bourgogne, Loire), "appellation" (appellation exacte), "cepages" (texte, "" si inconnus).
- "degre" (nombre ou null) : taux d'alcool EN % VOL, uniquement s'il est écrit sur la photo. Ne le devine jamais et ne le déduis jamais de tes connaissances : s'il n'est pas visible, mets null.
- "contenance" : "75 cl", "37,5 cl", "50 cl", "150 cl (magnum)" ou "300 cl" ; "75 cl" si elle n'est pas écrite.
- "champsIncertains" (liste) : noms des champs ci-dessus que tu as déduits de tes connaissances plutôt que lus sur la photo, ou mal lus. Exemples : la région déduite de l'appellation, les cépages non écrits, un mot flou.
- "lignes" (liste de textes) : les principales lignes de texte lues sur l'étiquette, dans l'ordre.
Recopie fidèlement les noms propres avec leurs accents. N'invente jamais une information : laisse le champ vide ou null.`;

  // Modèles qui ont répondu « limite atteinte » : mis de côté une minute (la limite gratuite est de 5 lectures par minute et par modèle).
  const satures = new Map();
  const occupe = (nom) => (satures.get(nom) || 0) > Date.now();

  async function appel(chemin, cle, options = {}) {
    let rep;
    try {
      rep = await fetch(`${BASE}/${chemin}`, { ...options, signal: AbortSignal.timeout(options.body ? 45000 : 15000), headers: { 'x-goog-api-key': cle, 'Content-Type': 'application/json' } });
    } catch (err) {
      const delai = !!err && err.name === 'TimeoutError';
      const e = new Error(delai ? 'Gemini met trop de temps à répondre.' : 'Pas de connexion internet.');
      e.reseau = true;
      e.delai = delai;
      throw e;
    }
    if (!rep.ok) {
      let detail = '';
      try { detail = (await rep.json()).error?.message || ''; } catch {}
      const e = new Error(messageStatut(rep.status, detail));
      e.status = rep.status;
      throw e;
    }
    return rep.json();
  }

  function messageStatut(status, detail) {
    if (status === 400 && /api key/i.test(detail)) return 'Clé Gemini refusée. Vérifie-la dans les réglages.';
    if (status === 401 || status === 403) return "Clé Gemini refusée ou sans accès. Vérifie-la dans les réglages (ou ta région n'est pas autorisée).";
    if (status === 404) return 'Modèle Gemini introuvable.';
    if (status === 429) return 'Limite gratuite de Gemini atteinte (5 lectures par minute et par modèle). Attends une minute puis réessaie.';
    if (status >= 500) return `Gemini est momentanément indisponible (${status}${detail ? ' : ' + detail.slice(0, 100) : ''}).`;
    return `Erreur Gemini (${status})${detail ? ' : ' + detail.slice(0, 120) : ''}.`;
  }

  // Choisit un modèle « flash » récent parmi ceux que la clé peut utiliser, plutôt que d'écrire un nom en dur.
  async function choisirModele(cle) {
    const ecartes = (await DB.get('reglages', 'modelesEcartes'))?.valeur || [];
    const dejaChoisi = (await DB.get('reglages', 'modeleGemini'))?.valeur;
    if (dejaChoisi) return dejaChoisi;
    const { models = [] } = await appel('models?pageSize=200', cle);
    const utilisables = models.filter((m) => (m.supportedGenerationMethods || []).includes('generateContent') && /gemini-[\d.]+-flash/.test(m.name)
      && !ecartes.includes(m.name.replace(/^models\//, '')) && !occupe(m.name.replace(/^models\//, '')) && !/lite|image|tts|live|audio|embedding|thinking|robotics|computer|exp|learnlm/.test(m.name));
    const version = (m) => parseFloat(m.name.match(/gemini-([\d.]+)-flash/)[1]);
    const stable = (m) => !/preview|-\d{3}$|-\d{2}-\d{2}/.test(m.name);
    utilisables.sort((a, b) => (stable(b) - stable(a)) || (version(b) - version(a)));
    // Modèle rapide connu en priorité : les plus récents « réfléchissent » longtemps et dépassent le délai.
    const rapide = utilisables.findIndex((m) => m.name === 'models/gemini-2.5-flash');
    if (rapide > 0) utilisables.unshift(utilisables.splice(rapide, 1)[0]);
    if (!utilisables.length) throw new Error("Aucun modèle Gemini « flash » n'est disponible avec cette clé.");
    const nom = utilisables[0].name.replace(/^models\//, '');
    await DB.put('reglages', { id: 'modeleGemini', valeur: nom });
    return nom;
  }

  async function generer(cle, parts, tentative = 0, sansReflexion = false, essai = false) {
    const modele = await choisirModele(cle);
    try {
      // Les modèles 2.5 « réfléchissent » longtemps par défaut : inutile pour lire une étiquette, on coupe.
      const config = { responseMimeType: 'application/json', temperature: 0 };
      if (!sansReflexion) {
        if (/gemini-2\.5/.test(modele)) config.thinkingConfig = { thinkingBudget: 0 };
        else if (/gemini-[3-9]/.test(modele)) config.thinkingConfig = { thinkingLevel: 'minimal' };
      }
      return await appel(`models/${modele}:generateContent`, cle, {
        method: 'POST',
        body: JSON.stringify({ contents: [{ parts }], generationConfig: config }),
      });
    } catch (e) {
      if (e.status === 400 && !sansReflexion) return generer(cle, parts, tentative, true, essai);
      // Modèle retiré depuis le dernier choix : on en choisit un autre une seule fois.
      if (e.status === 429 && tentative < 3) {
        satures.set(modele, Date.now() + 60000);
        await DB.del('reglages', 'modeleGemini');
        try { return await generer(cle, parts, tentative + 1, false, essai); } catch (e2) { throw e2.status === 429 || /Aucun modèle/.test(e2.message) ? e : e2; }
      }
      if ((e.status === 404 || (essai && (e.delai || e.status >= 500))) && tentative < 4) {
        const ecartes = (await DB.get('reglages', 'modelesEcartes'))?.valeur || [];
        await DB.put('reglages', { id: 'modelesEcartes', valeur: [...ecartes, modele] });
        await DB.del('reglages', 'modeleGemini');
        return generer(cle, parts, tentative + 1, false, essai);
      }
      throw e;
    }
  }

  const texte = (v, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

  function nettoyer(brut) {
    const annee = new Date().getFullYear();
    const choix = (v, ok, defaut) => (ok.includes(v) ? v : defaut);
    const f = {
      domaine: texte(brut.domaine), cuvee: texte(brut.cuvee),
      millesime: Number.isInteger(brut.millesime) && brut.millesime >= 1900 && brut.millesime <= annee ? brut.millesime : null,
      couleur: choix(brut.couleur, Object.keys(COULEURS), 'rouge'),
      type: choix(brut.type, Object.keys(TYPES), 'tranquille'),
      pays: texte(brut.pays), region: texte(brut.region), appellation: texte(brut.appellation), cepages: texte(brut.cepages, 120),
      degre: typeof brut.degre === 'number' && brut.degre >= 7 && brut.degre <= 23 ? brut.degre : null,
      contenance: choix(brut.contenance, CONTENANCES, '75 cl'),
    };
    f.profilGarde = profilGarde(f);
    f.champsIncertains = (Array.isArray(brut.champsIncertains) ? brut.champsIncertains : []).filter((c) => CHAMPS.includes(c));
    if (!f.millesime && !f.champsIncertains.includes('millesime')) f.champsIncertains.push('millesime');
    return f;
  }

  // Même logique que la lecture sur le téléphone, pour que les dates de garde restent cohérentes.
  function profilGarde(f) {
    const n = `${f.appellation} ${f.cuvee}`.toLowerCase();
    if (f.type === 'effervescent') return f.millesime ? 'champagne_mill' : 'champagne_nm';
    if (f.type === 'liquoreux' || f.type === 'mute') return 'liquoreux';
    if (f.couleur === 'rose' || /nouveau|primeur|muscadet|picpoul/.test(n)) return 'leger';
    if (f.couleur === 'rouge' && /grand cru|premier cru|1er cru|cru classé/.test(n)) return 'grand_rouge';
    if (f.couleur === 'rouge' && ['Beaujolais'].includes(f.region)) return 'rouge_leger';
    return GARDE.suggerer(f.couleur, f.type);
  }

  async function lireEtiquette(images, cle) {
    const liste = Array.isArray(images) ? images : [images];
    const intro = liste.length > 1
      ? "Il y a deux photos de la MÊME bouteille : d'abord l'étiquette de face, puis la contre-étiquette. Croise-les pour remplir une seule fiche (le degré et les cépages sont souvent au dos).\n"
      : '';
    const rep = await generer(cle, [{ text: intro + CONSIGNE }, ...liste.map((data) => ({ inline_data: { mime_type: 'image/jpeg', data } }))]);
    const cand = rep.candidates?.[0];
    const sortie = (cand?.content?.parts || []).map((p) => p.text || '').join('');
    if (!sortie) {
      const raison = rep.promptFeedback?.blockReason || cand?.finishReason || 'vide';
      throw new Error(`Gemini n'a pas répondu (${raison}).`);
    }
    let brut;
    try { brut = JSON.parse(sortie.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { throw new Error('Réponse de Gemini illisible.'); }
    if (brut.lisible === false) {
      const e = new Error("Je ne trouve pas d'étiquette lisible. Reprends la photo de face, bien éclairée et nette.");
      e.definitif = true;
      throw e;
    }
    return { fiche: nettoyer(brut), lignes: (Array.isArray(brut.lignes) ? brut.lignes : []).map((l) => texte(l, 100)).filter(Boolean).slice(0, 25) };
  }

  // Vérifie la clé : choisit un modèle puis lui pose une question simple.
  async function tester(cle) {
    const debut = Date.now();
    try {
      await DB.del('reglages', 'modeleGemini');
      await DB.del('reglages', 'modelesEcartes');
      const rep = await generer(cle, [{ text: 'Réponds par le mot OK.' }], 0, false, true);
      const modele = (await DB.get('reglages', 'modeleGemini'))?.valeur;
      return { ok: !!rep.candidates?.length, modele, secondes: Math.round((Date.now() - debut) / 1000) };
    } catch (e) {
      const modele = (await DB.get('reglages', 'modeleGemini'))?.valeur;
      return { ok: false, erreur: `${e.message}${modele ? ` (modèle ${modele}, ${Math.round((Date.now() - debut) / 1000)} s)` : ''}` };
    }
  }

  return { lireEtiquette, tester };
})();
