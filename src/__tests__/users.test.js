const request = require('supertest');
const app = require('../app');
const db = require('../db');

beforeEach((done) => {
  db.run('DELETE FROM users', done);
});

afterAll((done) => {
  db.close(done);
});

test('POST /api/users crée un utilisateur', async () => {
  const response = await request(app)
    .post('/api/users')
    .send({ name: 'Jean', email: 'jean@example.com' })
    .set('Accept', 'application/json');

  expect(response.status).toBe(201);
  expect(response.body).toMatchObject({
    id: expect.any(Number),
    name: 'Jean',
    email: 'jean@example.com',
  });
});

test('GET /api/users retourne une liste (après création)', async () => {
  await request(app).post('/api/users').send({ name: 'Jean', email: 'jean@example.com' });

  const response = await request(app).get('/api/users');

  expect(response.status).toBe(200);
  expect(Array.isArray(response.body)).toBe(true);
  expect(response.body.length).toBe(1);
  expect(response.body[0]).toMatchObject({
    name: 'Jean',
    email: 'jean@example.com',
  });
});

test('POST /api/users retourne 400 si champs manquants', async () => {
  const response = await request(app)
    .post('/api/users')
    .send({ name: 'Jean' });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe('Les champs name et email sont obligatoires');
});

test('POST /api/users retourne 400 si email vide après trim', async () => {
  const response = await request(app)
    .post('/api/users')
    .send({ name: 'Jean', email: '   ' });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe('Les champs name et email ne peuvent pas être vides');
});

test('POST /api/users retourne 400 si email dupliqué', async () => {
  const payload = { name: 'Jean', email: 'jean@example.com' };

  await request(app).post('/api/users').send(payload);
  const response = await request(app).post('/api/users').send(payload);

  expect(response.status).toBe(400);
  expect(response.body.message).toBe('Un utilisateur avec cet email existe déjà');
});

test('GET /api/users/:id retourne un utilisateur existant', async () => {
  const createResponse = await request(app)
    .post('/api/users')
    .send({ name: 'Marie', email: 'marie@example.com' });

  const { id } = createResponse.body;

  const response = await request(app).get(`/api/users/${id}`);

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({
    id,
    name: 'Marie',
    email: 'marie@example.com',
  });
});

test('GET /api/users/:id retourne 400 si id invalide', async () => {
  const response = await request(app).get('/api/users/abc');

  expect(response.status).toBe(400);
  expect(response.body.message).toBe('Identifiant invalide');
});

test('GET /api/users/:id retourne 404 si utilisateur inexistant', async () => {
  const response = await request(app).get('/api/users/9999');

  expect(response.status).toBe(404);
  expect(response.body.message).toBe('Utilisateur non trouvé');
});


