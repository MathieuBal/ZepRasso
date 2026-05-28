# ZepRasso

Application web légère pour organiser un rassemblement de véhicules GTA RP avec
vote des visiteurs. **100 % local** : elle tourne sur ton PC, les visiteurs
votent depuis leur téléphone sur le même WiFi, et les données sont enregistrées
dans un simple fichier sur le disque.

## Principe

- L'organisateur ajoute les véhicules en compétition (page Admin).
- Les visiteurs scannent le QR code, entrent leur pseudo RP, puis votent.
- Chaque visiteur note 5 critères de 0 à 10.
- L'admin consulte le classement, exporte en CSV et peut reset les votes.

## Lancer l'outil

Une seule commande, à relancer quand tu veux :

```bash
npm install   # la première fois seulement
npm start
```

`npm start` construit l'app puis démarre le serveur local. La console affiche :

```txt
  Sur ce PC    : http://localhost:4173
  Telephones   : http://192.168.x.x:4173   (memes WiFi que le PC)
  Code admin   : zepadmin
```

- **Sur ton PC** : ouvre l'adresse `localhost`.
- **Pour les téléphones** : ils doivent être sur le **même WiFi** que le PC, puis
  ouvrir l'adresse réseau `http://192.168.x.x:4173`. Le QR code généré dans
  **Admin → QR code** pointe automatiquement sur cette adresse si tu ouvres
  l'app via l'adresse réseau.

> Astuce : pare-feu. À la première ouverture, Windows/macOS peut demander
> d'autoriser Node à accéder au réseau local — accepte, sinon les téléphones
> ne pourront pas se connecter.

### Code organisateur

Par défaut : `zepadmin`. Pour le changer, crée un fichier `.env` (voir
`.env.example`) ou lance avec une variable d'environnement :

```bash
ADMIN_CODE="mon-code" npm start
# Port personnalisé :
PORT=5000 npm start
```

## Où sont les données ?

Tout est stocké sur le PC dans le dossier `data/` :

- `data/db.json` : l'événement, les véhicules et les votes.
- `data/photos/` : les photos importées des véhicules.

Ce dossier n'est pas versionné (`.gitignore`). Pour **sauvegarder** ou
**transférer** un rasso, il suffit de copier le dossier `data/`. Pour repartir
de zéro, supprime-le : il sera recréé vide au prochain lancement.

## Développement (optionnel)

Pour bosser sur le code avec rechargement à chaud, lance deux terminaux :

```bash
npm run server   # API + données sur le port 4173
npm run dev      # interface Vite (proxy /api et /photos vers le serveur)
```

## Stack

- Vite + React + TypeScript + React Router (front)
- Express + base fichier JSON (serveur local)

## Routes

- `/#/` : accueil
- `/#/login` : pseudo visiteur
- `/#/vehicles` : véhicules en compétition
- `/#/vehicles/:id` : vote véhicule
- `/#/results` : résultats
- `/#/qr` : QR code à afficher / imprimer
- `/#/admin` : administration

## Critères de vote

Esthétique générale · Cohérence du style · Originalité · Finition / détails ·
Présentation RP
