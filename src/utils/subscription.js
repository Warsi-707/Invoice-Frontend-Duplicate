/**
 * Subscription and Recurring Billing Helpers
 */

export const BILLING_CYCLES = [
  { value: 'monthly', label: 'Monthly', months: 1, desc: 'Every month' },
  { value: 'quarterly', label: 'Quarterly', months: 3, desc: 'Every 3 months' },
  { value: 'yearly', label: 'Yearly', months: 12, desc: 'Every 12 months' }
];

export const DELIVERY_METHODS = [
  { value: 'whatsapp', label: 'WhatsApp Only' },
  { value: 'download', label: 'PDF Download Only' },
  { value: 'both', label: 'WhatsApp & PDF Download' }
];

/**
 * Add months to date string (YYYY-MM-DD)
 */
export function addMonthsToDate(dateStr, monthsToAdd = 1) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  
  const targetMonth = date.getMonth() + monthsToAdd;
  date.setMonth(targetMonth);
  
  if (date.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    date.setDate(0);
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate next due date from start date & cycle
 */
export function calculateNextDueDate(startDate, billingCycle = 'monthly', fromDate = null) {
  if (!startDate) return '';
  const cycleObj = BILLING_CYCLES.find(c => c.value === billingCycle);
  const months = cycleObj ? cycleObj.months : 1;

  let next = addMonthsToDate(startDate, months);
  
  if (fromDate) {
    while (next < fromDate) {
      next = addMonthsToDate(next, months);
    }
  }
  return next;
}

/**
 * Check if a subscription is due soon (within reminder days)
 */
export function isSubscriptionDueSoon(nextDueDate, reminderDays = 7) {
  if (!nextDueDate) return false;
  const today = new Date().toISOString().split('T')[0];
  const due = new Date(nextDueDate);
  const trigger = new Date(due);
  trigger.setDate(trigger.getDate() - Number(reminderDays || 7));
  const triggerStr = trigger.toISOString().split('T')[0];
  return today >= triggerStr && today <= nextDueDate;
}

/**
 * Calculate days remaining until next due date
 */
export function getDaysUntilDue(nextDueDate) {
  if (!nextDueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const [y, m, d] = nextDueDate.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const diffTime = due.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
