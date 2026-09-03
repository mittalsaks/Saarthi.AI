const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { createApp } = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDB(mongoServer.getUri());
  app = createApp();
});

afterAll(async () => {
  await disconnectDB();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

function validRegisterPayload(overrides = {}) {
  return {
    shopName: 'Sharma Kirana Store',
    ownerName: 'Ramesh Sharma',
    email: 'ramesh@example.com',
    password: 'securePass123',
    ...overrides,
  };
}

describe('POST /api/auth/register', () => {
  it('creates a Tenant + admin User together and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send(validRegisterPayload());

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('ramesh@example.com');
    expect(res.body.user.role).toBe('admin');
    expect(res.body.tenant.shopName).toBe('Sharma Kirana Store');
  });

  it('rejects a duplicate email', async () => {
    await request(app).post('/api/auth/register').send(validRegisterPayload());
    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegisterPayload({ shopName: 'Another Shop' }));

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'incomplete@example.com', password: 'securePass123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing required/i);
  });

  it('rejects an invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegisterPayload({ email: 'not-an-email' }));

    expect(res.status).toBe(400);
  });

  it('rejects a too-short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegisterPayload({ password: '123' }));

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(validRegisterPayload());
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ramesh@example.com', password: 'securePass123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('ramesh@example.com');
  });

  it('rejects a wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ramesh@example.com', password: 'wrongPassword' });

    expect(res.status).toBe(401);
  });

  it('rejects a non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever123' });

    expect(res.status).toBe(401);
  });
});

describe('Protected routes / token verification', () => {
  it('rejects requests with no Authorization header', async () => {
    const res = await request(app).get('/api/team');
    expect(res.status).toBe(401);
  });

  it('rejects requests with a malformed/invalid token', async () => {
    const res = await request(app).get('/api/team').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('accepts requests with a valid token from register', async () => {
    const registerRes = await request(app).post('/api/auth/register').send(validRegisterPayload());
    const token = registerRes.body.token;

    const res = await request(app).get('/api/team').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  it('GET /api/auth/me returns the user + tenant for a valid token', async () => {
    const registerRes = await request(app).post('/api/auth/register').send(validRegisterPayload());
    const token = registerRes.body.token;

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('ramesh@example.com');
    expect(res.body.tenant.shopName).toBe('Sharma Kirana Store');
  });
});
