const express = require('express');
const usersRouter = require('./routes/users');

const app = express();

app.use(express.json());

app.use('/api/users', usersRouter);

// 404 pour toutes les routes non trouvées
app.use((req, res) => res.status(404).json({ message: 'Ressource non trouvée' }));

// Middleware de gestion globale des erreurs
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(err);

  return res.status(500).json({ message: 'Erreur serveur interne' });
});

module.exports = app;

