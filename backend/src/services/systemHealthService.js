const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Entry = require('../models/Entry');
const { scopeToTenant } = require('../middleware/tenantScope');
const { signToken } = require('../utils/jwt');

/**
 * Every check here does REAL work against the live database - it
 * creates disposable Tenant/User/Entry documents (clearly named
 * "HealthCheck ..." with a timestamp suffix so they're unmistakable if
 * cleanup ever fails), exercises the actual code path a real request
 * would take, and deletes everything it created in a `finally` block
 * regardless of pass/fail. Nothing here is mocked or simulated.
 */

function uniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

/**
 * Proves Tenant B cannot read Tenant A's data through the real
 * tenant-isolation helper (scopeToTenant), even when given Tenant A's
 * exact, real document id - not a guessed/random one, the actual id,
 * which is the strongest version of this test.
 */
async function checkTenantIsolation() {
  const suffix = uniqueSuffix();
  let tenantA;
  let tenantB;
  let userA;
  let userB;
  let entryA;

  try {
    tenantA = await Tenant.create({ shopName: `HealthCheck Tenant A ${suffix}`, ownerName: 'Health Check' });
    tenantB = await Tenant.create({ shopName: `HealthCheck Tenant B ${suffix}`, ownerName: 'Health Check' });

    userA = await User.create({
      tenantId: tenantA._id,
      name: 'Health Check A',
      email: `healthcheck-a-${suffix}@saarthi.internal`,
      password: 'HealthCheck123!',
      role: 'admin',
    });
    userB = await User.create({
      tenantId: tenantB._id,
      name: 'Health Check B',
      email: `healthcheck-b-${suffix}@saarthi.internal`,
      password: 'HealthCheck123!',
      role: 'admin',
    });

    const EntriesA = scopeToTenant(Entry, tenantA._id);
    entryA = await EntriesA.create({
      createdBy: userA._id,
      type: 'sale',
      amount: 999,
      category: 'healthcheck',
      description: 'Tenant isolation probe entry',
    });

    // The real test: scoped as Tenant B, try to read Tenant A's exact
    // real entry id via the same helper every controller uses.
    const EntriesB = scopeToTenant(Entry, tenantB._id);
    const leaked = await EntriesB.findById(entryA._id);

    const passed = leaked === null;
    return {
      name: 'Tenant data isolation',
      passed,
      message: passed
        ? "Tenant B could not read Tenant A's entry even when given the exact real document id."
        : "Tenant B WAS able to read Tenant A's entry - isolation is broken.",
    };
  } finally {
    // Clean up regardless of outcome - never leave health-check data behind.
    if (entryA) await Entry.findByIdAndDelete(entryA._id).catch(() => {});
    if (userA) await User.findByIdAndDelete(userA._id).catch(() => {});
    if (userB) await User.findByIdAndDelete(userB._id).catch(() => {});
    if (tenantA) await Tenant.findByIdAndDelete(tenantA._id).catch(() => {});
    if (tenantB) await Tenant.findByIdAndDelete(tenantB._id).catch(() => {});
  }
}

/** Proves passwords are never stored in plaintext and comparePassword verifies correctly. */
async function checkPasswordHashing() {
  const suffix = uniqueSuffix();
  const plainPassword = 'HealthCheck123!';
  let tenant;
  let user;

  try {
    tenant = await Tenant.create({ shopName: `HealthCheck PW ${suffix}`, ownerName: 'Health Check' });
    user = await User.create({
      tenantId: tenant._id,
      name: 'Health Check PW',
      email: `healthcheck-pw-${suffix}@saarthi.internal`,
      password: plainPassword,
      role: 'admin',
    });

    // passwordHash has select:false, so it must be explicitly requested.
    const stored = await User.findById(user._id).select('+passwordHash');
    const neverPlaintext = stored.passwordHash !== plainPassword;
    const acceptsCorrect = await stored.comparePassword(plainPassword);
    const rejectsWrong = !(await stored.comparePassword('DefinitelyWrongPassword'));

    const passed = neverPlaintext && acceptsCorrect && rejectsWrong;
    return {
      name: 'Password hashing',
      passed,
      message: passed
        ? 'Passwords are hashed before storage and verify correctly against the right/wrong password.'
        : 'Password hashing or verification did not behave as expected.',
    };
  } finally {
    if (user) await User.findByIdAndDelete(user._id).catch(() => {});
    if (tenant) await Tenant.findByIdAndDelete(tenant._id).catch(() => {});
  }
}

