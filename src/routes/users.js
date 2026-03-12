const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res, next) => {
  db.all('SELECT id, name, email, created_at FROM users', (err, rows) => {
    if (err) {
      return next(err);
    }

    return res.json(rows);
  });
});

router.get('/:id', (req, res, next) => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    return res.status(400).json({ message: 'Identifiant invalide' });
  }

  db.get('SELECT id, name, email, created_at FROM users WHERE id = ?', [id], (err, row) => {
    if (err) {
      return next(err);
    }

    if (!row) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    return res.json(row);
  });
});

router.post('/', (req, res, next) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ message: 'Les champs name et email sont obligatoires' });
  }

  const trimmedName = String(name).trim();
  const trimmedEmail = String(email).trim();

  if (!trimmedName || !trimmedEmail) {
    return res.status(400).json({ message: 'Les champs name et email ne peuvent pas être vides' });
  }

  const insertQuery = 'INSERT INTO users (name, email) VALUES (?, ?)';

  db.run(insertQuery, [trimmedName, trimmedEmail], function onInsert(err) {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(400).json({ message: 'Un utilisateur avec cet email existe déjà' });
      }

      return next(err);
    }

    const newUser = {
      id: this.lastID,
      name: trimmedName,
      email: trimmedEmail,
    };

    return res.status(201).json(newUser);
  });
});

router.put('/:id', (req, res, next) => {
  const id = Number(req.params.id);
  const { name, email } = req.body;

  if (Number.isNaN(id)) {
    return res.status(400).json({ message: 'Identifiant invalide' });
  }

  if (!name && !email) {
    return res.status(400).json({ message: 'Au moins un champ (name ou email) doit être fourni' });
  }

  const trimmedName = typeof name === 'string' ? name.trim() : undefined;
  const trimmedEmail = typeof email === 'string' ? email.trim() : undefined;

  const updateQuery = `
    UPDATE users
    SET
      name = COALESCE(?, name),
      email = COALESCE(?, email)
    WHERE id = ?
  `;

  db.run(updateQuery, [trimmedName, trimmedEmail, id], function onUpdate(err) {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(400).json({ message: 'Un utilisateur avec cet email existe déjà' });
      }

      return next(err);
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    db.get('SELECT id, name, email, created_at FROM users WHERE id = ?', [id], (selectErr, row) => {
      if (selectErr) {
        return next(selectErr);
      }

      return res.json(row);
    });
  });
});

router.delete('/:id', (req, res, next) => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    return res.status(400).json({ message: 'Identifiant invalide' });
  }

  const deleteQuery = 'DELETE FROM users WHERE id = ?';

  db.run(deleteQuery, [id], function onDelete(err) {
    if (err) {
      return next(err);
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    return res.status(204).send();
  });
});

module.exports = router;

