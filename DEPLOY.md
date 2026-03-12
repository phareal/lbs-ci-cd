## Déploiement staging sur AWS EC2 via GitHub Actions

Ce document décrit toutes les étapes pour que le job `deploy` de la CI déploie l’API en staging sur une instance AWS EC2.

---

## 1. Pré-requis côté AWS EC2

- **Instance EC2** (Ubuntu ou équivalent) accessible en SSH.
- **Security Group** :
  - Port `22` ouvert depuis l’IP de GitHub Actions ou, plus simplement, depuis Internet (à ajuster selon tes règles de sécu).
  - Port applicatif (par ex. `3000` ou celui exposé par ton reverse proxy) ouvert depuis Internet ou ton réseau.
- **Paquets système** (sur la machine EC2) :

```bash
sudo apt update
sudo apt install -y git curl
```

- **Node.js et npm** (par exemple via NodeSource ou nvm) :

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

- **PM2** pour lancer l’API en service (option recommandé par le workflow) :

```bash
sudo npm install -g pm2
```

### Détails réseaux et sécurité EC2

#### Security Group (pare-feu AWS)

- **Règles entrantes (Inbound)** :
  - SSH (`22/tcp`) :
    - Type : `SSH`
    - Port : `22`
    - Source recommandée :
      - Idéal : ton IP fixe uniquement (`X.X.X.X/32`) pour l’admin manuelle.
      - Si tu veux aussi autoriser GitHub Actions via clé SSH : tu peux laisser `0.0.0.0/0`, mais uniquement si ta clé privée est **strictement** protégée.
  - Accès HTTP/HTTPS ou direct à l’API :
    - API directe sur `3000` :
      - Type : `Custom TCP`
      - Port : `3000`
      - Source : `0.0.0.0/0` (ou ton VPN / réseau interne pour un staging privé).
    - Via reverse proxy (Nginx) :
      - Type : `HTTP` (80) et `HTTPS` (443)
      - Source : `0.0.0.0/0` ou restreinte selon ton besoin.
- **Règles sortantes (Outbound)** :
  - Laisse la règle par défaut “All traffic” vers `0.0.0.0/0` pour que l’instance puisse :
    - faire des `apt update/apt install`,
    - faire des `git pull` depuis GitHub,
    - installer des dépendances npm.

#### Clé SSH et durcissement de l’accès

- Utilise une **Key Pair** EC2 (fichier `.pem`) pour te connecter.
- Ne la versionne jamais dans Git, ne la partage pas.
- Sur l’instance, renforce la config SSH dans `/etc/ssh/sshd_config` :

```bash
sudo nano /etc/ssh/sshd_config
```

Paramètres recommandés :

- `PasswordAuthentication no`
- `PermitRootLogin prohibit-password` (ou `no`)

Puis redémarre SSH :

```bash
sudo systemctl restart ssh
```

#### Pare-feu système (UFW) – en plus du Security Group

Tu peux ajouter un pare-feu au niveau de l’OS :

```bash
sudo apt update
sudo apt install -y ufw

sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp        # SSH
sudo ufw allow 3000/tcp      # API directe (ou 80/443 pour un reverse proxy)

sudo ufw enable
sudo ufw status
```

Adapte les ports en fonction de ta configuration (3000 vs 80/443).


---

## 2. Préparation du code sur l’EC2

Connecte-toi à ton EC2 avec la même combinaison `user` + `clé` que tu utiliseras dans GitHub Actions :

```bash
ssh -i /chemin/vers/ta-cle.pem ubuntu@MON_HOST_EC2
```

Dans la session SSH, prépare l’arborescence de ton application :

```bash
# Choisis un répertoire pour l’app
mkdir -p /var/www/user-api
cd /var/www/user-api

# Clone le repo GitHub (remplace OWNER/REPO par les tiens)
git clone https://github.com/OWNER/REPO.git .

# Install des dépendances (une première fois à la main)
npm install
```

Explication :

- Le dossier `/var/www/user-api` devient **le répertoire racine** de ton application sur le serveur.
- Le `git clone` permet d’avoir le même code que sur GitHub.
- Le premier `npm install` à la main vérifie que tout fonctionne correctement sur cette machine (droits, version de Node, etc.).
- Le chemin d’installation (par ex. `/var/www/user-api`) sera utilisé comme valeur du secret **`AWS_EC2_STAGING_APP_DIR`** dans GitHub, pour que le script de déploiement sache où aller.

---

## 3. Configuration des secrets GitHub (Actions)

Dans ton dépôt GitHub :

1. Va dans **Settings** → **Security** → **Secrets and variables** → **Actions**.
2. Ajoute les secrets suivants :

- `AWS_EC2_STAGING_HOST`  
  - Valeur : l’IP publique ou le DNS de ton EC2 (ex. `54.xx.xx.xx` ou `ec2-54-...compute.amazonaws.com`).
  - Utilité : permet à GitHub Actions de savoir à quelle machine se connecter en SSH.

