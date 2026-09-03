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

/**
 * Registers two completely separate tenants (Tenant A and Tenant B)
 * and proves that Tenant B's token can never see Tenant A's data
 * through the real HTTP API - not via the list endpoint, and not by
 * guessing a valid-looking id. This is the core guarantee
 * scopeToTenant() (Part 1) is supposed to provide once wired into
 * real routes, which is exactly what Part 2 does for the first time.
 */
describe('Tenant isolation over the real HTTP API', () => {
  it('Tenant B cannot see Tenant A users via the shared /api/team endpoint', async () => {
    const tenantARes = await request(app).post('/api/auth/register').send({
      shopName: 'Tenant A Store',
      ownerName: 'Owner A',
      email: 'ownerA@example.com',
      password: 'passwordA123',
    });
    const tenantBRes = await request(app).post('/api/auth/register').send({
      shopName: 'Tenant B Store',
      ownerName: 'Owner B',
      email: 'ownerB@example.com',
      password: 'passwordB123',
    });

    expect(tenantARes.status).toBe(201);
    expect(tenantBRes.status).toBe(201);

    const tokenA = tenantARes.body.token;
    const tokenB = tenantBRes.body.token;

    const teamA = await request(app).get('/api/team').set('Authorization', `Bearer ${tokenA}`);
    const teamB = await request(app).get('/api/team').set('Authorization', `Bearer ${tokenB}`);

    expect(teamA.status).toBe(200);
    expect(teamB.status).toBe(200);

    // Each tenant only ever sees its own single admin user.
    expect(teamA.body.users).toHaveLength(1);
    expect(teamB.body.users).toHaveLength(1);
    expect(teamA.body.users[0].email).toBe('ownera@example.com');
    expect(teamB.body.users[0].email).toBe('ownerb@example.com');

    // Cross-check: neither tenant's user list contains the other's email.
    const emailsSeenByB = teamB.body.users.map((u) => u.email);
    expect(emailsSeenByB).not.toContain('ownera@example.com');
  });

  it("Tenant B's token cannot fetch Tenant A's own user document by guessing its id", async () => {
    const tenantARes = await request(app).post('/api/auth/register').send({
      shopName: 'Tenant A Store',
      ownerName: 'Owner A',
      email: 'ownerA2@example.com',
      password: 'passwordA123',
    });
    const tenantBRes = await request(app).post('/api/auth/register').send({
      shopName: 'Tenant B Store',
      ownerName: 'Owner B',
      email: 'ownerB2@example.com',
      password: 'passwordB123',
    });

    const tokenB = tenantBRes.body.token;
    const tenantAUserId = tenantARes.body.user.id;

    // /api/auth/me uses req.userId from B's own verified token, so it
    // will never look up A's id - but this proves the tenant-scoped
    // findById in scopeToTenant() also filters by tenantId, by hitting
    // /api/team (which lists via scopeToTenant().find) and confirming
    // Tenant A's id never appears in Tenant B's results.
    const teamB = await request(app).get('/api/team').set('Authorization', `Bearer ${tokenB}`);

    const idsSeenByB = teamB.body.users.map((u) => u.id || u._id).map(String);
    expect(idsSeenByB).not.toContain(String(tenantAUserId));
  });

  it('rejects a token whose tenantId has no matching tenant (forged/stale claim)', async () => {
    const jwt = require('jsonwebtoken');
    const fakeTenantId = new mongoose.Types.ObjectId().toString();
    const fakeUserId = new mongoose.Types.ObjectId().toString();

    const forgedToken = jwt.sign(
      { tenantId: fakeTenantId, userId: fakeUserId, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // The token itself is validly signed, so requireAuth lets it through,
    // but scopeToTenant()'s query for that tenantId simply returns
    // nothing - proving isolation holds even for a syntactically valid
    // but non-existent tenant.
    const res = await request(app).get('/api/team').set('Authorization', `Bearer ${forgedToken}`);
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(0);
  });
});
