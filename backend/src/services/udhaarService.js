/**
 * All udhaar (credit) math lives here as plain JS. A customer's
 * balance is NEVER stored - it is always derived fresh from their
 * transaction rows, so it can't drift. Gemini is only ever handed the
 * already-computed balance number to phrase a reminder message with
 * (see geminiService.generateUdhaarReminder) - it never computes it.
 */

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * balance > 0  -> customer owes the shop this much
 * balance <= 0 -> settled (0) - a customer can't go negative in the UI,
 * but we don't clamp here so overpayment is still visible if it happens.
 */
function computeBalance(transactions) {
  return round2(
    transactions.reduce((sum, t) => sum + (t.type === 'credit' ? t.amount : -t.amount), 0)
  );
}

function serializeCustomer(customer, transactions) {
  const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  const totalCredit = round2(
    transactions.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0)
  );
  const totalPaid = round2(
    transactions.filter((t) => t.type === 'payment').reduce((s, t) => s + t.amount, 0)
  );

  return {
    _id: customer._id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    note: customer.note,
    balance: computeBalance(transactions),
    totalCredit,
    totalPaid,
    lastTransactionAt: sorted.length ? sorted[0].date : null,
    transactionCount: transactions.length,
    createdAt: customer.createdAt,
  };
}

/**
 * Deterministic summary used for the sidebar badge (count of customers
 * who currently owe something) and total outstanding across the shop.
 */
function summarize(serializedCustomers) {
  const owing = serializedCustomers.filter((c) => c.balance > 0);
  const totalOutstanding = round2(owing.reduce((s, c) => s + c.balance, 0));
  return {
    customersOwingCount: owing.length,
    badgeCount: owing.length,
    totalOutstanding,
  };
}

module.exports = { computeBalance, serializeCustomer, summarize };
