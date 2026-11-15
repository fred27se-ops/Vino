# Ap Vino

Application web installable (PWA) pour gérer ma cave à vin depuis mon téléphone Android.

- Toutes les données restent sur le téléphone (IndexedDB), aucune base externe.
- Sauvegarde / restauration par fichier, rappel mensuel, export CSV pour Excel.
- Étape 1 : inventaire manuel, étagères, prix d'achat, fenêtre de dégustation par profil de garde.

## Mise en ligne

Le site est servi tel quel par GitHub Pages (aucune compilation).
À chaque mise à jour, changer `VERSION` dans `sw.js` pour que les téléphones récupèrent la nouvelle version.
