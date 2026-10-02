import { today, money } from './formatters.js';

/**
 * Validate milestone totals against project total
 */
export function validateMilestonesTotal(projectTotal = 0, milestones = []) {
  const pTotal = Math.max(0, Number(projectTotal || 0));
  const totalAmount = milestones.reduce((sum, m) => sum + Number(m.amount || 0), 0);
  const totalPct = pTotal > 0 ? Math.round((totalAmount / pTotal) * 1000) / 10 : 0;
  const remaining = Math.max(0, pTotal - totalAmount);
  const isExceeded = totalAmount > pTotal;
  const excess = isExceeded ? totalAmount - pTotal : 0;

  return {
    projectTotal: pTotal,
    totalAmount,
    totalPct,
    remaining,
    isExceeded,
    excess,
    isComplete: Math.abs(pTotal - totalAmount) < 0.01 && pTotal > 0
  };
}

/**
 * Get live payment & status for a milestone by cross-referencing state invoices
 */
export function getMilestoneLiveMetrics(milestone = {}, clientInvoices = []) {
  const linkedInvoice = clientInvoices.find(
    (inv) =>
      (milestone.invoiceId && String(inv.id) === String(milestone.invoiceId)) ||
      (milestone.id && String(inv.milestoneId) === String(milestone.id))
  );

  const msAmount = Number(milestone.amount || 0);

  if (linkedInvoice) {
    const invPaid = Number(linkedInvoice.paid || 0);
    const invBalance = Number(linkedInvoice.balance || 0);
    let liveStatus = 'Invoiced';
    if (invPaid >= msAmount && msAmount > 0) {
      liveStatus = 'Paid';
    } else if (invPaid > 0) {
      liveStatus = 'Partially Paid';
    }

    return {
      hasInvoice: true,
      invoiceId: linkedInvoice.id,
      invoiceNo: linkedInvoice.invoiceNo || milestone.invoiceNo,
      status: liveStatus,
      paidAmount: invPaid,
      outstandingAmount: invBalance,
      invoice: linkedInvoice
    };
  }

  // If milestone was marked invoiced but invoice not found
  if (milestone.invoiceId || milestone.status === 'Invoiced' || milestone.status === 'Paid' || milestone.status === 'Partially Paid') {
    const paid = Number(milestone.paidAmount || 0);
    const bal = Math.max(0, msAmount - paid);
    return {
      hasInvoice: true,
      invoiceId: milestone.invoiceId || null,
      invoiceNo: milestone.invoiceNo || 'INV',
      status: milestone.status || (paid >= msAmount ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Invoiced'),
      paidAmount: paid,
      outstandingAmount: bal,
      invoice: null
    };
  }

  // Not invoiced yet
  return {
    hasInvoice: false,
    invoiceId: null,
    invoiceNo: null,
    status: milestone.status || 'Pending',
    paidAmount: 0,
    outstandingAmount: msAmount,
    invoice: null
  };
}

/**
 * Calculate the 6 required project / milestone summary metrics
 */
export function calculateProjectMilestoneSummary(projectItem = {}, clientInvoices = []) {
  const qty = Math.max(0, Number(projectItem.qty !== undefined ? projectItem.qty : 1));
  const price = Math.max(0, Number(projectItem.price || 0));
  const projectTotal = qty * price;
  const milestones = Array.isArray(projectItem.milestones) ? projectItem.milestones : [];
  const totalMilestones = milestones.length;

  let invoicedAmount = 0;
  let paidAmount = 0;
  let outstandingAmount = 0;

  milestones.forEach((ms) => {
    const metrics = getMilestoneLiveMetrics(ms, clientInvoices);
    if (metrics.hasInvoice) {
      invoicedAmount += Number(ms.amount || 0);
      paidAmount += metrics.paidAmount;
      outstandingAmount += metrics.outstandingAmount;
    }
  });

  const remainingUnbilledAmount = Math.max(0, projectTotal - invoicedAmount);

  return {
    projectTotal,
    totalMilestones,
    invoicedAmount,
    paidAmount,
    outstandingAmount,
    remainingUnbilledAmount
  };
}

/**
 * Create a new milestone object
 */
export function createNewMilestone(index = 1, projectTotal = 0, defaultAmount = 0) {
  const pTotal = Math.max(0, Number(projectTotal || 0));
  const amt = Math.max(0, Number(defaultAmount || 0));
  const pct = pTotal > 0 ? Math.round((amt / pTotal) * 1000) / 10 : 0;

  return {
    id: `ms-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: `Milestone ${index}`,
    startDate: today(),
    dueDate: today(),
    amountType: 'percentage',
    percentage: pct,
    amount: amt,
    status: 'Pending', // Pending | Ready to Invoice | Invoiced | Partially Paid | Paid
    invoiceId: null,
    invoiceNo: null,
    paidAmount: 0,
    outstandingAmount: amt,
    createdAt: new Date().toISOString()
  };
}
