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
 * Builds and sends the admin's daily morning digest: EVERY customer who
 * has at least one transaction ever, split into "pending" (balance > 0
 * right now) and "completed" (balance fully settled). Unlike the old
 * version, this always covers the whole customer book, not just
 * yesterday's movers - so the admin gets the full status list every
 * single day, even on days with zero new activity. Sent to every admin
 * user of the tenant who has an email.
 */
async function sendAdminDailyDigest(tenantId, { shopName }) {
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

  const pending = [];
  const completed = [];

  for (const customer of customers) {
    const custTransactions = byCustomer.get(String(customer._id)) || [];
    if (!custTransactions.length) continue; // never transacted - nothing to report yet

    const balance = udhaarService.computeBalance(custTransactions);
    if (balance > 0) {
      pending.push({ name: customer.name, balance });
    } else {
      completed.push({ name: customer.name });
    }
  }

  if (!pending.length && !completed.length) {
    return { skipped: true, reason: 'No udhaar customers with transactions yet' };
  }

  const admins = await User.find({ tenantId, role: 'admin' });
  const recipients = admins.filter((a) => a.email);
  if (!recipients.length) {
    return { skipped: true, reason: 'No admin email on file' };
  }

  const dateLabel = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const results = [];
  for (const admin of recipients) {
    const result = await emailService.sendEmail(
      admin.email,
      `Saarthi.ai daily digest - ${dateLabel}`,
      `Udhaar status as of ${dateLabel} for ${shopName}:\n\n` +
        `Pending (${pending.length}):\n` +
        (pending.map((c) => `- ${c.name}: Rs ${c.balance}`).join('\n') || 'None') +
        `\n\nFully cleared (${completed.length}):\n` +
        (completed.map((c) => `- ${c.name}`).join('\n') || 'None'),
      { type: 'digest', shopName, dateLabel, pending, completed }
    );
    results.push({ adminEmail: admin.email, ...result });
  }

  return { pendingCount: pending.length, completedCount: completed.length, results };
}

module.exports = { sendDailyReminders, sendAdminDailyDigest };