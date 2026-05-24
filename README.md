# ZepRasso

Application web légère pour organiser un rassemblement de véhicules GTA RP avec vote visiteurs.

## Objectif

- L'organisateur ajoute les véhicules en compétition.
- Les visiteurs entrent leur pseudo RP.
- Chaque visiteur vote sur 5 critères de 0 à 10.
- La liste indique les véhicules déjà votés et ceux restant à noter.
- L'admin consulte le classement, exporte les résultats et peut reset les votes après l'event.

## Stack

- Vite
- React
- TypeScript
- React Router
- Supabase JS
- GitHub Pages

## Lancer en local

```bash
npm install
npm run dev
```

Par défaut, l'app fonctionne en mode démo local avec `localStorage`.

Code admin par défaut :

```txt
zepadmin
```

## Brancher Supabase

1. Créer un projet Supabase.
2. Ouvrir le SQL Editor.
3. Exécuter le fichier `supabase/schema.sql` (crée les tables, les policies, et le bucket Storage `vehicle-photos`).
4. Copier `.env.example` vers `.env.local`.
5. Remplir les variables :

```env
VITE_SUPABASE_URL="https://ton-projet.supabase.co"
VITE_SUPABASE_ANON_KEY="ta-cle-anon-publique"
VITE_ADMIN_CODE="change-moi"
VITE_EVENT_ID="00000000-0000-0000-0000-000000000001"
```

Important : ne jamais mettre de clé `service_role` dans une app front.

Une fois Supabase configuré, les votes sont partagés entre tous les
appareils et les photos importées dans l'admin sont uploadées dans
Supabase Storage (visibles par tous les visiteurs).

### Déployer avec Supabase sur GitHub Pages

Les variables `VITE_*` sont lues au moment du build. Pour le site
déployé, ajoute-les comme secrets de dépôt :

1. `Settings` > `Secrets and variables` > `Actions` > `New repository secret`.
2. Créer : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ADMIN_CODE`,
   `VITE_EVENT_ID`.
3. Relancer le workflow `Deploy GitHub Pages` (onglet `Actions`).

Sans ces secrets, le site déployé reste en mode démo `localStorage`
(données isolées par appareil).

## Déployer sur GitHub Pages

Le repo contient déjà un workflow GitHub Actions :

```txt
.github/workflows/deploy.yml
```

Dans GitHub :

1. Aller dans `Settings` > `Pages`.
2. Choisir `GitHub Actions` comme source.
3. Pousser sur `main`.
4. Le site sera généré depuis `dist`.

L'app est configurée avec :

```ts
base: '/ZepRasso/'
```

## Routes

- `/` : accueil
- `/#/login` : pseudo visiteur
- `/#/vehicles` : véhicules en compétition
- `/#/vehicles/:id` : vote véhicule
- `/#/results` : résultats
- `/#/admin` : administration

## Critères de vote

- Esthétique générale
- Cohérence du style
- Originalité
- Finition / détails
- Présentation RP

## Limites de la V1

Cette V1 est volontairement simple :

- admin protégé par code côté front, pas une sécurité forte ;
- votes liés au pseudo, pas encore au compte Discord ;
- politiques Supabase et Storage permissives pour faciliter le MVP.

## Roadmap possible

- Auth Discord.
- Upload photo via Supabase Storage.
- Webhook Discord pour publier les résultats.
- QR code par véhicule.
- Notes jury / score final pondéré.
- Multi-events.
