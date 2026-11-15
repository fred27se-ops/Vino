// Principales appellations françaises : nom, région, couleur la plus courante, type.
// Sert à reconnaître l'appellation sur une étiquette et à en déduire région, couleur et type.
const APPELLATIONS = (() => {
  const liste = `
Bordeaux|Bordeaux|rouge
Bordeaux Supérieur|Bordeaux|rouge
Médoc|Bordeaux|rouge
Haut-Médoc|Bordeaux|rouge
Saint-Estèphe|Bordeaux|rouge
Pauillac|Bordeaux|rouge
Saint-Julien|Bordeaux|rouge
Margaux|Bordeaux|rouge
Listrac-Médoc|Bordeaux|rouge
Moulis-en-Médoc|Bordeaux|rouge
Pessac-Léognan|Bordeaux|rouge
Graves|Bordeaux|rouge
Saint-Émilion|Bordeaux|rouge
Saint-Émilion Grand Cru|Bordeaux|rouge
Montagne-Saint-Émilion|Bordeaux|rouge
Lussac-Saint-Émilion|Bordeaux|rouge
Puisseguin-Saint-Émilion|Bordeaux|rouge
Saint-Georges-Saint-Émilion|Bordeaux|rouge
Pomerol|Bordeaux|rouge
Lalande-de-Pomerol|Bordeaux|rouge
Fronsac|Bordeaux|rouge
Canon-Fronsac|Bordeaux|rouge
Côtes de Bourg|Bordeaux|rouge
Blaye|Bordeaux|rouge
Côtes de Bordeaux|Bordeaux|rouge
Castillon Côtes de Bordeaux|Bordeaux|rouge
Entre-Deux-Mers|Bordeaux|blanc
Sauternes|Bordeaux|blanc|liquoreux
Barsac|Bordeaux|blanc|liquoreux
Loupiac|Bordeaux|blanc|liquoreux
Cadillac|Bordeaux|blanc|liquoreux
Sainte-Croix-du-Mont|Bordeaux|blanc|liquoreux
Crémant de Bordeaux|Bordeaux|blanc|effervescent
Bergerac|Sud-Ouest|rouge
Pécharmant|Sud-Ouest|rouge
Monbazillac|Sud-Ouest|blanc|liquoreux
Cahors|Sud-Ouest|rouge
Madiran|Sud-Ouest|rouge
Pacherenc du Vic-Bilh|Sud-Ouest|blanc
Jurançon|Sud-Ouest|blanc
Irouléguy|Sud-Ouest|rouge
Gaillac|Sud-Ouest|rouge
Fronton|Sud-Ouest|rouge
Marcillac|Sud-Ouest|rouge
Buzet|Sud-Ouest|rouge
Côtes de Gascogne|Sud-Ouest|blanc
Saint-Mont|Sud-Ouest|rouge
Chablis|Bourgogne|blanc
Chablis Premier Cru|Bourgogne|blanc
Chablis Grand Cru|Bourgogne|blanc
Petit Chablis|Bourgogne|blanc
Irancy|Bourgogne|rouge
Bourgogne|Bourgogne|rouge
Bourgogne Aligoté|Bourgogne|blanc
Bourgogne Hautes-Côtes de Nuits|Bourgogne|rouge
Bourgogne Hautes-Côtes de Beaune|Bourgogne|rouge
Coteaux Bourguignons|Bourgogne|rouge
Marsannay|Bourgogne|rouge
Fixin|Bourgogne|rouge
Gevrey-Chambertin|Bourgogne|rouge
Chambertin|Bourgogne|rouge
Morey-Saint-Denis|Bourgogne|rouge
Clos de la Roche|Bourgogne|rouge
Clos de Tart|Bourgogne|rouge
Chambolle-Musigny|Bourgogne|rouge
Musigny|Bourgogne|rouge
Bonnes-Mares|Bourgogne|rouge
Vougeot|Bourgogne|rouge
Clos de Vougeot|Bourgogne|rouge
Vosne-Romanée|Bourgogne|rouge
Échezeaux|Bourgogne|rouge
Richebourg|Bourgogne|rouge
Romanée-Saint-Vivant|Bourgogne|rouge
La Tâche|Bourgogne|rouge
Nuits-Saint-Georges|Bourgogne|rouge
Côte de Nuits-Villages|Bourgogne|rouge
Ladoix|Bourgogne|rouge
Aloxe-Corton|Bourgogne|rouge
Corton|Bourgogne|rouge
Corton-Charlemagne|Bourgogne|blanc
Pernand-Vergelesses|Bourgogne|rouge
Savigny-lès-Beaune|Bourgogne|rouge
Chorey-lès-Beaune|Bourgogne|rouge
Beaune|Bourgogne|rouge
Côte de Beaune-Villages|Bourgogne|rouge
Pommard|Bourgogne|rouge
Volnay|Bourgogne|rouge
Monthélie|Bourgogne|rouge
Auxey-Duresses|Bourgogne|rouge
Saint-Romain|Bourgogne|blanc
Meursault|Bourgogne|blanc
Puligny-Montrachet|Bourgogne|blanc
Chassagne-Montrachet|Bourgogne|blanc
Montrachet|Bourgogne|blanc
Bâtard-Montrachet|Bourgogne|blanc
Saint-Aubin|Bourgogne|blanc
Santenay|Bourgogne|rouge
Maranges|Bourgogne|rouge
Rully|Bourgogne|blanc
Mercurey|Bourgogne|rouge
Givry|Bourgogne|rouge
Montagny|Bourgogne|blanc
Bouzeron|Bourgogne|blanc
Mâcon|Bourgogne|blanc
Mâcon-Villages|Bourgogne|blanc
Viré-Clessé|Bourgogne|blanc
Saint-Véran|Bourgogne|blanc
Pouilly-Fuissé|Bourgogne|blanc
Pouilly-Loché|Bourgogne|blanc
Pouilly-Vinzelles|Bourgogne|blanc
Crémant de Bourgogne|Bourgogne|blanc|effervescent
Beaujolais|Beaujolais|rouge
Beaujolais-Villages|Beaujolais|rouge
Beaujolais Nouveau|Beaujolais|rouge
Brouilly|Beaujolais|rouge
Côte de Brouilly|Beaujolais|rouge
Chénas|Beaujolais|rouge
Chiroubles|Beaujolais|rouge
Fleurie|Beaujolais|rouge
Juliénas|Beaujolais|rouge
Morgon|Beaujolais|rouge
Moulin-à-Vent|Beaujolais|rouge
Régnié|Beaujolais|rouge
Saint-Amour|Beaujolais|rouge
Champagne|Champagne|blanc|effervescent
Coteaux Champenois|Champagne|rouge
Rosé des Riceys|Champagne|rose
Alsace|Alsace|blanc
Alsace Grand Cru|Alsace|blanc
Crémant d'Alsace|Alsace|blanc|effervescent
Riesling|Alsace|blanc
Gewurztraminer|Alsace|blanc
Pinot Gris|Alsace|blanc
Sylvaner|Alsace|blanc
Muscat d'Alsace|Alsace|blanc
Sancerre|Loire|blanc
Pouilly-Fumé|Loire|blanc
Menetou-Salon|Loire|blanc
Quincy|Loire|blanc
Reuilly|Loire|blanc
Vouvray|Loire|blanc
Montlouis-sur-Loire|Loire|blanc
Chinon|Loire|rouge
Bourgueil|Loire|rouge
Saint-Nicolas-de-Bourgueil|Loire|rouge
Saumur|Loire|rouge
Saumur-Champigny|Loire|rouge
Anjou|Loire|rouge
Rosé d'Anjou|Loire|rose
Cabernet d'Anjou|Loire|rose
Savennières|Loire|blanc
Coteaux du Layon|Loire|blanc|liquoreux
Bonnezeaux|Loire|blanc|liquoreux
Quarts de Chaume|Loire|blanc|liquoreux
Muscadet|Loire|blanc
Muscadet Sèvre et Maine|Loire|blanc
Touraine|Loire|rouge
Cheverny|Loire|blanc
Crémant de Loire|Loire|blanc|effervescent
Côtes du Rhône|Rhône|rouge
Côtes du Rhône Villages|Rhône|rouge
Côte-Rôtie|Rhône|rouge
Condrieu|Rhône|blanc
Château-Grillet|Rhône|blanc
Saint-Joseph|Rhône|rouge
Crozes-Hermitage|Rhône|rouge
Hermitage|Rhône|rouge
Cornas|Rhône|rouge
Saint-Péray|Rhône|blanc
Châteauneuf-du-Pape|Rhône|rouge
Gigondas|Rhône|rouge
Vacqueyras|Rhône|rouge
Rasteau|Rhône|rouge
Cairanne|Rhône|rouge
Vinsobres|Rhône|rouge
Lirac|Rhône|rouge
Tavel|Rhône|rose
Beaumes-de-Venise|Rhône|rouge
Muscat de Beaumes-de-Venise|Rhône|blanc|mute
Ventoux|Rhône|rouge
Luberon|Rhône|rouge
Costières de Nîmes|Rhône|rouge
Clairette de Die|Rhône|blanc|effervescent
Côtes de Provence|Provence|rose
Coteaux d'Aix-en-Provence|Provence|rose
Coteaux Varois en Provence|Provence|rose
Bandol|Provence|rouge
Cassis|Provence|blanc
Bellet|Provence|rouge
Palette|Provence|rouge
Les Baux-de-Provence|Provence|rouge
Patrimonio|Corse|rouge
Ajaccio|Corse|rouge
Corse|Corse|rouge
Languedoc|Languedoc-Roussillon|rouge
Pic Saint-Loup|Languedoc-Roussillon|rouge
Terrasses du Larzac|Languedoc-Roussillon|rouge
Faugères|Languedoc-Roussillon|rouge
Saint-Chinian|Languedoc-Roussillon|rouge
Minervois|Languedoc-Roussillon|rouge
Corbières|Languedoc-Roussillon|rouge
Fitou|Languedoc-Roussillon|rouge
La Clape|Languedoc-Roussillon|rouge
Picpoul de Pinet|Languedoc-Roussillon|blanc
Limoux|Languedoc-Roussillon|blanc
Blanquette de Limoux|Languedoc-Roussillon|blanc|effervescent
Crémant de Limoux|Languedoc-Roussillon|blanc|effervescent
Côtes du Roussillon|Languedoc-Roussillon|rouge
Côtes du Roussillon Villages|Languedoc-Roussillon|rouge
Collioure|Languedoc-Roussillon|rouge
Banyuls|Languedoc-Roussillon|rouge|mute
Maury|Languedoc-Roussillon|rouge|mute
Rivesaltes|Languedoc-Roussillon|blanc|mute
Muscat de Rivesaltes|Languedoc-Roussillon|blanc|mute
Muscat de Frontignan|Languedoc-Roussillon|blanc|mute
Pays d'Oc|Languedoc-Roussillon|rouge
Côtes de Thau|Languedoc-Roussillon|blanc
Arbois|Jura|blanc
Côtes du Jura|Jura|blanc
Château-Chalon|Jura|blanc
L'Étoile|Jura|blanc
Crémant du Jura|Jura|blanc|effervescent
Vin de Savoie|Savoie|blanc
Roussette de Savoie|Savoie|blanc
Chignin-Bergeron|Savoie|blanc
Apremont|Savoie|blanc
Seyssel|Savoie|blanc
Porto|Portugal|rouge|mute
Rioja|Espagne|rouge
Ribera del Duero|Espagne|rouge
Priorat|Espagne|rouge
Cava|Espagne|blanc|effervescent
Chianti|Italie|rouge
Chianti Classico|Italie|rouge
Brunello di Montalcino|Italie|rouge
Barolo|Italie|rouge
Barbaresco|Italie|rouge
Valpolicella|Italie|rouge
Amarone della Valpolicella|Italie|rouge
Prosecco|Italie|blanc|effervescent
`;
  const PAYS_HORS_FRANCE = { Portugal: 1, Espagne: 1, Italie: 1 };
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return liste.trim().split('\n').map((l) => {
    const [nom, region, couleur, type] = l.split('|');
    return {
      nom,
      region: PAYS_HORS_FRANCE[region] ? '' : region,
      pays: PAYS_HORS_FRANCE[region] ? region : 'France',
      couleur,
      type: type || 'tranquille',
      cle: norm(nom),
    };
  })
  // Les noms les plus longs d'abord : « Saint-Émilion Grand Cru » avant « Saint-Émilion ».
    .sort((a, b) => b.cle.length - a.cle.length);
})();
