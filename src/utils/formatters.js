export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const YEARS = ['2024', '2025', '2026', '2027', '2028', '2029', '2030', '2031', '2032'];

export const today = () => new Date().toISOString().slice(0, 10);

export const uid = (prefix = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));

export const money = (amount, currency = 'PKR') => {
  const cur = currency || 'PKR';
  const num = Number(amount || 0);
  return `${cur} ${num.toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
};

export const validPhone = (phone, required = true) => {
  const val = String(phone || '').trim();
  if (!val && !required) return true;
  return /^\d{11}$/.test(val);
};

export const cleanPhoneInput = (val) => String(val || '').replace(/\D/g, '').slice(0, 11);
