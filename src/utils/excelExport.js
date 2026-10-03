import * as XLSX from 'xlsx';

/**
 * Format a number as clean numeric or currency for Excel export
 */
function cleanNum(val) {
  const n = Number(val);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

/**
 * Export Complete Multi-Sheet Financial & Invoicing Report to Excel (.xlsx)
 */
export function exportFullReportToExcel({
  allPayments = [],
  paidInvoices = [],
  unpaidInvoices = [],
  allInvoices = [],
  summary = {},
  businessName = 'All Businesses',
  fromDate = '',
  toDate = '',
  currency = 'PKR'
}) {
  const wb = XLSX.utils.book_new();

  // ----------------------------------------------------
  // Sheet 1: Summary Overview
  // ----------------------------------------------------
  const summaryRows = [
    { 'Financial Report Summary': 'Generated On', 'Value': new Date().toLocaleString() },
    { 'Financial Report Summary': 'Business Filter', 'Value': businessName },
    { 'Financial Report Summary': 'From Date', 'Value': fromDate || 'Beginning' },
    { 'Financial Report Summary': 'To Date', 'Value': toDate || 'Present' },
    { 'Financial Report Summary': 'Currency', 'Value': currency },
    { 'Financial Report Summary': '', 'Value': '' },
    { 'Financial Report Summary': 'METRIC', 'Value': 'AMOUNT / COUNT' },
    { 'Financial Report Summary': 'Total Collection', 'Value': `${currency} ${cleanNum(summary.totalCollected).toLocaleString()}` },
    { 'Financial Report Summary': 'Cash Collected', 'Value': `${currency} ${cleanNum(summary.cashCollected).toLocaleString()}` },
    { 'Financial Report Summary': 'Online / Bank Collected', 'Value': `${currency} ${cleanNum(summary.onlineCollected).toLocaleString()}` },
    { 'Financial Report Summary': 'Total Outstanding Due', 'Value': `${currency} ${cleanNum(summary.totalOutstanding).toLocaleString()}` },
    { 'Financial Report Summary': 'Total Invoices', 'Value': allInvoices.length },
    { 'Financial Report Summary': 'Paid Invoices Count', 'Value': paidInvoices.length },
    { 'Financial Report Summary': 'Unpaid / Pending Invoices Count', 'Value': unpaidInvoices.length },
    { 'Financial Report Summary': 'Total Payment Receipts', 'Value': allPayments.length }
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 32 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary Overview');

  // ----------------------------------------------------
  // Sheet 2: Collected Payments / Receipts
  // ----------------------------------------------------
  const paymentsRows = allPayments.map((p, idx) => ({
    '#': idx + 1,
    'Payment Date': p.date || '-',
    'Invoice #': p.invoiceNo || '-',
    'Business': p.businessName || '-',
    'Client': p.customerName || '-',
    [`Amount (${currency})`]: cleanNum(p.amount),
    'Payment Method': p.method || 'Cash',
    'Received By': p.receivedBy || 'Admin'
  }));

  const wsPayments = XLSX.utils.json_to_sheet(
    paymentsRows.length > 0
      ? paymentsRows
      : [{ '#': '', 'Payment Date': 'No collection records found', 'Invoice #': '', 'Business': '', 'Client': '', [`Amount (${currency})`]: 0, 'Payment Method': '', 'Received By': '' }]
  );
  wsPayments['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 16 },
    { wch: 22 },
    { wch: 24 },
    { wch: 16 },
    { wch: 32 },
    { wch: 16 }
  ];
  XLSX.utils.book_append_sheet(wb, wsPayments, 'Collected Payments');

  // ----------------------------------------------------
  // Sheet 3: Paid Invoices
  // ----------------------------------------------------
  const paidRows = paidInvoices.map((inv, idx) => ({
    '#': idx + 1,
    'Invoice #': inv.invoiceNo || '-',
    'Business': inv.businessName || '-',
    'Client': inv.customerName || '-',
    'Invoice Date': inv.date || '-',
    [`Total (${currency})`]: cleanNum(inv.total),
    [`Collected (${currency})`]: cleanNum(inv.paid),
    [`Balance (${currency})`]: 0,
    'Status': 'Paid'
  }));

  const wsPaid = XLSX.utils.json_to_sheet(
    paidRows.length > 0
      ? paidRows
      : [{ '#': '', 'Invoice #': 'No paid invoices found', 'Business': '', 'Client': '', 'Invoice Date': '', [`Total (${currency})`]: 0, [`Collected (${currency})`]: 0, [`Balance (${currency})`]: 0, 'Status': '' }]
  );
  wsPaid['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 22 },
    { wch: 24 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 }
  ];
  XLSX.utils.book_append_sheet(wb, wsPaid, 'Paid Invoices');

  // ----------------------------------------------------
  // Sheet 4: Unpaid & Partial Invoices
  // ----------------------------------------------------
  const unpaidRows = unpaidInvoices.map((inv, idx) => ({
    '#': idx + 1,
    'Invoice #': inv.invoiceNo || '-',
    'Business': inv.businessName || '-',
    'Client': inv.customerName || '-',
    'Invoice Date': inv.date || '-',
    [`Total (${currency})`]: cleanNum(inv.total),
    [`Collected (${currency})`]: cleanNum(inv.paid),
    [`Outstanding (${currency})`]: cleanNum(inv.balance),
    'Status': inv.status || 'Unpaid'
  }));

  const wsUnpaid = XLSX.utils.json_to_sheet(
    unpaidRows.length > 0
      ? unpaidRows
      : [{ '#': '', 'Invoice #': 'No unpaid invoices found', 'Business': '', 'Client': '', 'Invoice Date': '', [`Total (${currency})`]: 0, [`Collected (${currency})`]: 0, [`Outstanding (${currency})`]: 0, 'Status': '' }]
  );
  wsUnpaid['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 22 },
    { wch: 24 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 }
  ];
  XLSX.utils.book_append_sheet(wb, wsUnpaid, 'Unpaid Invoices');

  // Download filename
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeBiz = businessName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Financial_Report_${safeBiz}_${dateStr}.xlsx`;

  XLSX.writeFile(wb, filename);
}

/**
 * Export a single active section to Excel (.xlsx)
 */
export function exportSingleSectionToExcel({
  section = 'collected', // 'collected' | 'paid' | 'unpaid' | 'all'
  rows = [],
  currency = 'PKR',
  businessName = 'All Businesses'
}) {
  const wb = XLSX.utils.book_new();
  const dateStr = new Date().toISOString().slice(0, 10);
  let sheetName = 'Report';
  let filePrefix = 'Report';

  let formattedRows = [];
  let colWidths = [];

  if (section === 'collected') {
    sheetName = 'Collected Payments';
    filePrefix = 'Collected_Payments';
    formattedRows = rows.map((p, idx) => ({
      '#': idx + 1,
      'Payment Date': p.date || '-',
      'Invoice #': p.invoiceNo || '-',
      'Business': p.businessName || '-',
      'Client': p.customerName || '-',
      [`Amount (${currency})`]: cleanNum(p.amount),
      'Payment Method / Reference': p.method || 'Cash',
      'Received By': p.receivedBy || 'Admin'
    }));
    colWidths = [{ wch: 6 }, { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 24 }, { wch: 16 }, { wch: 34 }, { wch: 16 }];
  } else if (section === 'paid') {
    sheetName = 'Paid Invoices';
    filePrefix = 'Paid_Invoices';
    formattedRows = rows.map((inv, idx) => ({
      '#': idx + 1,
      'Invoice #': inv.invoiceNo || '-',
      'Business': inv.businessName || '-',
      'Client': inv.customerName || '-',
      'Date': inv.date || '-',
      [`Total (${currency})`]: cleanNum(inv.total),
      [`Collected (${currency})`]: cleanNum(inv.paid),
      [`Balance (${currency})`]: 0,
      'Status': 'Paid'
    }));
    colWidths = [{ wch: 6 }, { wch: 16 }, { wch: 22 }, { wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 12 }];
  } else if (section === 'unpaid') {
    sheetName = 'Unpaid Invoices';
    filePrefix = 'Unpaid_Invoices';
    formattedRows = rows.map((inv, idx) => ({
      '#': idx + 1,
      'Invoice #': inv.invoiceNo || '-',
      'Business': inv.businessName || '-',
      'Client': inv.customerName || '-',
      'Date': inv.date || '-',
      [`Total (${currency})`]: cleanNum(inv.total),
      [`Collected (${currency})`]: cleanNum(inv.paid),
      [`Outstanding (${currency})`]: cleanNum(inv.balance),
      'Status': inv.status || 'Unpaid'
    }));
    colWidths = [{ wch: 6 }, { wch: 16 }, { wch: 22 }, { wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];
  } else {
    sheetName = 'All Invoices';
    filePrefix = 'All_Invoices';
    formattedRows = rows.map((inv, idx) => ({
      '#': idx + 1,
      'Invoice #': inv.invoiceNo || '-',
      'Business': inv.businessName || '-',
      'Client': inv.customerName || '-',
      'Date': inv.date || '-',
      [`Total (${currency})`]: cleanNum(inv.total),
      [`Collected (${currency})`]: cleanNum(inv.paid),
      [`Outstanding (${currency})`]: cleanNum(inv.balance),
      'Status': inv.status || 'Unpaid'
    }));
    colWidths = [{ wch: 6 }, { wch: 16 }, { wch: 22 }, { wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];
  }

  const ws = XLSX.utils.json_to_sheet(formattedRows.length > 0 ? formattedRows : [{ '#': '', Info: 'No records found' }]);
  if (colWidths.length > 0) {
    ws['!cols'] = colWidths;
  }
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const safeBiz = businessName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${filePrefix}_${safeBiz}_${dateStr}.xlsx`;
  XLSX.writeFile(wb, filename);
}
