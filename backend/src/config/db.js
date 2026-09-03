const mongoose = require('mongoose');

/**
 * Connects to MongoDB using the URI in process.env.MONGODB_URI.
 * Kept as a single reusable function so tests can point it at
 * mongodb-memory-server instead of a real cluster.
 */
async function connectDB(uri) {
  const mongoUri = uri || process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env and fill it in.');
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(mongoUri);

  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
