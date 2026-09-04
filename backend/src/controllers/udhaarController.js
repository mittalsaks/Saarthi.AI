const UdhaarCustomer = require('../models/UdhaarCustomer');
const UdhaarTransaction = require('../models/UdhaarTransaction');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const { scopeToTenant } = require('../middleware/tenantScope');
const udhaarService = require('../services/udhaarService');
const geminiService = require('../services/geminiService');
const smsService = require('../services/smsService');
const emailService = require('../services/emailService');

/**
 * POST /api/udhaar/customers
 */
async function createCustomer(req, res) {
  try {
    const { name, phone, email, note } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    const trimmedEmail = email ? String(email).trim().slice(0, 254) : '';
    if (trimmedEmail && !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      return res.status(400).json({ error: 'email looks invalid' });
    }

    const Customers = scopeToTenant(UdhaarCustomer, req.tenantId);
    const customer = await Customers.create({
      createdBy: req.userId,
      name: String(name).trim().slice(0, 120),
      phone: phone ? String(phone).trim().slice(0, 20) : '',
      email: trimmedEmail,
      note: note ? String(note).trim().slice(0, 200) : '',
    });

    return res.status(201).json({ customer: udhaarService.serializeCustomer(customer, []) });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error('create udhaar customer error:', err);
    return res.status(500).json({ error: 'Something went wrong while adding the customer' });
  }
}

/**
 * GET /api/udhaar/customers
 * List every customer with their balance derived fresh from their
 * transactions - sorted so who owes the most shows up first.
 */
async function listCustomers(req, res) {
  try {
    const Customers = scopeToTenant(UdhaarCustomer, req.tenantId);
    const Transactions = scopeToTenant(UdhaarTransaction, req.tenantId);

    const customers = await Customers.find({});
    const transactions = await Transactions.find({});

    const byCustomer = new Map();
    for (const t of transactions) {
      const key = String(t.customerId);
      if (!byCustomer.has(key)) byCustomer.set(key, []);
      byCustomer.get(key).push(t);
    }

    const serialized = customers
      .map((c) => udhaarService.serializeCustomer(c, byCustomer.get(String(c._id)) || []))
      .sort((a, b) => b.balance - a.balance);

    return res.status(200).json({ customers: serialized });
  } catch (err) {
    console.error('list udhaar customers error:', err);
    return res.status(500).json({ error: 'Something went wrong while loading customers' });
  }
}

/**
 * GET /api/udhaar/customers/:id
 * Single customer with full transaction history.
 */
async function getCustomer(req, res) {
  try {
    const Customers = scopeToTenant(UdhaarCustomer, req.tenantId);
    const Transactions = scopeToTenant(UdhaarTransaction, req.tenantId);

    const customer = await Customers.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const transactions = await Transactions.find({ customerId: customer._id }).sort({ date: -1 });
    const serialized = udhaarService.serializeCustomer(customer, transactions);
    serialized.transactions = transactions;

    return res.status(200).json({ customer: serialized });
  } catch (err) {
    console.error('get udhaar customer error:', err);
    return res.status(500).json({ error: 'Something went wrong while loading the customer' });
  }
}

/**
 * POST /api/udhaar/customers/:id/transactions
 * Record credit given or a payment received. Balance is never written
 * directly - it's just the sum of these rows (see udhaarService).
 */
async function addTransaction(req, res) {
  try {
    const { type, amount, note, date } = req.body || {};
    if (!['credit', 'payment'].includes(type)) {
      return res.status(400).json({ error: "type must be 'credit' or 'payment'" });
    }
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const Customers = scopeToTenant(UdhaarCustomer, req.tenantId);
    const customer = await Customers.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const Transactions = scopeToTenant(UdhaarTransaction, req.tenantId);
    const transaction = await Transactions.create({
      customerId: customer._id,
      createdBy: req.userId,
      type,
      amount: numAmount,
      note: note ? String(note).trim().slice(0, 200) : '',
      date: date ? new Date(date) : new Date(),
    });

    const allTransactions = await Transactions.find({ customerId: customer._id });
    const serialized = udhaarService.serializeCustomer(customer, allTransactions);

    // Automatic payment-received confirmation - no manual "Send
    // Reminder" click needed. Best-effort only: this never fails the
    // request, since the transaction itself already saved successfully.
    if (type === 'payment' && (customer.phone || customer.email)) {
      sendPaymentConfirmation({
        tenantId: req.tenantId,
        customer,
        remainingBalance: serialized.balance,
        amountPaid: numAmount,
      }).catch((err) => console.error('payment confirmation send failed:', err.message));
    }

    return res.status(201).json({ transaction, customer: serialized });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error('add udhaar transaction error:', err);
    return res.status(500).json({ error: 'Something went wrong while saving the transaction' });
  }
}

/**
 * Fire-and-forget confirmation sent right when a payment is recorded -
 * "thanks, payment received" plus either the remaining balance or
 * "dues fully cleared". Runs over whichever channels the customer has
 * on file, same pattern as sendReminder. Never throws into the
 * request that triggered it - the caller wraps this in .catch().
 */
async function sendPaymentConfirmation({ tenantId, customer, remainingBalance, amountPaid }) {
  const tenant = await Tenant.findById(tenantId);
  const shopName = tenant?.shopName || 'the shop';

  const amountText = `Rs ${amountPaid}`;
  const message =
    remainingBalance > 0
      ? `Namaste ${customer.name}, we've received your payment of ${amountText} at ${shopName}. Your remaining balance is Rs ${remainingBalance}. Thank you!`
      : `Namaste ${customer.name}, we've received your payment of ${amountText} at ${shopName}. Your udhaar is now fully cleared. Thank you!`;

  const channels = {};
  if (customer.phone) channels.sms = await smsService.sendSms(customer.phone, message);
  if (customer.email) {
    channels.email = await emailService.sendEmail(
      customer.email,
      `Payment received - ${shopName}`,
      message,
      { type: 'payment_confirmation', shopName, customerName: customer.name, balance: remainingBalance }
    );
  }
  return channels;
}

