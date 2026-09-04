/**
 * Automation for udhaar: a daily reminder to every customer who still
 * owes money, and a daily morning digest email to the shop's admin
 * summarizing yesterday's activity. Both are called once per tenant,
 * per day, from jobs/udhaarCron.js.
 *
 * Reuses the exact same balance math (udhaarService), reminder drafting
 * (geminiService) and delivery channels (smsService/emailService) as
 * the manual "Send Reminder" button in udhaarController - this is just
 * that same flow, run automatically for everyone instead of one
 * customer at a click.
 */

const UdhaarCustomer = require('../models/UdhaarCustomer');
const UdhaarTransaction = require('../models/UdhaarTransaction');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const { scopeToTenant } = require('../middleware/tenantScope');
const udhaarService = require('./udhaarService');
const geminiService = require('./geminiService');
const smsService = require('./smsService');
const emailService = require('./emailService');

/** Start (00:00:00) of the previous calendar day, and start of today - used to window "yesterday". */
function yesterdayWindow() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  return { start: startOfYesterday, end: startOfToday };
}

/**
 * Sends today's automatic reminder to every customer of this tenant who
 * currently has a positive balance. Best-effort per customer - one
 * customer's Gemini/SMS/email failure never stops the rest.
 */
async function sendDailyReminders(tenantId, { ownerName, shopName, languagePref }) {
  const Customers = scopeToTenant(UdhaarCustomer, tenantId);
  const Transactions = scopeToTenant(UdhaarTransaction, tenantId);

  const customers = await Customers.find({});
  const transactions = await Transactions.find({});

  const byCustomer = new Map();
  for (const t of transactions) {
    const key = String(t.customerId);
    if (!byCustomer.has(key)) byCustomer.set(key, []);
    byCustomer.get(key).push(t);
  }

  const results = [];

  for (const customer of customers) {
    const balance = udhaarService.computeBalance(byCustomer.get(String(customer._id)) || []);
    if (balance <= 0) continue; // nothing owed - no reminder
    if (!customer.phone && !customer.email) continue; // nowhere to send it

    try {
      const message = await geminiService.generateUdhaarReminder({
        ownerName,
        shopName,
        languagePref,
        customerName: customer.name,
        balance,
      });

      const channels = {};
      if (customer.phone) channels.sms = await smsService.sendSms(customer.phone, message);
      if (customer.email) {
        channels.email = await emailService.sendEmail(
          customer.email,
          `Udhaar reminder from ${shopName}`,
          message,
          { shopName, customerName: customer.name, balance }
        );
      }

      const anySuccess = Object.values(channels).some((c) => c.success);
      if (anySuccess) {
        customer.lastReminderSentAt = new Date();
        await customer.save();
      }

      results.push({ customerId: customer._id, name: customer.name, balance, channels });
    } catch (err) {
      console.error(`daily reminder failed for customer ${customer._id}:`, err.message);
      results.push({ customerId: customer._id, name: customer.name, balance, error: err.message });
    }
  }

  return results;
}

/**
 * Builds and sends the admin's daily morning digest: every customer
 * who transacted yesterday, split into "pending" (still owe something
 * as of right now) and "completed" (their balance is fully settled).
 * Sent to every admin user of the tenant who has an email.
 */
async function sendAdminDailyDigest(tenantId, { shopName }) {
  const { start, end } = yesterdayWindow();

  const Customers = scopeToTenant(UdhaarCustomer, tenantId);
  const Transactions = scopeToTenant(UdhaarTransaction, tenantId);

  const yesterdaysTransactions = await Transactions.find({ date: { $gte: start, $lt: end } });
  if (!yesterdaysTransactions.length) {
    return { skipped: true, reason: 'No udhaar activity yesterday' };
  }

  const allTransactions = await Transactions.find({});
  const byCustomer = new Map();
  for (const t of allTransactions) {
    const key = String(t.customerId);
    if (!byCustomer.has(key)) byCustomer.set(key, []);
    byCustomer.get(key).push(t);
  }

  // Customers who had activity yesterday, keyed by id.
  const activeCustomerIds = [...new Set(yesterdaysTransactions.map((t) => String(t.customerId)))];
  const customers = await Customers.find({ _id: { $in: activeCustomerIds } });
  const customerById = new Map(customers.map((c) => [String(c._id), c]));

  const pending = [];
  const completed = [];

  for (const customerId of activeCustomerIds) {
    const customer = customerById.get(customerId);
    if (!customer) continue;

    const balance = udhaarService.computeBalance(byCustomer.get(customerId) || []);
    // Net amount that moved yesterday for this customer (credit - payment), for the "completed" row.
    const yesterdaysForCustomer = yesterdaysTransactions.filter((t) => String(t.customerId) === customerId);
    const netYesterday = yesterdaysForCustomer.reduce(
      (sum, t) => sum + (t.type === 'credit' ? t.amount : -t.amount),
      0
    );

    if (balance > 0) {
      pending.push({ name: customer.name, balance });
    } else {
      completed.push({ name: customer.name, amount: Math.abs(netYesterday) });
    }
  }

  const admins = await User.find({ tenantId, role: 'admin' });
  const recipients = admins.filter((a) => a.email);
  if (!recipients.length) {
    return { skipped: true, reason: 'No admin email on file' };
  }

  const dateLabel = start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const results = [];
  for (const admin of recipients) {
    const result = await emailService.sendEmail(
      admin.email,
      `Saarthi.ai daily digest - ${dateLabel}`,
      `Yesterday's (${dateLabel}) udhaar summary for ${shopName}:\n\n` +
        `Still pending (${pending.length}):\n` +
        (pending.map((c) => `- ${c.name}: Rs ${c.balance}`).join('\n') || 'None') +
        `\n\nCleared yesterday (${completed.length}):\n` +
        (completed.map((c) => `- ${c.name}: Rs ${c.amount}`).join('\n') || 'None'),
      { type: 'digest', shopName, dateLabel, pending, completed }
    );
    results.push({ adminEmail: admin.email, ...result });
  }

  return { pendingCount: pending.length, completedCount: completed.length, results };
}

module.exports = { sendDailyReminders, sendAdminDailyDigest };