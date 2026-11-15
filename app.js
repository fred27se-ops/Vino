// Ap Vino : écrans et logique de l'application.
const COULEURS = { rouge: 'Rouge', blanc: 'Blanc', rose: 'Rosé', orange: 'Orange' };
const TYPES = { tranquille: 'Tranquille', effervescent: 'Effervescent', liquoreux: 'Liquoreux / moelleux', mute: 'Muté (Porto, VDN)' };
const SORTIES = { bue: 'Bue', offerte: 'Offerte', cassee: 'Cassée / bouchonnée' };
const RAPPEL_SAUVEGARDE_JOURS = 30;

const view = document.getElementById('view');
const titleEl = document.getElementById('page-title');
const backBtn = document.getElementById('back-btn');
const addBtn = document.getElementById('add-btn');

// État des filtres de la liste, conservé pendant la session.
const filtres = { texte: '', couleur: '', type: '', statut: '', etagere: '', tri: 'urgence', epuises: false };

// ---------- Utilitaires ----------
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const euros = (n) => (n || n === 0) && !isNaN(n) ? Number(n).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) : '';
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const dateFr = (iso) => iso ? new Date(iso).toLocaleDateString('fr-FR') : '';
const num = (v) => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 2500);
}

function nomVin(v) {
  return [v.domaine, v.cuvee].filter(Boolean).join(' · ') || 'Vin sans nom';
}

async function chargerCave() {
  const [vins, lots, etageres] = await Promise.all([DB.all('vins'), DB.all('lots'), DB.all('etageres')]);
  etageres.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || a.nom.localeCompare(b.nom));
  const parVin = {};
  for (const l of lots) (parVin[l.vinId] ||= []).push(l);
  for (const v of vins) {
    v.lots = parVin[v.id] || [];
    v.quantite = v.lots.reduce((s, l) => s + (Number(l.quantite) || 0), 0);
    v.cout = v.lots.reduce((s, l) => s + (Number(l.quantite) || 0) * coutUnitaire(l), 0);
    v.statut = GARDE.statut(v);
  }
  return { vins, lots, etageres };
}

// Coût d'une bouteille : prix unitaire + part des frais du lot.
function coutUnitaire(lot) {
  const prix = Number(lot.prixUnitaire) || 0;
  const frais = Number(lot.frais) || 0;
  const initiale = Number(lot.quantiteInitiale) || Number(lot.quantite) || 1;
  return prix + frais / initiale;
}

// ---------- Navigation ----------
function aller(hash) { location.hash = hash; }