/**
 * Shared by draftReminder and sendReminder - loads the customer, computes
 * their live balance, and drafts the Gemini reminder message from it.
 * Throws a NO_BALANCE error (caller maps to 400) if there's nothing owed,
 * or lets the caller's own try/catch handle a missing customer / Gemini
 * failure.
 */
async function loadCustomerAndDraftMessage(req) {
  const Customers = scopeToTenant(UdhaarCustomer, req.tenantId);
  const Transactions = scopeToTenant(UdhaarTransaction, req.tenantId);

  const customer = await Customers.findById(req.params.id);
  if (!customer) {
    const err = new Error('Customer not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const transactions = await Transactions.find({ customerId: customer._id });
  const balance = udhaarService.computeBalance(transactions);

  if (balance <= 0) {
    const err = new Error('This customer has no outstanding balance');
    err.code = 'NO_BALANCE';
    throw err;
  }

  const tenant = await Tenant.findById(req.tenantId);
  const user = await User.findById(req.userId);

  const message = await geminiService.generateUdhaarReminder({
    ownerName: user?.name || 'The shop owner',
    shopName: tenant?.shopName || 'the shop',
    languagePref: user?.languagePref || 'Hinglish',
    customerName: customer.name,
    balance,
  });

  return { customer, balance, message, shopName: tenant?.shopName || 'the shop' };
}

/**
 * GET /api/udhaar/customers/:id/reminder
 * Drafts an AI reminder using the exact code-computed balance. Returns
 * 400 if the customer's balance is already zero/negative - nothing to
 * remind them about.
 */
async function draftReminder(req, res) {
  try {
    const { message, balance } = await loadCustomerAndDraftMessage(req);
    return res.status(200).json({ message, balance });
  } catch (err) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
    if (err.code === 'NO_BALANCE') return res.status(400).json({ error: err.message });
    console.error('draft udhaar reminder error:', err);
    return res.status(502).json({ error: 'AI reminder is unavailable right now, please try again' });
  }
}

/**
 * POST /api/udhaar/customers/:id/send-reminder
 * Drafts the same AI reminder as above, then actually delivers it -
 * over SMS if the customer has a phone on file, over email if they have
 * an email on file, over both if both are on file. Each channel is
 * attempted independently and its own success/failure is reported back;
 * a failure on one channel never blocks or crashes the other.
 */
async function sendReminder(req, res) {
  let draft;
  try {
    draft = await loadCustomerAndDraftMessage(req);
  } catch (err) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
    if (err.code === 'NO_BALANCE') return res.status(400).json({ error: err.message });
    console.error('draft udhaar reminder (send) error:', err);
    return res.status(502).json({ error: 'AI reminder is unavailable right now, please try again' });
  }

  const { customer, balance, message, shopName } = draft;

  if (!customer.phone && !customer.email) {
    return res.status(400).json({
      error: 'This customer has no phone or email on file - add contact info first',
      channels: {},
    });
  }

  const channels = {};

  if (customer.phone) {
    channels.sms = await smsService.sendSms(customer.phone, message);
  }

  if (customer.email) {
    channels.email = await emailService.sendEmail(
      customer.email,
      `Udhaar reminder from ${shopName}`,
      message,
      { shopName, customerName: customer.name, balance }
    );
  }

  const attempted = Object.keys(channels);
  const anySuccess = attempted.some((k) => channels[k].success);

  return res.status(anySuccess ? 200 : 502).json({
    message,
    balance,
    channels,
  });
}

/**
 * DELETE /api/udhaar/customers/:id
 */
async function removeCustomer(req, res) {
  try {
    const Customers = scopeToTenant(UdhaarCustomer, req.tenantId);
    const Transactions = scopeToTenant(UdhaarTransaction, req.tenantId);

    const result = await Customers.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Customer not found' });

    // deleteMany, not deleteOne - a customer can have many transactions
    // and every one of them needs to go with them.
    await Transactions.deleteMany({ customerId: result._id });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('delete udhaar customer error:', err);
    return res.status(500).json({ error: 'Something went wrong while deleting the customer' });
  }
}

/**
 * GET /api/udhaar/summary
 * Deterministic totals used for the sidebar badge.
 */
async function summary(req, res) {
  try {
    const Customers = scopeToTenant(UdhaarCustomer, req.tenantId);
    const Transactions = scopeToTenant(UdhaarTransaction, req.tenantId);

    const customers = await Customers.find({});
    const transactions = await Transactions.find({});

    const byCustomer = new Map();
    for (const t of transactions) {
      const key = String(t.customerId);
      if (!byCustomer.has(key)) byCustomer.set(key, []);
      byCustomer.get(key).push(t);
    }
    const serialized = customers.map((c) =>
      udhaarService.serializeCustomer(c, byCustomer.get(String(c._id)) || [])
    );

    return res.status(200).json(udhaarService.summarize(serialized));
  } catch (err) {
    console.error('udhaar summary error:', err);
    return res.status(500).json({ error: 'Something went wrong while loading the summary' });
  }
}

module.exports = {
  createCustomer,
  listCustomers,
  getCustomer,
  addTransaction,
  draftReminder,
  sendReminder,
  removeCustomer,
  summary,
};