- `AWS_EC2_STAGING_USER`  
  - Valeur : l’utilisateur SSH (souvent `ubuntu`, `ec2-user` ou celui que tu utilises).
  - Utilité : doit correspondre à l’utilisateur qui possède les fichiers de l’app (`/var/www/user-api`) et qui peut exécuter `git`, `npm`, `pm2`.

- `AWS_EC2_STAGING_SSH_KEY`  
  - Valeur : contenu de ta clé privée SSH **au format PEM** (celle qui te permet de te connecter à l’EC2).  
  - Colle le contenu complet (y compris les lignes `-----BEGIN OPENSSH PRIVATE KEY-----` / `-----END ...-----`).
  - Utilité : sert d’**identité** à GitHub Actions pour se connecter en SSH à l’instance EC2, sans mot de passe.

- `AWS_EC2_STAGING_SSH_PORT` (optionnel)  
  - Valeur : le port SSH (par défaut `22`).  
  - Si tu ne définis pas cette variable, la valeur par défaut 22 sera utilisée.

- `AWS_EC2_STAGING_APP_DIR`  
  - Valeur : répertoire de l’app sur EC2, par ex. `/var/www/user-api`.
  - Utilité : indique au script de déploiement où se trouve ton projet pour y exécuter `git pull`, `npm ci` et PM2.

---

## 4. Workflow GitHub Actions (rappel)

Le fichier `.github/workflows/ci.yml` contient déjà un job `deploy` configuré pour le staging :

```yaml
deploy:
  # Déploiement staging sur AWS EC2, seulement sur push sur la branche par défaut
  if: github.event_name == 'push' && (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master')
  runs-on: ubuntu-latest
  needs: build
  steps:
    - name: Checkout repository
      uses: actions/checkout@v4
    - name: Deploy to AWS EC2 (staging)
      uses: appleboy/ssh-action@v1.2.0
      with:
        host: ${{ secrets.AWS_EC2_STAGING_HOST }}
        username: ${{ secrets.AWS_EC2_STAGING_USER }}
        key: ${{ secrets.AWS_EC2_STAGING_SSH_KEY }}
        port: ${{ secrets.AWS_EC2_STAGING_SSH_PORT || 22 }}
        script: |
          set -e
          cd ${{ secrets.AWS_EC2_STAGING_APP_DIR }}
          git fetch origin
          git checkout main
          git pull origin main
          npm ci --omit=dev
          # Redémarrage de l'app via PM2 (ou création si non existante)
          if command -v pm2 >/dev/null 2>&1; then
            pm2 reload user-api || pm2 start src/server.js --name user-api
          else
            echo "PM2 n'est pas installé sur le serveur. Merci de configurer le démarrage du service (systemd, docker, etc.)."
          fi
```

Ce workflow est organisé en **plusieurs jobs dépendants** :

- `lint` : vérifie la qualité du code (ESLint). Si cette étape échoue, rien d’autre ne tourne.
- `test` : lance Jest avec la couverture. Grâce au `coverageThreshold` dans `package.json`, les tests échouent si la couverture globale est < 70 %, ce qui bloque la suite.
- `build` : étape “technique” qui s’exécute seulement si `lint` et `test` sont passés. Elle représente la phase de build/packaging (même si ici l’API Node n’a pas de compilation spécifique).
- `deploy` : ne s’exécute que si toutes les étapes précédentes sont **OK** et si le push cible `main/master`. C’est cette étape qui envoie réellement la nouvelle version sur l’EC2.

### 4.1. Règle de merge côté GitHub (protection de branche)

Objectif : **aucune branche ne peut être mergée** sur `main` si :

- les tests n’atteignent pas **au moins 70 %** de couverture globale,
- ou si `npm run lint` remonte des erreurs (la CI devient rouge).

Pour obtenir ce comportement, configure une règle de protection de branche :

1. Va dans ton dépôt GitHub → **Settings** → **Branches**.
2. Dans **Branch protection rules**, clique sur **Add branch protection rule**.
3. Renseigne :
   - **Branch name pattern** : `main`
4. Coche au minimum :
   - **Require a pull request before merging** (obliger le passage par PR).
   - **Require status checks to pass before merging**.
5. Dans la liste des checks, sélectionne le ou les jobs GitHub Actions de ta CI (par ex. `CI - Lint, Test, Build, Deploy / lint`, `... / test`, `... / build`).
   - Si `npm run lint` échoue → job `lint` rouge → la PR ne peut pas être mergée.
   - Si Jest détecte une couverture globale < 70 % → job `test` rouge → la PR ne peut pas être mergée.
6. Sauvegarde la règle.

Ainsi :

