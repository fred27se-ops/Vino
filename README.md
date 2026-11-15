# Ap Vino

Application web installable (PWA) pour gérer ma cave à vin depuis mon téléphone Android.

- Toutes les données restent sur le téléphone (IndexedDB), aucune base externe.
- Sauvegarde / restauration par fichier, rappel mensuel, export CSV pour Excel.
- Étape 1 : inventaire manuel, étagères, prix d'achat, fenêtre de dégustation par profil de garde.

## Mise en ligne

Le site est servi tel quel par GitHub Pages (aucune compilation).
À chaque mise à jour, changer `VERSION` dans `sw.js` pour que les téléphones récupèrent la nouvelle version.

## Étape 2 : scan d'étiquette (gratuit, sur le téléphone)

- Le texte de la photo est lu par Tesseract.js (dossier `vendor/tesseract`, installé avec l'app, aucune photo n'est envoyée sur internet).
- `scan.js` en tire la fiche (domaine, millésime, appellation, degré, contenance, profil de garde) ; `appellations.js` contient la liste des appellations connues.
- Les champs devinés sont marqués en orange dans le formulaire.
