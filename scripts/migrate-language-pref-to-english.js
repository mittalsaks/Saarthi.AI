/**
 * One-time migration: resets any user whose `languagePref` is no longer
 * a valid value (i.e. anything other than 'English') to 'English'.
 *
 * Why this is needed: the User model's `languagePref` field now has
 * enum: ['English'] (see backend/src/utils/languages.js). Any existing
 * user document saved earlier with 'Hinglish', 'Hindi', 'Marathi', etc.
 * will fail Mongoose validation the next time that document is saved
 * (e.g. on their next login-triggered update, or any profile edit) -
 * even though reads/logins still work fine until then.
 *
 * Run this once, after deploying the enum change, to pre-emptively fix
 * every existing user in one pass instead of waiting for those errors
 * to surface one user at a time in production.
 *
 * Usage:
 *   node scripts/migrate-language-pref-to-english.js
 *
 * Requires MONGODB_URI (same env var the app itself uses) to be set,
 * e.g. via `backend/.env` or exported in the shell.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function migrate() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is not set - aborting.');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB.');

  // Talk to the raw collection instead of the User model, so this script
  // still works even if the model's schema/enum has already changed by
  // the time it runs (which is exactly the situation we're fixing).
  const users = mongoose.connection.collection('users');

  const result = await users.updateMany(
    { languagePref: { $ne: 'English' } },
    { $set: { languagePref: 'English' } }
  );

  console.log(
    `Matched ${result.matchedCount} user(s) with a non-English languagePref, ` +
      `updated ${result.modifiedCount}.`
  );

  await mongoose.disconnect();
  console.log('Done.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
