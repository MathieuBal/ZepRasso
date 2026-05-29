# ZepRasso

Application web légère pour organiser un rassemblement de véhicules GTA RP avec
vote des visiteurs. **Locale d'abord** : elle tourne sur ton PC et les données
sont enregistrées dans un simple fichier sur le disque. Pour un event en ligne,
un tunnel donne une URL publique à partager pour que tout le monde vote à
distance, sans rien héberger.

## Principe

- L'organisateur ajoute les véhicules en compétition (page Admin).
- Les visiteurs ouvrent le lien (ou scannent le QR code), entrent leur pseudo RP, puis votent.
- Chaque visiteur note 5 critères de 0 à 10.
- L'organisateur peut renommer l'événement et **fermer les votes** pour figer le classement.
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
- **Sur le même WiFi** (téléphones d'à côté) : ouvre l'adresse réseau
  `http://192.168.x.x:4173`.

`npm start` = usage local uniquement. Pour que des gens **à distance** se
connectent (event en ligne, chacun chez soi), voir la section suivante.

## Partager l'app à distance (event en ligne)

Si les participants ne sont pas sur ton réseau, on ouvre un **tunnel** : une URL
publique `https://...` qui pointe vers ton PC. L'app et les données restent chez
toi, tu partages juste le lien (dans le Discord par exemple).

1. **Installer l'outil cloudflared, une seule fois** (gratuit, sans compte) :
   - macOS : `brew install cloudflared`
   - Windows : `winget install --id Cloudflare.cloudflared`
   - Linux / autre : voir la
     [page de téléchargement Cloudflare](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).

2. **Changer le code admin** (obligatoire dès que c'est public) puis lancer :

   ```bash
   ADMIN_CODE="ton-code-secret" npm run share
   ```

   Sur Windows (PowerShell) :

   ```powershell
   $env:ADMIN_CODE="ton-code-secret"; npm run share
   ```

3. La console affiche un **lien public** à copier dans le Discord :

   ```txt
   Lien public a partager (Discord, etc.) :
   https://xxxx-xxxx.trycloudflare.com
   ```

   Tant que la fenêtre reste ouverte, le lien marche. À la fermeture, le lien
   est coupé. L'URL **change à chaque lancement**, pense à repartager le lien.

> Note : ton PC doit rester allumé pendant tout l'event, et le trafic (photos
> comprises) passe par ta connexion.

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
- `data/backups/` : sauvegardes automatiques (voir ci-dessous).

Ce dossier n'est pas versionné (`.gitignore`). Pour **sauvegarder** ou
**transférer** un rasso complet (photos comprises), il suffit de copier le
dossier `data/`. Pour repartir de zéro, supprime-le : il sera recréé vide au
prochain lancement.

## Limiter la triche

Chaque navigateur reçoit un identifiant d'appareil anonyme (stocké en local).
Le serveur déduplique les votes **par appareil** et par véhicule : changer de
pseudo (ou se créer un nouveau nom) ne permet donc pas de voter deux fois pour
le même véhicule — le vote existant est simplement mis à jour.

La page **Admin** affiche un panneau « Anti-triche » avec :

- le nombre de votes, d'appareils distincts et d'adresses IP ;
- les IP derrière lesquelles plusieurs appareils ont voté ;
- les pseudos réutilisés sur plusieurs appareils.

Ce sont des signaux de **détection**, pas des blocages : un même foyer ou
réseau partage parfois une IP. L'organisateur reste juge et peut disqualifier
un véhicule ou réinitialiser les votes. Vider le cache du navigateur ou changer
d'appareil reste possible : sans comptes, on relève la barre sans la rendre
infranchissable.

## Sauvegardes et sécurité des données

L'écriture de `db.json` est **atomique** (écriture dans un fichier temporaire
puis remplacement), donc une coupure de courant ne corrompt pas le fichier.

En plus, des sauvegardes sont créées automatiquement dans `data/backups/` :
au démarrage, après chaque modification (regroupées toutes les ~15 s) et avant
chaque opération sensible (reset des votes, suppression, restauration). Les 40
dernières sont conservées.

Si `db.json` devient illisible, au prochain démarrage le serveur met le fichier
abîmé de côté (`db.corrupt-…json`) et **restaure automatiquement** la dernière
sauvegarde.

Depuis la page **Admin**, l'organisateur peut aussi :

- **Télécharger une sauvegarde** : récupère un fichier `.json` de l'état actuel
  (à garder au chaud avant/après l'event).
- **Restaurer une sauvegarde** : recharge un fichier `.json` (l'état courant est
  sauvegardé avant remplacement).

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
