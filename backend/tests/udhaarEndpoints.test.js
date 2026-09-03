const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { createApp } = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const UdhaarTransaction = require('../src/models/UdhaarTransaction');

let mongoServer;
let app;
let token;

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

async function registerAndLogin() {
  const res = await request(app).post('/api/auth/register').send({
    shopName: 'Udhaar Test Store',
    ownerName: 'Test Owner',
    email: `udhaar-${Date.now()}@example.com`,
    password: 'securePass123',
  });
  return res.body.token;
}

beforeEach(async () => {
  token = await registerAndLogin();
});

/**
 * Regression test for a bug found during audit: removeCustomer() used
 * to call Transactions.deleteOne({ customerId }) - which only deletes
 * ONE matching document - instead of deleteMany(), silently leaving
 * every other transaction for that customer orphaned in the database.
 */
describe('DELETE /api/udhaar/customers/:id', () => {
  it('deletes every transaction belonging to the customer, not just one', async () => {
    const customerRes = await request(app)
      .post('/api/udhaar/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Suresh', phone: '9999999999' });
    expect(customerRes.status).toBe(201);
    const customerId = customerRes.body.customer.id || customerRes.body.customer._id;

    // Add three separate transactions for the same customer.
    for (const amount of [500, 300, 100]) {
      const txRes = await request(app)
        .post(`/api/udhaar/customers/${customerId}/transactions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'credit', amount });
      expect(txRes.status).toBe(201);
    }

    const beforeCount = await UdhaarTransaction.countDocuments({ customerId });
    expect(beforeCount).toBe(3);

    const deleteRes = await request(app)
      .delete(`/api/udhaar/customers/${customerId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);

    const afterCount = await UdhaarTransaction.countDocuments({ customerId });
    expect(afterCount).toBe(0);
  });

  it("does not touch another customer's transactions", async () => {
    const customerA = await request(app)
      .post('/api/udhaar/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Customer A' });
    const customerB = await request(app)
      .post('/api/udhaar/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Customer B' });

    const idA = customerA.body.customer.id || customerA.body.customer._id;
    const idB = customerB.body.customer.id || customerB.body.customer._id;

    await request(app)
      .post(`/api/udhaar/customers/${idA}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'credit', amount: 200 });
    await request(app)
      .post(`/api/udhaar/customers/${idB}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'credit', amount: 400 });

    await request(app)
      .delete(`/api/udhaar/customers/${idA}`)
      .set('Authorization', `Bearer ${token}`);

    const remainingForB = await UdhaarTransaction.countDocuments({ customerId: idB });
    expect(remainingForB).toBe(1);
  });
});