async function router() {
  const [, page, id] = location.hash.replace(/^#/, '').split('/');
  window.scrollTo(0, 0);
  backBtn.hidden = !page;
  addBtn.hidden = !!page;
  try {
    if (!page) await ecranListe();
    else if (page === 'vin') await ecranFiche(id);
    else if (page === 'ajout') await ecranFormulaire();
    else if (page === 'modifier') await ecranFormulaire(id);
    else if (page === 'reglages') await ecranReglages();
    else aller('');
  } catch (e) {
    console.error(e);
    view.innerHTML = `<p class="vide">Une erreur est survenue : ${esc(e.message)}</p>`;
  }
  await verifierRappelSauvegarde();
}

backBtn.addEventListener('click', () => (history.length > 1 ? history.back() : aller('')));
document.getElementById('settings-btn').addEventListener('click', () => aller('/reglages'));
addBtn.addEventListener('click', () => aller('/ajout'));
window.addEventListener('hashchange', router);

// ---------- Liste ----------
async function ecranListe() {
  titleEl.textContent = 'Ma cave';
  const { vins, etageres } = await chargerCave();
  const enStock = vins.filter((v) => v.quantite > 0);
  const totalBouteilles = enStock.reduce((s, v) => s + v.quantite, 0);
  const totalCout = enStock.reduce((s, v) => s + v.cout, 0);

  const opts = (obj, sel, vide) => `<option value="">${vide}</option>` +
    Object.entries(obj).map(([k, l]) => `<option value="${k}" ${sel === k ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const statutsOpts = Object.fromEntries(Object.entries(GARDE.statuts).map(([k, s]) => [k, s.label]));
  const etagOpts = Object.fromEntries(etageres.map((e) => [e.id, e.nom]));

  view.innerHTML = `
    <section class="resume">
      <div><strong>${totalBouteilles}</strong><span>bouteilles</span></div>
      <div><strong>${enStock.length}</strong><span>références</span></div>
      <div><strong>${euros(totalCout) || '0 €'}</strong><span>coût d'achat</span></div>
    </section>
    <section class="filtres">
      <input type="search" id="f-texte" placeholder="Rechercher (domaine, appellation, cépage…)" value="${esc(filtres.texte)}">
      <div class="filtres-grille">
        <select id="f-couleur">${opts(COULEURS, filtres.couleur, 'Toutes couleurs')}</select>
        <select id="f-type">${opts(TYPES, filtres.type, 'Tous types')}</select>
        <select id="f-statut">${opts(statutsOpts, filtres.statut, 'Tous statuts')}</select>
        <select id="f-etagere">${opts(etagOpts, filtres.etagere, 'Toutes étagères')}</select>
        <select id="f-tri">
          <option value="urgence">Tri : urgence</option>
          <option value="nom">Tri : nom</option>
          <option value="millesime">Tri : millésime</option>
          <option value="region">Tri : région</option>
          <option value="prix">Tri : prix</option>
          <option value="quantite">Tri : quantité</option>
        </select>
        <label class="check"><input type="checkbox" id="f-epuises" ${filtres.epuises ? 'checked' : ''}> Vins épuisés</label>
      </div>
    </section>
    <ul class="liste" id="liste"></ul>`;
  document.getElementById('f-tri').value = filtres.tri;

  const dessiner = () => {
    const t = filtres.texte.trim().toLowerCase();
    let res = vins.filter((v) => (filtres.epuises ? true : v.quantite > 0));
    if (t) res = res.filter((v) => [v.domaine, v.cuvee, v.appellation, v.region, v.pays, v.cepages, v.millesime]
      .some((x) => String(x || '').toLowerCase().includes(t)));
    if (filtres.couleur) res = res.filter((v) => v.couleur === filtres.couleur);
    if (filtres.type) res = res.filter((v) => v.type === filtres.type);
    if (filtres.statut) res = res.filter((v) => v.statut === filtres.statut);
    if (filtres.etagere) res = res.filter((v) => v.lots.some((l) => l.etagereId === filtres.etagere && l.quantite > 0));

    const prixMoyen = (v) => (v.lots.length ? v.lots.reduce((s, l) => s + coutUnitaire(l), 0) / v.lots.length : 0);
    const cmp = {
      urgence: (a, b) => GARDE.statuts[a.statut].ordre - GARDE.statuts[b.statut].ordre || (GARDE.dates(a).avant || 9999) - (GARDE.dates(b).avant || 9999),
      nom: (a, b) => nomVin(a).localeCompare(nomVin(b)),
      millesime: (a, b) => (Number(a.millesime) || 0) - (Number(b.millesime) || 0),
      region: (a, b) => String(a.region || '').localeCompare(String(b.region || '')) || nomVin(a).localeCompare(nomVin(b)),
      prix: (a, b) => prixMoyen(b) - prixMoyen(a),
      quantite: (a, b) => b.quantite - a.quantite,
    }[filtres.tri];
    res.sort(cmp);

    const ul = document.getElementById('liste');
    if (!vins.length) {
      ul.innerHTML = `<li class="vide">Ta cave est vide.<br>Appuie sur <strong>+</strong> pour ajouter ta première bouteille.</li>`;
      return;
    }
    if (!res.length) { ul.innerHTML = `<li class="vide">Aucun vin ne correspond à ces filtres.</li>`; return; }
    ul.innerHTML = res.map((v) => {
      const etag = [...new Set(v.lots.filter((l) => l.quantite > 0).map((l) => etagOpts[l.etagereId]).filter(Boolean))].join(', ');
      return `<li><a href="#/vin/${v.id}" class="carte ${v.quantite ? '' : 'epuise'}">
        <span class="pastille c-${esc(v.couleur || 'rouge')}"></span>
        <span class="carte-texte">
          <span class="carte-titre">${esc(nomVin(v))}</span>
          <span class="carte-sous">${esc([v.appellation || v.region, v.millesime].filter(Boolean).join(' · '))}</span>
          ${etag ? `<span class="carte-sous">${esc(etag)}</span>` : ''}
        </span>
        <span class="carte-droite">
          <span class="qte">×${v.quantite}</span>
          <span class="badge s-${v.statut}">${GARDE.statuts[v.statut].label}</span>
        </span>
      </a></li>`;
    }).join('');
  };

  const lier = (id, cle, evt = 'change', val = (el) => el.value) =>
    document.getElementById(id).addEventListener(evt, (e) => { filtres[cle] = val(e.target); dessiner(); });
  lier('f-texte', 'texte', 'input');
  lier('f-couleur', 'couleur');
  lier('f-type', 'type');
  lier('f-statut', 'statut');
  lier('f-etagere', 'etagere');
  lier('f-tri', 'tri');
  lier('f-epuises', 'epuises', 'change', (el) => el.checked);
  dessiner();
}

// ---------- Fiche d'un vin ----------
async function ecranFiche(id) {
  const { vins, etageres } = await chargerCave();
  const v = vins.find((x) => x.id === id);
  if (!v) return aller('');
  titleEl.textContent = 'Fiche du vin';
  const mouvements = (await DB.byVin('mouvements', id)).sort((a, b) => b.date.localeCompare(a.date) || b.cree - a.cree);
  const nomEtag = (eid) => etageres.find((e) => e.id === eid)?.nom || 'Sans étagère';
  const d = GARDE.dates(v);
  const annee = new Date().getFullYear();

  const ligne = (label, val) => (val ? `<dt>${label}</dt><dd>${esc(val)}</dd>` : '');
  let frise = '';
  if (d.de && d.avant && d.avant > d.de) {
    const debut = Math.min(d.de, annee) - 1, fin = Math.max(d.avant, annee) + 1;
    const pos = (y) => ((y - debut) / (fin - debut)) * 100;
    frise = `<div class="frise">
      <div class="frise-zone" style="left:${pos(d.de)}%;width:${pos(d.avant) - pos(d.de)}%"></div>
      ${d.apogee ? `<div class="frise-apogee" style="left:${pos(d.apogee)}%"></div>` : ''}
      <div class="frise-auj" style="left:${pos(annee)}%"><span>${annee}</span></div>
    </div>`;
  }

  view.innerHTML = `
    <article class="fiche">
      <div class="fiche-tete">
        <span class="pastille grande c-${esc(v.couleur || 'rouge')}"></span>
        <div>
          <h2>${esc(nomVin(v))}</h2>
          <p class="sous">${esc([v.appellation, v.millesime].filter(Boolean).join(' · '))}</p>
        </div>
      </div>
      ${v.photo ? `<img class="photo-fiche" src="${v.photo}" alt="Étiquette de ${esc(nomVin(v))}">` : ''}

      <div class="stock">
        <div><strong>${v.quantite}</strong> bouteille${v.quantite > 1 ? 's' : ''} en cave</div>
        <div class="actions">
          <button class="btn primaire" id="btn-sortie" ${v.quantite ? '' : 'disabled'}>Sortir une bouteille</button>
          <button class="btn" id="btn-lot">Ajouter des bouteilles</button>
        </div>
      </div>

      <section class="bloc">
        <h3>Quand la boire</h3>
        <p><span class="badge s-${v.statut}">${GARDE.statuts[v.statut].label}</span></p>
        ${d.de || d.avant ? `<p class="dates">À partir de <strong>${d.de ?? '?'}</strong> · apogée <strong>${d.apogee ?? '?'}</strong> · avant <strong>${d.avant ?? '?'}</strong></p>
        ${frise}
        <p class="note">Source : ${d.source === 'moi' ? 'dates saisies par toi' : 'règle selon le profil de garde (' + esc(GARDE.profils[v.profilGarde]?.nom || '') + ')'}</p>`
        : `<p class="note">Indique le millésime (ou l'année d'achat) et un profil de garde pour calculer les dates.</p>`}
      </section>

      <section class="bloc">
        <h3>Caractéristiques</h3>
        <dl>
          ${ligne('Couleur', COULEURS[v.couleur])}
          ${ligne('Type', TYPES[v.type])}
          ${ligne('Pays', v.pays)}
          ${ligne('Région', v.region)}
          ${ligne('Appellation', v.appellation)}
          ${ligne('Cépages', v.cepages)}
          ${ligne('Degré', v.degre ? v.degre + ' %' : '')}
          ${ligne('Contenance', v.contenance)}
        </dl>
        ${v.notes ? `<p class="notes">${esc(v.notes)}</p>` : ''}
      </section>

      <section class="bloc">
        <h3>Achats et emplacements</h3>
        ${v.lots.length ? `<ul class="lots">${v.lots.map((l) => `
          <li>
            <div><strong>×${l.quantite}</strong> · ${esc(nomEtag(l.etagereId))}</div>
            <div class="note">${[l.prixUnitaire ? euros(coutUnitaire(l)) + ' / bouteille' : '', l.lieuAchat, dateFr(l.dateAchat)].filter(Boolean).map(esc).join(' · ')}</div>
            <button class="lien" data-lot="${l.id}">Modifier</button>
          </li>`).join('')}</ul>
          <p class="note">Coût des bouteilles en cave : <strong>${euros(v.cout) || '—'}</strong></p>`
        : '<p class="note">Aucun achat enregistré.</p>'}
      </section>

      ${mouvements.length ? `<section class="bloc">
        <h3>Historique</h3>
        <ul class="historique">${mouvements.map((m) => `<li>${dateFr(m.date)} · ${esc(m.type === 'achat' ? 'Achat' : m.type === 'correction' ? 'Correction' : SORTIES[m.type])} · ${m.quantite > 0 ? '+' : ''}${m.quantite}</li>`).join('')}</ul>
      </section>` : ''}

      <div class="actions bas">
        <button class="btn" id="btn-modifier">Modifier la fiche</button>
        <button class="btn danger" id="btn-supprimer">Supprimer</button>
      </div>
    </article>`;

  document.getElementById('btn-modifier').onclick = () => aller('/modifier/' + v.id);
  document.getElementById('btn-supprimer').onclick = async () => {
    if (!confirm(`Supprimer définitivement « ${nomVin(v)} » et son historique ?`)) return;
    for (const l of v.lots) await DB.del('lots', l.id);
    for (const m of mouvements) await DB.del('mouvements', m.id);
    await DB.del('vins', v.id);
    toast('Vin supprimé');
    aller('');
  };
  document.getElementById('btn-sortie').onclick = () => dialogueSortie(v, etageres);
  document.getElementById('btn-lot').onclick = () => dialogueLot(v, etageres);
  view.querySelectorAll('[data-lot]').forEach((b) => (b.onclick = () => dialogueLot(v, etageres, v.lots.find((l) => l.id === b.dataset.lot))));
}

function ouvrirDialogue(html, onSubmit) {
  const dlg = document.createElement('dialog');
  dlg.className = 'dialogue';
  dlg.innerHTML = `<form method="dialog">${html}
    <div class="actions"><button class="btn" value="annuler" formnovalidate>Annuler</button><button class="btn primaire" value="ok">Valider</button></div></form>`;
  document.body.appendChild(dlg);
  dlg.addEventListener('close', async () => {
    if (dlg.returnValue === 'ok') await onSubmit(new FormData(dlg.querySelector('form')), dlg);
    dlg.remove();
  });
  dlg.showModal();
  return dlg;
}

function dialogueSortie(v, etageres) {
  const lots = v.lots.filter((l) => l.quantite > 0);
  const nomEtag = (eid) => etageres.find((e) => e.id === eid)?.nom || 'Sans étagère';
  ouvrirDialogue(`
    <h3>Sortir une bouteille</h3>
    <label>Raison
      <select name="type">${Object.entries(SORTIES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
    </label>
    ${lots.length > 1 ? `<label>Depuis
      <select name="lotId">${lots.map((l) => `<option value="${l.id}">${esc(nomEtag(l.etagereId))} (×${l.quantite}${l.prixUnitaire ? ', ' + euros(coutUnitaire(l)) : ''})</option>`).join('')}</select>
    </label>` : `<input type="hidden" name="lotId" value="${lots[0].id}">`}
    <label>Nombre<input type="number" name="quantite" min="1" max="${v.quantite}" value="1" required></label>
    <label>Date<input type="date" name="date" value="${aujourdhui()}" required></label>`,
  async (fd) => {
    const lot = v.lots.find((l) => l.id === fd.get('lotId'));
    const q = Math.min(Number(fd.get('quantite')) || 1, lot.quantite);
    lot.quantite -= q;
    const { ...brut } = lot;
    await DB.put('lots', brut);
    await DB.put('mouvements', { id: DB.uid(), vinId: v.id, lotId: lot.id, type: fd.get('type'), quantite: -q, date: fd.get('date'), cree: Date.now() });
    toast(q > 1 ? `${q} bouteilles sorties` : 'Bouteille sortie');
    router();
  });
}

function champsLot(etageres, l = {}) {
  return `
    <label>Nombre de bouteilles<input type="number" name="quantite" min="0" value="${esc(l.quantite ?? 1)}" required></label>
    <label>Étagère
      <select name="etagereId"><option value="">Sans étagère</option>
        ${etageres.map((e) => `<option value="${e.id}" ${l.etagereId === e.id ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}
      </select>
    </label>
    <div class="deux">
      <label>Prix par bouteille (€)<input type="number" name="prixUnitaire" min="0" step="0.01" inputmode="decimal" value="${esc(l.prixUnitaire ?? '')}"></label>
      <label>Frais du lot (€)<input type="number" name="frais" min="0" step="0.01" inputmode="decimal" value="${esc(l.frais ?? '')}" placeholder="port, primeur…"></label>
    </div>
    <div class="deux">
      <label>Date d'achat<input type="date" name="dateAchat" value="${esc(l.dateAchat ?? aujourdhui())}"></label>
      <label>Lieu d'achat<input type="text" name="lieuAchat" value="${esc(l.lieuAchat ?? '')}" placeholder="caviste, domaine…"></label>
    </div>`;
}

function lotDepuis(fd, base = {}) {
  return {
    ...base,
    quantite: Number(fd.get('quantite')) || 0,
    etagereId: fd.get('etagereId') || '',
    prixUnitaire: num(fd.get('prixUnitaire')),
    frais: num(fd.get('frais')),
    dateAchat: fd.get('dateAchat') || '',
    lieuAchat: (fd.get('lieuAchat') || '').trim(),
  };
}

function dialogueLot(v, etageres, lot) {
  ouvrirDialogue(`<h3>${lot ? 'Modifier cet achat' : 'Ajouter des bouteilles'}</h3>${champsLot(etageres, lot)}
    ${lot ? '<p class="note">Mettre le nombre à 0 vide cet emplacement.</p>' : ''}`,
  async (fd) => {
    if (lot) {
      const { ...ancien } = lot;
      const maj = lotDepuis(fd, ancien);
      const delta = maj.quantite - ancien.quantite;
      await DB.put('lots', maj);
      if (delta) await DB.put('mouvements', { id: DB.uid(), vinId: v.id, lotId: lot.id, type: 'correction', quantite: delta, date: aujourdhui(), cree: Date.now() });
    } else {
      const nouveau = lotDepuis(fd, { id: DB.uid(), vinId: v.id });
      nouveau.quantiteInitiale = nouveau.quantite;
      await DB.put('lots', nouveau);
      if (nouveau.quantite) await DB.put('mouvements', { id: DB.uid(), vinId: v.id, lotId: nouveau.id, type: 'achat', quantite: nouveau.quantite, date: nouveau.dateAchat || aujourdhui(), cree: Date.now() });
    }
    toast('Enregistré');
    router();
  });
}

// ---------- Formulaire d'ajout / modification ----------
async function ecranFormulaire(id) {
  const { vins, etageres } = await chargerCave();
  const v = id ? vins.find((x) => x.id === id) : null;
  if (id && !v) return aller('');
  titleEl.textContent = v ? 'Modifier le vin' : 'Ajouter un vin';
  const val = (k) => esc(v?.[k] ?? '');
  const suggestions = (k) => [...new Set(vins.map((x) => x[k]).filter(Boolean))].sort().map((x) => `<option value="${esc(x)}">`).join('');
  const select = (name, obj, sel) => `<select name="${name}">${Object.entries(obj).map(([k, l]) => `<option value="${k}" ${sel === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const profils = Object.fromEntries(Object.entries(GARDE.profils).map(([k, p]) => [k, p.nom]));

  view.innerHTML = `
    <form class="formulaire" id="form-vin" autocomplete="off">
      <section class="scan">
        <label class="btn primaire">&#128247; ${v?.photo ? "Reprendre la photo de l'étiquette" : "Scanner l'étiquette"}
          <input type="file" id="in-photo" accept="image/*" capture="environment" hidden>
        </label>
        <img id="apercu-photo" class="photo-apercu" alt="" ${v?.photo ? `src="${v.photo}"` : 'hidden'}>
        <div id="scan-mots" class="mots" hidden></div>
        <details id="scan-texte" hidden><summary>Voir le texte lu sur l'étiquette</summary><pre class="texte-lu"></pre></details>
        <p class="note" id="scan-etat">${v ? '' : "L'app lit l'étiquette et pré-remplit la fiche ; tu vérifies avant d'enregistrer."}</p>
        <p class="note" id="scan-aide" hidden>Un champ est faux ou vide ? Touche-le, puis touche le bon mot lu ci-dessus.</p>
      </section>
      <fieldset>
        <legend>Le vin</legend>
        <label>Domaine / château<input name="domaine" value="${val('domaine')}" list="dl-domaine" required></label>
        <label>Cuvée<input name="cuvee" value="${val('cuvee')}" placeholder="facultatif"></label>
        <div class="deux">
          <label>Millésime<input name="millesime" type="number" inputmode="numeric" min="1900" max="2100" value="${val('millesime')}" placeholder="vide si non millésimé"></label>
          <label>Contenance${select('contenance', { '75 cl': '75 cl', '37,5 cl': '37,5 cl', '50 cl': '50 cl', '150 cl (magnum)': '150 cl (magnum)', '300 cl': '300 cl' }, v?.contenance || '75 cl')}</label>
        </div>
        <div class="deux">
          <label>Couleur${select('couleur', COULEURS, v?.couleur || 'rouge')}</label>
          <label>Type${select('type', TYPES, v?.type || 'tranquille')}</label>
        </div>
        <div class="deux">
          <label>Pays<input name="pays" value="${v ? val('pays') : 'France'}" list="dl-pays"></label>
          <label>Région<input name="region" value="${val('region')}" list="dl-region" placeholder="Bordeaux, Loire…"></label>
        </div>
        <label>Appellation<input name="appellation" value="${val('appellation')}" list="dl-appellation" placeholder="Saint-Julien, Chablis…"></label>
        <div class="deux">
          <label>Cépages<input name="cepages" value="${val('cepages')}" placeholder="Merlot, Cabernet…"></label>
          <label>Degré (%)<input name="degre" type="number" step="0.1" inputmode="decimal" value="${val('degre')}"></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Garde</legend>
        <label>Profil de garde${select('profilGarde', profils, v?.profilGarde || 'rouge_moyen')}</label>
        <p class="note" id="apercu-dates"></p>
        <details ${v?.boireDe || v?.apogee || v?.boireAvant ? 'open' : ''}>
          <summary>Mettre mes propres dates</summary>
          <div class="trois">
            <label>À partir de<input name="boireDe" type="number" inputmode="numeric" value="${val('boireDe')}"></label>
            <label>Apogée<input name="apogee" type="number" inputmode="numeric" value="${val('apogee')}"></label>
            <label>Avant<input name="boireAvant" type="number" inputmode="numeric" value="${val('boireAvant')}"></label>
          </div>
          <p class="note">Laisse vide pour utiliser la règle du profil.</p>
        </details>
      </fieldset>

      ${v ? '' : `<fieldset><legend>Achat</legend>${champsLot(etageres)}
        ${etageres.length ? '' : '<p class="note">Astuce : crée tes étagères dans les réglages (⚙).</p>'}</fieldset>`}

      <fieldset>
        <legend>Notes</legend>
        <textarea name="notes" rows="3" placeholder="Impressions, occasion, conseil du caviste…">${val('notes')}</textarea>
      </fieldset>

      <div class="actions bas">
        <button type="button" class="btn" id="btn-annuler">Annuler</button>
        <button type="submit" class="btn primaire">Enregistrer</button>
      </div>
    </form>
    <datalist id="dl-domaine">${suggestions('domaine')}</datalist>
    <datalist id="dl-region">${suggestions('region')}</datalist>
    <datalist id="dl-appellation">${suggestions('appellation')}</datalist>
    <datalist id="dl-pays">${suggestions('pays')}<option value="France"><option value="Italie"><option value="Espagne"><option value="Portugal"></datalist>`;

  const form = document.getElementById('form-vin');
  let profilTouche = !!v;
  const majApercu = () => {
    const fd = new FormData(form);
    const brouillon = { millesime: fd.get('millesime'), profilGarde: fd.get('profilGarde'), anneeAchat: (fd.get('dateAchat') || '').slice(0, 4),
      boireDe: fd.get('boireDe'), apogee: fd.get('apogee'), boireAvant: fd.get('boireAvant') };
    const d = GARDE.dates(brouillon);
    document.getElementById('apercu-dates').textContent = d.de || d.avant
      ? `À boire à partir de ${d.de ?? '?'}, apogée ${d.apogee ?? '?'}, avant ${d.avant ?? '?'}.`
      : 'Indique le millésime pour calculer les dates.';
  };
  form.addEventListener('input', (e) => {
    if (e.target.name === 'profilGarde') profilTouche = true;
    if (!profilTouche && (e.target.name === 'couleur' || e.target.name === 'type')) {
      form.profilGarde.value = GARDE.suggerer(form.couleur.value, form.type.value);
    }
    majApercu();
  });
  majApercu();
  document.getElementById('btn-annuler').onclick = () => history.back();

  let photo = v?.photo || null;
  const etat = document.getElementById('scan-etat');
  // Dernier champ touché : un mot lu touché ensuite est placé dedans.
  let champCible = form.elements.domaine;
  form.addEventListener('focusin', (e) => { if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.target.name) champCible = e.target; });
  const afficherTexteLu = (texte, lignes = []) => {
    const bloc = document.getElementById('scan-texte');
    bloc.hidden = !texte;
    document.getElementById('scan-aide').hidden = !lignes.length;
    bloc.querySelector('pre').textContent = texte || '';
    const zone = document.getElementById('scan-mots');
    zone.innerHTML = [...new Set(lignes)].map((l) => `<button type="button" class="mot">${esc(l)}</button>`).join('');
    zone.hidden = !lignes.length;
    zone.querySelectorAll('.mot').forEach((b) => {
      b.addEventListener('pointerdown', (ev) => ev.preventDefault());
      b.addEventListener('click', () => {
        if (champCible.tagName === 'SELECT') return toast('Touche d\'abord un champ texte (domaine, appellation…)');
        champCible.value = champCible.type === 'number' ? b.textContent.replace(/\D/g, '') : b.textContent;
        champCible.classList.add('ia');
        champCible.dispatchEvent(new Event('input', { bubbles: true }));
        toast(`« ${b.textContent} » placé dans « ${champCible.closest('label')?.firstChild?.textContent?.trim() || 'le champ'} »`);
      });
    });
  };
  document.getElementById('in-photo').addEventListener('change', async (e) => {
    const fichier = e.target.files[0];
    e.target.value = '';
    if (!fichier) return;
    // Deuxième photo (contre-étiquette) : on ne complète que les champs encore vides.
    const complement = form.dataset.scanne === '1';
    if (!complement) {
      const apercu = document.getElementById('apercu-photo');
      apercu.src = URL.createObjectURL(fichier);
      apercu.hidden = false;
      form.querySelectorAll('.ia, .ia-doute').forEach((el) => el.classList.remove('ia', 'ia-doute'));
    }
    etat.textContent = "Lecture de l'étiquette…";
    etat.className = 'note attente';
    afficherTexteLu('');
    try {
      const res = await SCAN.lireEtiquette(fichier, (m) => (etat.textContent = m));
      afficherTexteLu(res.texte, res.lignes);
      if (!complement) photo = res.photo;
      remplirDepuisScan(form, res.fiche, complement);
      form.dataset.scanne = '1';
      profilTouche = true;
      majApercu();
      const doutes = res.fiche.champsIncertains.length;
      const origine = res.moteur === 'gemini' ? ` par Gemini (${res.secondes} s)` : ' sur le téléphone';
      etat.textContent = (res.avertissement ? res.avertissement + ' ' : '') + (complement
        ? 'Contre-étiquette lue : seuls les champs vides ont été complétés.'
        : (doutes
          ? `Fiche pré-remplie${origine}. Vérifie surtout les ${doutes} champ${doutes > 1 ? 's' : ''} en orange, puis complète l'achat.`
          : `Fiche pré-remplie${origine}. Vérifie-la, puis complète l'achat.`)
        + ' Taux d\'alcool absent ? Scanne la contre-étiquette.');
      etat.className = res.avertissement ? 'note attente' : 'note ok';
    } catch (err) {
      // La photo reste attachée à la fiche même si la lecture échoue.
      if (!complement) { try { photo = await SCAN.photoFiche(fichier); } catch {} }
      etat.textContent = err.message;
      etat.className = 'note erreur';
      afficherTexteLu(err.texte, err.lignes);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const texte = (k) => (fd.get(k) || '').toString().trim();
    const vin = {
      ...(v ? stripCalc(v) : { id: DB.uid(), cree: Date.now() }),
      domaine: texte('domaine'), cuvee: texte('cuvee'), millesime: num(fd.get('millesime')),
      contenance: texte('contenance'), couleur: texte('couleur'), type: texte('type'),
      pays: texte('pays'), region: texte('region'), appellation: texte('appellation'),
      cepages: texte('cepages'), degre: num(fd.get('degre')), profilGarde: texte('profilGarde'),
      boireDe: num(fd.get('boireDe')), apogee: num(fd.get('apogee')), boireAvant: num(fd.get('boireAvant')),
      notes: texte('notes'), photo, modifie: Date.now(),
    };
    if (!v) {
      const lot = lotDepuis(fd, { id: DB.uid(), vinId: vin.id });
      lot.quantiteInitiale = lot.quantite;
      vin.anneeAchat = lot.dateAchat ? Number(lot.dateAchat.slice(0, 4)) : new Date().getFullYear();
      await DB.put('vins', vin);
      await DB.put('lots', lot);
      if (lot.quantite) await DB.put('mouvements', { id: DB.uid(), vinId: vin.id, lotId: lot.id, type: 'achat', quantite: lot.quantite, date: lot.dateAchat || aujourdhui(), cree: Date.now() });
    } else {
      await DB.put('vins', vin);
    }
    toast('Vin enregistré');
    location.replace('#/vin/' + vin.id);
  });
}

// Reporte la fiche lue sur l'étiquette dans le formulaire et signale les champs à vérifier.
function remplirDepuisScan(form, fiche, complement = false) {
  const champs = ['domaine', 'cuvee', 'millesime', 'couleur', 'type', 'pays', 'region', 'appellation', 'cepages', 'degre', 'contenance', 'profilGarde'];
  for (const k of champs) {
    const el = form.elements[k];
    const val = fiche[k];
    if (!el || val === null || val === undefined || val === '') continue;
    // En complément, ni les listes déroulantes ni les champs déjà remplis ne sont touchés.
    if (complement && (el.tagName === 'SELECT' || el.value !== '')) continue;
    el.value = val;
    el.classList.add(fiche.champsIncertains.includes(k) ? 'ia-doute' : 'ia');
  }
  if (!complement) for (const k of fiche.champsIncertains) form.elements[k]?.classList.add('ia-doute');
}

// Retire les champs calculés avant d'enregistrer un vin.
function stripCalc(v) {
  const { lots, quantite, cout, statut, ...brut } = v;
  return brut;
}

// ---------- Réglages ----------
async function ecranReglages() {
  titleEl.textContent = 'Réglages';
  const { vins, etageres } = await chargerCave();
  const derniere = await DB.get('reglages', 'derniereSauvegarde');
  const persistant = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
  const peutPartager = !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.json', { type: 'application/json' })] }));

  const cleGemini = (await DB.get('reglages', 'cleGemini'))?.valeur || '';

  view.innerHTML = `
    <section class="bloc">
      <h3>Lecture par Gemini (facultatif)</h3>
      <p class="note">Plus fiable que la lecture sur le téléphone : l'étiquette est envoyée à Google, qui répond avec la fiche. Il faut une clé gratuite sur aistudio.google.com/apikey. Avec l'offre gratuite, Google peut utiliser les photos envoyées pour améliorer ses produits. La clé reste sur ce téléphone, jamais dans les sauvegardes. Sans clé, ou en cas de problème, la lecture se fait sur le téléphone.</p>
      <form id="form-gemini">
        <label>Clé Gemini<input name="cle" type="password" autocomplete="off" placeholder="AIza…" value="${esc(cleGemini)}"></label>
        <div class="actions"><button class="btn primaire">Enregistrer et tester</button></div>
        <p class="note" id="gemini-etat">${cleGemini ? 'Clé enregistrée.' : 'Aucune clé : lecture sur le téléphone.'}</p>
      </form>
    </section>

    <section class="bloc">
      <h3>Mes étagères</h3>
      <ul class="etageres">${etageres.map((e) => `<li>
        <span>${esc(e.nom)}</span>
        <span><button class="lien" data-ren="${e.id}">Renommer</button> <button class="lien danger" data-sup="${e.id}">Supprimer</button></span>
      </li>`).join('') || '<li class="note">Aucune étagère pour l\'instant.</li>'}</ul>
      <form id="form-etagere" class="ligne">
        <input name="nom" placeholder="Nouvelle étagère (ex. Étagère du haut)" required>
        <button class="btn">Ajouter</button>
      </form>
    </section>

    <section class="bloc">
      <h3>Sauvegarde</h3>
      <p>Tes données sont <strong>uniquement sur ce téléphone</strong>. Sauvegarde-les chaque mois et range le fichier dans Google Drive.</p>
      <p class="note">Dernière sauvegarde : <strong>${derniere ? dateFr(derniere.valeur) : 'jamais'}</strong></p>
      <div class="actions colonne">
        ${peutPartager ? '<button class="btn primaire" id="btn-partager">Sauvegarder vers Drive (partager)</button>' : ''}
        <button class="btn ${peutPartager ? '' : 'primaire'}" id="btn-sauver">Télécharger le fichier de sauvegarde</button>
        <label class="btn">Restaurer une sauvegarde<input type="file" id="in-restaurer" accept="application/json,.json" hidden></label>
        <button class="btn" id="btn-csv">Exporter en tableau (Excel / CSV)</button>
      </div>
      <p class="note">${persistant ? 'Stockage protégé : le navigateur ne videra pas tes données de lui-même.' : 'Astuce : installe l\'app sur l\'écran d\'accueil pour mieux protéger tes données.'}</p>
    </section>

    <section class="bloc">
      <h3>À propos</h3>
      <p class="note">Ap Vino · ${vins.length} vin${vins.length > 1 ? 's' : ''} enregistré${vins.length > 1 ? 's' : ''} · version 9</p>
    </section>`;

  document.getElementById('form-gemini').onsubmit = async (e) => {
    e.preventDefault();
    const etat = document.getElementById('gemini-etat');
    const cle = e.target.cle.value.trim();
    if (!cle) {
      await DB.del('reglages', 'cleGemini');
      await DB.del('reglages', 'modeleGemini');
      etat.textContent = 'Clé effacée : lecture sur le téléphone.';
      return;
    }
    await DB.put('reglages', { id: 'cleGemini', valeur: cle });
    etat.textContent = 'Test de la clé…';
    const r = await GEMINI.tester(cle);
    etat.textContent = r.ok ? `Clé fonctionnelle (modèle ${r.modele}, réponse en ${r.secondes} s).` : `Clé enregistrée, mais le test a échoué : ${r.erreur || 'pas de réponse'}`;
    etat.className = r.ok ? 'note ok' : 'note erreur';
  };

  document.getElementById('form-etagere').onsubmit = async (e) => {
    e.preventDefault();
    const nom = e.target.nom.value.trim();
    if (!nom) return;
    await DB.put('etageres', { id: DB.uid(), nom, ordre: etageres.length });
    router();
  };
  view.querySelectorAll('[data-ren]').forEach((b) => (b.onclick = async () => {
    const e = etageres.find((x) => x.id === b.dataset.ren);
    const nom = prompt("Nouveau nom de l'étagère", e.nom);
    if (nom && nom.trim()) { e.nom = nom.trim(); await DB.put('etageres', e); router(); }
  }));
  view.querySelectorAll('[data-sup]').forEach((b) => (b.onclick = async () => {
    const e = etageres.find((x) => x.id === b.dataset.sup);
    if (!confirm(`Supprimer l'étagère « ${e.nom} » ? Les bouteilles resteront, sans étagère.`)) return;
    for (const l of await DB.all('lots')) if (l.etagereId === e.id) { l.etagereId = ''; await DB.put('lots', l); }
    await DB.del('etageres', e.id);
    router();
  }));

  const fichierSauvegarde = async () => {
    const data = await DB.exportAll();
    const nom = `ap-vino-sauvegarde-${aujourdhui()}.json`;
    return new File([JSON.stringify(data)], nom, { type: 'application/json' });
  };
  const noterSauvegarde = () => DB.put('reglages', { id: 'derniereSauvegarde', valeur: new Date().toISOString() });

  document.getElementById('btn-sauver').onclick = async () => {
    telecharger(await fichierSauvegarde());
    await noterSauvegarde();
    toast('Sauvegarde téléchargée');
    router();
  };
  document.getElementById('btn-partager')?.addEventListener('click', async () => {
    try {
      await navigator.share({ files: [await fichierSauvegarde()], title: 'Sauvegarde Ap Vino' });
      await noterSauvegarde();
      toast('Sauvegarde partagée');
      router();
    } catch (err) { if (err.name !== 'AbortError') toast('Partage impossible : ' + err.message); }
  });
  document.getElementById('in-restaurer').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const n = (data.vins || []).length;
      if (!confirm(`Remplacer toute la cave actuelle par cette sauvegarde (${n} vins, du ${dateFr(data.date)}) ?`)) return;
      await DB.importAll(data);
      toast('Sauvegarde restaurée');
      aller('');
    } catch (err) { alert('Restauration impossible : ' + err.message); }
  };
  document.getElementById('btn-csv').onclick = async () => {
    telecharger(new File(['﻿' + await exportCsv()], `ap-vino-cave-${aujourdhui()}.csv`, { type: 'text/csv' }));
  };
}

function telecharger(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function exportCsv() {
  const { vins, etageres } = await chargerCave();
  const nomEtag = (id) => etageres.find((e) => e.id === id)?.nom || '';
  const entetes = ['Domaine', 'Cuvée', 'Millésime', 'Couleur', 'Type', 'Pays', 'Région', 'Appellation', 'Cépages', 'Degré', 'Contenance',
    'Boire à partir de', 'Apogée', 'Boire avant', 'Statut', 'Quantité', 'Étagère', 'Prix unitaire (€)', 'Coût par bouteille avec frais (€)', 'Date achat', 'Lieu achat'];
  const cell = (x) => { const s = String(x ?? ''); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const nombre = (n) => (n || n === 0 ? String(Math.round(n * 100) / 100).replace('.', ',') : '');
  const lignes = [entetes];
  for (const v of vins) {
    const d = GARDE.dates(v);
    const base = [v.domaine, v.cuvee, v.millesime, COULEURS[v.couleur], TYPES[v.type], v.pays, v.region, v.appellation, v.cepages,
      nombre(v.degre), v.contenance, d.de, d.apogee, d.avant, GARDE.statuts[v.statut].label];
    const lots = v.lots.length ? v.lots : [{}];
    for (const l of lots) lignes.push([...base, l.quantite ?? 0, nomEtag(l.etagereId), nombre(l.prixUnitaire), l.id ? nombre(coutUnitaire(l)) : '', l.dateAchat, l.lieuAchat]);
  }
  // Point-virgule : séparateur attendu par Excel en français.
  return lignes.map((r) => r.map(cell).join(';')).join('\r\n');
}

// ---------- Rappel de sauvegarde ----------
async function verifierRappelSauvegarde() {
  const banner = document.getElementById('backup-banner');
  const [vins, derniere] = await Promise.all([DB.all('vins'), DB.get('reglages', 'derniereSauvegarde')]);
  const jours = derniere ? (Date.now() - new Date(derniere.valeur)) / 86400000 : Infinity;
  const afficher = vins.length > 0 && jours > RAPPEL_SAUVEGARDE_JOURS && !location.hash.startsWith('#/reglages');
  banner.hidden = !afficher;
  if (afficher) {
    banner.innerHTML = `${derniere ? `Dernière sauvegarde il y a ${Math.floor(jours)} jours.` : 'Tu n\'as encore jamais sauvegardé ta cave.'} <a href="#/reglages">Sauvegarder</a>`;
  }
}

// ---------- Démarrage ----------
DB.persist();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
router();
