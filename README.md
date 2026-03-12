# User API
REST API pour gestion d'utilisateurs.

[![CI](https://github.com/phareal/lbs-ci-cd/actions/workflows/ci.yml/badge.svg)](https://github.com/phareal/lbs-ci-cd/actions)

## Installation
```bash
npm install
```

## Tests
```bash
npm test
npm run test:coverage
```

## Linting
```bash
npm run lint
```

## Endpoints

- **GET** `/api/users` : liste tous les utilisateurs
- **GET** `/api/users/:id` : récupère un utilisateur par son identifiant
- **POST** `/api/users` : crée un nouvel utilisateur (`name`, `email`)
- **PUT** `/api/users/:id` : met à jour un utilisateur existant (`name` et/ou `email`)
- **DELETE** `/api/users/:id` : supprime un utilisateur

## Workflow Git

- **Branche principale protégée** : aucun push direct sur `main`.
- Pour ajouter des changements :
  - Créer une branche de feature : `git checkout -b feature/ma-feature`
  - Pousser la branche : `git push origin feature/ma-feature`
  - Ouvrir une Pull Request vers `main` sur GitHub
  - Faire relire et merger depuis GitHub (pas de `git push origin main` direct)
- **Règle de qualité** : la PR ne peut être mergée que si la CI est verte, donc **si le lint ne remonte aucune erreur** et si les tests passent avec une couverture globale **≥ 70 %** (contrôlé par Jest + GitHub Actions + règles de protection de branche).


