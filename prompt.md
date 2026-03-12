Tu es un expert DevOps / backend. Crée une présentation claire et pédagogique (plan + contenu détaillé) sur un petit projet de CI/CD autour d’une API Node.js. Voici le contexte technique précis du projet, merci de t’y référer exactement :

### 1. Contexte général

- Projet : **User API** – REST API de gestion d’utilisateurs.
- Langage : **Node.js** (CommonJS).
- Framework : **Express**.
- Base de données : **SQLite** (fichier local en prod, in‑memory en test).
- Gestion des utilisateurs :
  - Routes REST `GET /api/users`, `GET /api/users/:id`, `POST /api/users`, `PUT /api/users/:id`, `DELETE /api/users/:id`.
  - Validation basique des champs (`name`, `email`), gestion des erreurs 400/404, gestion des contraintes d’unicité email.

### 2. Qualité et tests

- Linting :
  - ESLint **v10** avec configuration flat (`eslint.config.cjs`).
  - Script : `npm run lint` (`eslint --config eslint.config.cjs "src/**/*.js"`).
- Tests :
  - Framework : **Jest** + **Supertest**.
  - Script : `npm test` (avec `--coverage`).
  - Tests d’intégration HTTP sur :
    - Création d’utilisateur, listing, GET par id.
    - Erreurs 400 (champs manquants, email vide, id invalide, email dupliqué).
    - Erreurs 404 (utilisateur inexistant, route inconnue).
    - PUT (mise à jour partielle, erreurs, 404).
    - DELETE (suppression + 404 derrière).
- Couverture :
  - Configuration Jest dans `package.json` avec `coverageThreshold` global fixé à **70%** (branches, functions, lines, statements).
  - Si la couverture globale < 70 %, `npm test` **échoue** (CI rouge).

### 3. Structure Node/API

- `src/app.js` :
  - Crée et configure l’application Express.
  - Monte le router `users` sur `/api/users`.
  - Middleware 404 générique.
  - Middleware d’erreurs globales (retourne 500).
  - Exporte `app` (pas de `listen` ici pour faciliter les tests).
- `src/server.js` :
  - Importe `app`.
  - Lance le serveur sur le port 3000 (`node src/server.js`).
- `src/db.js` :
  - Initialise la base SQLite avec `sqlite3`.
  - En prod : fichier `data/users.db`.
  - En test (`NODE_ENV === "test"`): base **in‑memory** (`:memory:`).
  - Crée la table `users` avec contraintes (`email` UNIQUE).
- `src/routes/users.js` :
  - Implémente toutes les routes CRUD avec requêtes SQL (`db.get`, `db.all`, `db.run`).
  - Gère explicitement les cas d’erreur SQL (`SQLITE_CONSTRAINT`) et les statuts HTTP (400, 404, 500 via `next(err)`).

### 4. CI/CD GitHub Actions

- Fichier de workflow : `.github/workflows/ci.yml`.
- Nom du workflow : `CI - Lint, Test, Build, Deploy`.
- Déclencheurs :
  - `push` sur `main` et `master`.
  - `pull_request` vers `main` et `master`.
- Jobs :
  1. **lint**
     - `npm ci`
     - `npm run lint`
     - Si ESLint trouve des erreurs → job rouge → pipeline bloqué.
  2. **test** (dépend de `lint`)
     - `npm ci`
     - `npm test` avec couverture.
     - Si couverture globale < 70 % → Jest échoue → job rouge → pipeline bloqué.
  3. **build** (dépend de `test`)
     - `npm ci`
     - Step “Build step (placeholder)” (rien à compiler pour l’instant, mais prépare un futur vrai build).
  4. **deploy** (dépend de `build`)
     - Ne s’exécute que pour un `push` sur `main`/`master`.
     - Utilise `appleboy/ssh-action` pour déployer en **staging sur une instance AWS EC2** :
       - Connexion SSH via secrets GitHub (`AWS_EC2_STAGING_HOST`, `AWS_EC2_STAGING_USER`, `AWS_EC2_STAGING_SSH_KEY`, `AWS_EC2_STAGING_SSH_PORT`, `AWS_EC2_STAGING_APP_DIR`).
       - `cd` dans le dossier du projet sur l’EC2.
       - `git fetch` + `git checkout main` + `git pull origin main`.
       - `npm ci --omit=dev` (deps prod).
       - Redémarrage via PM2 : `pm2 reload user-api || pm2 start src/server.js --name user-api`.

- Règle clé : **le déploiement n’a lieu que si lint ET tests sont “verts”** (y compris couverture ≥ 70 %).

### 5. Règles de branches et qualité (GitHub)

- Branche principale : `main`.
- Règles (expliquées dans le projet) :
  - **Aucun push direct** sur `main` (branch protection + workflow Git documenté).
  - Le flux est : `feature/*` → PR vers `main` → CI → merge.
  - Protection de branche `main` configurée avec :
    - `Require a pull request before merging`.
    - `Require status checks to pass before merging`.
    - Checks requis : les jobs de la CI (`lint`, `test`, `build`).
  - Conséquence :
    - Si `npm run lint` échoue → PR non mergeable.
    - Si la couverture de tests globale est < 70 % → `npm test` échoue → PR non mergeable.
    - Donc **aucune branche ne peut être mergée sur `main` si lint n’est pas OK ou si la couverture < 70 %**.
- Badge de statut CI ajouté dans le `README` (à partir du workflow `ci.yml`).

### 6. Déploiement staging sur AWS EC2 (détail)

- Instance EC2 :
  - Ubuntu LTS, type `t3.micro` ou plus.
  - Security Group :
    - Inbound : SSH (22), port de l’API (`3000`) ou HTTP/HTTPS (80/443) si Nginx.
    - Outbound : all traffic pour `apt`, `git`, `npm`.
  - Durcissement SSH (`PasswordAuthentication no`, `PermitRootLogin prohibit-password`), pare‑feu UFW, ports ouverts minimaux.
- Application :
  - Dossier `/var/www/user-api`.
  - Repo cloné depuis GitHub.
  - Node 20 + npm + PM2 installés.
  - Process PM2 `user-api` pour exécuter `src/server.js`, avec `pm2 save` pour persistance.
- Documentation complète dans `DEPLOY.md` :
  - Détails réseaux et sécurité EC2.
  - Étapes de préparation de la machine.
  - Configuration des secrets GitHub.
  - Explication de chaque étape du job `deploy`.
  - Schéma du flux complet (dev → PR → CI → déploiement automatique sur EC2).

---

À partir de ces éléments, crée une **présentation structurée** (plan + contenu) qui :

1. Explique rapidement le but fonctionnel de l’API.
2. Met en avant la qualité du code (lint, tests, couverture, règles de merge).
3. Détaille le pipeline CI/CD (lint → test → build → deploy) et les dépendances entre jobs.
4. Montre comment la branche `main` est protégée (pas de push direct, pas de merge si qualité insuffisante).
5. Explique le déploiement staging sur AWS EC2 (sécurité réseau, secrets, PM2, job GitHub Actions).
6. Se termine par un résumé des bénéfices : fiabilité, automatisation, sécurité des déploiements.

