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

## Brancher Supabase (méthode simple, sans secrets ni redéploiement)

1. Créer un projet Supabase.
2. Ouvrir le SQL Editor et exécuter `supabase/schema.sql` (tables, policies, bucket Storage `vehicle-photos`).
3. Dans `Project Settings` > `API`, copier la **Project URL** et la clé **anon public**.
4. Sur le site, aller dans **Admin** > **Connexion Supabase**, coller l'URL et la clé,
   garder l'Event ID par défaut, puis **Tester la connexion** et **Enregistrer**.

C'est tout : la connexion est mémorisée sur l'appareil de l'organisateur.
Les votes sont alors partagés entre tous les appareils et les photos
importées sont uploadées dans Supabase Storage (visibles par tous).

Important : ne jamais utiliser la clé `service_role` dans une app front.
La clé `anon` est publique par conception ; la sécurité repose sur les
policies (RLS), pas sur le secret de la clé.

### Connexion organisateur (gestion des véhicules protégée)

Les visiteurs votent librement, mais ajouter / supprimer / disqualifier un
véhicule et supprimer des votes sont réservés à l'orga **authentifié**.
Dans le dashboard Supabase, une seule fois :

1. `Authentication` > `Providers` > `Email` : activé (par défaut).
2. Désactiver l'inscription publique (`Allow new users to sign up`), pour
   que seuls les comptes créés à la main aient les droits de gestion.
3. `Authentication` > `Users` > `Add user` : ajouter l'e-mail de l'orga.
4. `Authentication` > `Emails` > `Magic Link` : insérer `{{ .Token }}` dans
   le template pour recevoir un **code à 6 chiffres** par e-mail.

Ensuite, dans la page **Admin**, l'orga saisit son e-mail, reçoit un code et
se connecte. En mode démo local (sans Supabase), l'accès reste protégé par
le simple code `zepadmin`.

### Option avancée : configurer via le build

À la place du panneau Admin, on peut fournir les variables au build
(`.env.local` en local, ou secrets de dépôt `Settings` > `Secrets and
variables` > `Actions` pour GitHub Pages) :

```env
VITE_SUPABASE_URL="https://ton-projet.supabase.co"
VITE_SUPABASE_ANON_KEY="ta-cle-anon-publique"
VITE_ADMIN_CODE="change-moi"
VITE_EVENT_ID="00000000-0000-0000-0000-000000000001"
```

La config saisie dans l'Admin a priorité sur celle du build.

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

- en mode démo local, admin protégé par un simple code côté front ;
- avec Supabase, gestion des véhicules réservée à l'orga authentifié (e-mail) ;
- votes liés au pseudo (un visiteur peut changer de pseudo), pas encore au compte Discord.

## Roadmap possible

- Auth Discord.
- Upload photo via Supabase Storage.
- Webhook Discord pour publier les résultats.
- QR code par véhicule.
- Notes jury / score final pondéré.
- Multi-events.
