// Fenêtre de dégustation : règles par défaut selon le profil de garde.
// Décalages en années après le millésime : à partir de, apogée, avant.
const GARDE = {
  profils: {
    leger:          { nom: 'Rosé, blanc léger, primeur (1 à 3 ans)',      de: 0, apogee: 1,  avant: 3 },
    rouge_leger:    { nom: 'Rouge léger (2 à 5 ans)',                     de: 1, apogee: 3,  avant: 5 },
    rouge_moyen:    { nom: 'Rouge moyen (3 à 8 ans)',                     de: 2, apogee: 5,  avant: 8 },
    blanc_garde:    { nom: 'Blanc de garde (4 à 10 ans)',                 de: 3, apogee: 6,  avant: 10 },
    grand_rouge:    { nom: 'Grand rouge de garde (8 à 25 ans)',           de: 8, apogee: 15, avant: 25 },
    liquoreux:      { nom: 'Liquoreux, vin doux naturel (10 à 30 ans)',   de: 5, apogee: 15, avant: 30 },
    champagne_nm:   { nom: 'Champagne non millésimé (2 à 4 ans)',         de: 0, apogee: 2,  avant: 4 },
    champagne_mill: { nom: 'Champagne millésimé (5 à 15 ans)',            de: 5, apogee: 10, avant: 15 },
  },

  // Profil proposé par défaut selon la couleur et le type.
  suggerer(couleur, type) {
    if (type === 'effervescent') return 'champagne_nm';
    if (type === 'liquoreux' || type === 'mute') return 'liquoreux';
    if (couleur === 'rose') return 'leger';
    if (couleur === 'blanc' || couleur === 'orange') return 'blanc_garde';
    return 'rouge_moyen';
  },

  // Dates effectives : celles saisies à la main priment sur la règle.
  dates(vin) {
    const p = this.profils[vin.profilGarde];
    const base = Number(vin.millesime) || (vin.anneeAchat ? Number(vin.anneeAchat) : null);
    const calc = (k) => (p && base ? base + p[k] : null);
    const d = {
      de: vin.boireDe ? Number(vin.boireDe) : calc('de'),
      apogee: vin.apogee ? Number(vin.apogee) : calc('apogee'),
      avant: vin.boireAvant ? Number(vin.boireAvant) : calc('avant'),
    };
    d.source = vin.boireDe || vin.apogee || vin.boireAvant ? 'moi' : (p && base ? 'règle' : null);
    return d;
  },

  statuts: {
    jeune:   { label: 'Trop jeune',    ordre: 4 },
    pret:    { label: 'Prêt',          ordre: 3 },
    apogee:  { label: "À l'apogée",    ordre: 2 },
    vite:    { label: 'À boire vite',  ordre: 1 },
    passe:   { label: 'Passé',         ordre: 0 },
    inconnu: { label: 'Dates inconnues', ordre: 5 },
  },

  statut(vin, annee = new Date().getFullYear()) {
    const { de, apogee, avant } = this.dates(vin);
    if (!de && !avant) return 'inconnu';
    if (avant && annee > avant) return 'passe';
    if (de && annee < de) return 'jeune';
    if (avant && annee >= avant - 1 && avant - (de || avant) >= 2) return 'vite';
    if (avant && annee === avant) return 'vite';
    if (apogee && Math.abs(annee - apogee) <= 1) return 'apogee';
    return 'pret';
  },
};
