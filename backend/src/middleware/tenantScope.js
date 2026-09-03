/**
 * Tenant isolation helper.
 *
 * Every model that stores tenant-owned data (User, and everything built
 * in later parts: Entry, StockItem, UdhaarRecord, Alert...) MUST be
 * queried through `scopeToTenant(Model, tenantId)` rather than calling
 * Model.find/findOne/etc directly. This guarantees a tenantId filter is
 * always present and can never be overridden by whatever a caller
 * passes in, because tenantId is merged in LAST on reads and stripped
 * out of the update payload on writes.
 *
 * Usage inside a controller (tenantId comes from req.tenantId, which
 * requireAuth.js sets from the verified JWT - never from req.body):
 *
 *   const Entries = scopeToTenant(Entry, req.tenantId);
 *   const list    = await Entries.find({ type: 'sale' });
 *   const one     = await Entries.findById(id);
 *   const created = await Entries.create({ amount: 500 });
 */

function assertValidTenantId(tenantId) {
  if (!tenantId) {
    throw new Error(
      'scopeToTenant() called without a tenantId. This should never happen ' +
        'downstream of the requireAuth middleware - check that the route uses it.'
    );
  }
}

function stripTenantId(update = {}) {
  const safe = { ...update };
  if (safe.$set) {
    safe.$set = { ...safe.$set };
    delete safe.$set.tenantId;
  }
  delete safe.tenantId;
  return safe;
}

function scopeToTenant(Model, tenantId) {
  assertValidTenantId(tenantId);

  return {
    find(filter = {}, ...rest) {
      return Model.find({ ...filter, tenantId }, ...rest);
    },
    findOne(filter = {}, ...rest) {
      return Model.findOne({ ...filter, tenantId }, ...rest);
    },
    // Deliberately implemented as findOne({ _id, tenantId }) rather than
    // Model.findById(id) so that guessing another tenant's document id
    // returns null instead of their data.
    findById(id, ...rest) {
      return Model.findOne({ _id: id, tenantId }, ...rest);
    },
    create(doc = {}) {
      return Model.create({ ...doc, tenantId });
    },
    updateOne(filter = {}, update = {}, ...rest) {
      return Model.updateOne({ ...filter, tenantId }, stripTenantId(update), ...rest);
    },
    updateMany(filter = {}, update = {}, ...rest) {
      return Model.updateMany({ ...filter, tenantId }, stripTenantId(update), ...rest);
    },
    findByIdAndUpdate(id, update = {}, options = {}) {
      return Model.findOneAndUpdate({ _id: id, tenantId }, stripTenantId(update), options);
    },
    deleteOne(filter = {}, ...rest) {
      return Model.deleteOne({ ...filter, tenantId }, ...rest);
    },
    // Use this (not deleteOne) whenever a filter can legitimately match
    // more than one document - e.g. deleting every transaction that
    // belongs to a customer being removed.
    deleteMany(filter = {}, ...rest) {
      return Model.deleteMany({ ...filter, tenantId }, ...rest);
    },
    findByIdAndDelete(id) {
      return Model.findOneAndDelete({ _id: id, tenantId });
    },
    countDocuments(filter = {}) {
      return Model.countDocuments({ ...filter, tenantId });
    },
  };
}

module.exports = { scopeToTenant };