- Pas de merge direct sur `main`.
- Pas de merge via PR tant que la CI n’est pas verte.
- Donc, **aucune branche ne peut être mergée sur `main` tant que le lint ou les tests échouent, y compris si la couverture globale < 70 %**.

### Important

- Ce job **ne s’exécute que** sur les `push` vers `main`/`master`, et seulement si :
  - le lint (`npm run lint`) **réussit**,
  - les tests (`npm test`) **réussissent** avec couverture globale ≥ 70 %,
  - le job `build` a fini avec succès.

---

## 5. Démarrage manuel initial avec PM2 (optionnel)

Sur l’EC2, tu peux vérifier l’appli à la main avant de laisser la CI déployer :

```bash
cd /var/www/user-api
npm install
pm2 start src/server.js --name user-api
pm2 save
```

Tu peux ensuite accéder à l’API via `http://<IP_EC2>:3000` ou via ton reverse proxy si tu en configures un (Nginx, etc.).

Pourquoi cette étape est importante :

- Elle confirme que le serveur est correctement configuré (Node, ports ouverts, droits fichiers).
- Elle crée un process PM2 nommé `user-api`, que le job `deploy` pourra ensuite **recharger** (`pm2 reload user-api`) sans recréer toute la config.
- Elle permet de diagnostiquer plus facilement un problème (logs PM2, connectivité réseau) avant d’automatiser le déploiement.

---

## 6. Flux complet de déploiement

1. Tu pushes sur une branche feature → ouverture de PR vers `main`.
2. La CI tourne (lint + tests + couverture).
3. Une fois la PR mergée sur `main` :
   - GitHub Actions relance `lint`, `test`, `build`.
   - Si tout est **OK** et la couverture ≥ 70 %, le job `deploy` se connecte en SSH à EC2.
   - L’EC2 récupère la dernière version du code depuis GitHub, installe les deps prod, et redémarre le process `user-api` via PM2.

Vue d’ensemble sous forme de schéma :

```text
Dev local  -->  Push branche feature  -->  Pull Request vers main
                            |                       |
                            |                CI: lint + test (PR)
                            |                       |
Merge vers main  ---------------------------------->|
                            |
                      CI sur main:
                      - lint
                      - test (coverage >= 70 %)
                      - build
                      - deploy (SSH vers EC2)
                            |
                            v
                 EC2: git pull + npm ci + pm2 reload user-api
```

---

## 7. Schémas Mermaid du workflow

### 7.1. Pipeline CI/CD complet

```mermaid
flowchart LR
  Dev[Dev local] --> FB[feature/* branch]
  FB --> PR[Pull Request vers main]

  subgraph CI_PR[CI sur Pull Request]
    LPR[lint] --> TPR[test + coverage]
  end

  PR -->|CI verte| Merge[Merge sur main]
  PR -->|CI rouge| Fix[Corriger code / tests]
  Fix --> FB

  subgraph CI_MAIN[CI sur main]
    L[lint] --> T[test + coverage >= 70%]
    T --> B[build]
    B --> D[deploy staging EC2]
  end

  Merge --> CI_MAIN
```

### 7.2. Séquence de déploiement vers EC2

```mermaid
sequenceDiagram
  participant Dev as Dev
  participant GitHub as GitHub (repo)
  participant Actions as GitHub Actions
  participant EC2 as AWS EC2 (staging)

  Dev->>GitHub: Push sur main<br/>(après merge PR)
  GitHub-->>Actions: Déclenche le workflow CI

  rect rgb(40,40,40)
    Actions->>Actions: Job lint (npm ci + npm run lint)
    Actions->>Actions: Job test (npm ci + npm test --coverage)
    Actions->>Actions: Job build (npm ci)
  end

  Actions->>EC2: SSH (appleboy/ssh-action)<br/>avec secrets (host, user, key, app dir)
  Actions->>EC2: cd $AWS_EC2_STAGING_APP_DIR
  Actions->>EC2: git fetch + git checkout main + git pull origin main
  Actions->>EC2: npm ci --omit=dev
  Actions->>EC2: pm2 reload user-api<br/>ou pm2 start src/server.js --name user-api
  EC2-->>Dev: Nouvelle version disponible en staging
```

### 7.3. Vue architecture DevOps simplifiée

```mermaid
flowchart TD
  subgraph Dev[Développeurs]
    VS[VSCode / Cursor]
    Git[Git local]
  end

  subgraph GH[GitHub]
    Repo[Repo User API]
    Actions[GitHub Actions<br/>CI - Lint, Test, Build, Deploy]
  end

  subgraph AWS[AWS]
    EC2[(EC2 staging<br/>Node + PM2)]
    DB[(SQLite<br/>data/users.db)]
  end

  VS --> Git --> Repo
  Repo --> Actions

  Actions -->|lint + test + build + deploy| EC2
  EC2 --> DB

  User[Client HTTP<br/>(Postman, front, etc.)] -->|HTTP/3000 ou via proxy| EC2
```