/** Proves JWTs sign with the right claims, verify correctly, and reject tampering. */
function checkJwtValidity() {
  try {
    const fakeClaims = {
      tenantId: new mongoose.Types.ObjectId().toString(),
      userId: new mongoose.Types.ObjectId().toString(),
      role: 'admin',
    };
    const token = signToken(fakeClaims);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const claimsMatch =
      decoded.tenantId === fakeClaims.tenantId && decoded.userId === fakeClaims.userId && decoded.role === fakeClaims.role;

    let rejectsTampered = false;
    try {
      jwt.verify(`${token.slice(0, -2)}xx`, process.env.JWT_SECRET);
    } catch {
      rejectsTampered = true;
    }

    const passed = claimsMatch && rejectsTampered;
    return {
      name: 'JWT signing & verification',
      passed,
      message: passed
        ? 'Tokens sign with the correct claims, verify correctly, and a tampered token is rejected.'
        : 'JWT signing or verification did not behave as expected.',
    };
  } catch (err) {
    return { name: 'JWT signing & verification', passed: false, message: err.message };
  }
}

/** Proves a second registration with the same email is rejected, never creating a duplicate account. */
async function checkDuplicateUserPrevention() {
  const suffix = uniqueSuffix();
  const email = `healthcheck-dup-${suffix}@saarthi.internal`;
  let tenant;
  let firstUser;

  try {
    tenant = await Tenant.create({ shopName: `HealthCheck DUP ${suffix}`, ownerName: 'Health Check' });
    firstUser = await User.create({
      tenantId: tenant._id,
      name: 'Health Check One',
      email,
      password: 'HealthCheck123!',
      role: 'admin',
    });

    let duplicateRejected = false;
    try {
      await User.create({
        tenantId: tenant._id,
        name: 'Health Check Two',
        email,
        password: 'HealthCheck123!',
        role: 'admin',
      });
    } catch (err) {
      duplicateRejected = err.code === 11000; // Mongo duplicate key error
    }

    return {
      name: 'Duplicate user prevention',
      passed: duplicateRejected,
      message: duplicateRejected
        ? 'A second account with an already-used email was correctly rejected.'
        : 'A duplicate email was NOT rejected - this is a bug.',
    };
  } finally {
    if (firstUser) await User.findByIdAndDelete(firstUser._id).catch(() => {});
    if (tenant) await Tenant.findByIdAndDelete(tenant._id).catch(() => {});
  }
}

/**
 * Runs every check, timing each one and never letting one check's
 * crash take down the others.
 */
async function runAllChecks() {
  const checkFns = [checkTenantIsolation, checkPasswordHashing, checkJwtValidity, checkDuplicateUserPrevention];
  const results = [];

  for (const fn of checkFns) {
    const startedAt = Date.now();
    try {
      const result = await fn();
      results.push({ ...result, durationMs: Date.now() - startedAt });
    } catch (err) {
      results.push({
        name: fn.name,
        passed: false,
        message: `Check crashed unexpectedly: ${err.message}`,
        durationMs: Date.now() - startedAt,
      });
    }
  }

  return results;
}

module.exports = {
  checkTenantIsolation,
  checkPasswordHashing,
  checkJwtValidity,
  checkDuplicateUserPrevention,
  runAllChecks,
};