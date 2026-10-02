import { money, esc, today, MONTHS } from './formatters.js';
import { downloadAsPdf, sendPdfToWhatsApp, downloadAndSendWhatsApp } from './whatsappPdf.js';

/**
 * Build and calculate complete chronological ledger transactions and financial metrics for a customer.
 */
export function calculateClientLedger(customer = {}, business = {}, invoices = [], options = {}) {
  const {
    fromDate = '',
    toDate = '',
    selectedMonth = 'all',
    selectedYear = 'all',
    transactionType = 'all',
    searchQuery = ''
  } = options;
  const cur = business?.currency || 'PKR';

  // Filter invoices for this customer
  const custInvoices = invoices.filter(
    (i) => String(i.customerId) === String(customer.id)
  );

  // Sort invoices chronologically by billing year, month, and invoice sequence
  const getInvoicePeriodOrder = (inv) => {
    const y = Number(inv.year || (inv.date ? new Date(inv.date).getFullYear() : 2026));
    const mIdx = MONTHS.indexOf(inv.month);
    const m = mIdx >= 0 ? mIdx : 0;
    const seq = parseInt(String(inv.invoiceNo || '').replace(/\D/g, ''), 10) || 0;
    return y * 1000000 + m * 10000 + seq;
  };

  const sortedInvoices = [...custInvoices].sort((a, b) => {
    const periodA = getInvoicePeriodOrder(a);
    const periodB = getInvoicePeriodOrder(b);
    if (periodA !== periodB) return periodA - periodB;
    const timeA = new Date(a.date || a.createdAt || 0).getTime();
    const timeB = new Date(b.date || b.createdAt || 0).getTime();
    return timeA - timeB;
  });

  // 1. Build all raw chronological transactions per invoice
  const allTransactions = [];

  sortedInvoices.forEach((inv, invIndex) => {
    const invDebit = Number(inv.subtotal || inv.total || 0);
    const invPaid = Number(
      inv.paid !== undefined
        ? inv.paid
        : Array.isArray(inv.payments)
        ? inv.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
        : 0
    );
    const invDate = inv.date || (inv.createdAt ? new Date(inv.createdAt).toISOString().slice(0, 10) : today());
    const invItemsSummary = Array.isArray(inv.items) && inv.items.length > 0
      ? inv.items.map((it) => it.name || it.description).filter(Boolean).join(', ')
      : `Monthly Fee - ${inv.month || ''} ${inv.year || ''}`.trim();
    const periodOrder = getInvoicePeriodOrder(inv);

    const paymentMethods = Array.isArray(inv.payments) && inv.payments.length > 0
      ? inv.payments.map((p) => p.method || 'Cash').filter(Boolean).join(', ')
      : (invPaid > 0 ? 'Cash' : '-');

    allTransactions.push({
      id: `txn-inv-${inv.id}`,
      rawInvoice: inv,
      date: invDate,
      time: '09:00:00 AM',
      periodOrder,
      invIndex,
      timestamp: new Date(invDate).getTime() || 0,
      type: 'invoice',
      typeLabel: inv.milestoneId ? 'Milestone Invoice' : 'Monthly Invoice',
      ref: inv.invoiceNo || 'INV',
      description: invItemsSummary || (inv.milestoneId ? 'Milestone Project Billing' : `Monthly Billing (${inv.month} ${inv.year})`),
      monthYear: inv.month && inv.year ? `${inv.month} ${inv.year}` : (inv.month || '-'),
      debit: invDebit,
      credit: invPaid,
      status: inv.status || (invPaid >= invDebit ? 'Paid' : invPaid > 0 ? 'Partial' : 'Unpaid'),
      method: paymentMethods,
      payments: inv.payments || []
    });
  });

  // Calculate global summary (all-time)
  const globalTotalInvoiced = allTransactions.reduce((sum, t) => sum + t.debit, 0);
  const globalTotalPaid = allTransactions.reduce((sum, t) => sum + t.credit, 0);

  const globalNetBalance = globalTotalInvoiced - globalTotalPaid;
  const globalOutstanding = Math.max(0, globalNetBalance);
  const globalAdvance = globalNetBalance < 0 ? Math.abs(globalNetBalance) : 0;

  // Calculate opening balance if fromDate is active
  let openingBalance = 0;
  let preRangeDebits = 0;
  let preRangeCredits = 0;

  if (fromDate) {
    allTransactions.forEach((t) => {
      if (t.date < fromDate) {
        preRangeDebits += t.debit;
        preRangeCredits += t.credit;
      }
    });
    openingBalance = preRangeDebits - preRangeCredits;
  }

  // Filter transactions by month, year, and date range
  let filtered = allTransactions.filter((t) => {
    // Filter by specific Month
    if (selectedMonth && selectedMonth !== 'all') {
      const invMonth = t.rawInvoice?.month || '';
      const matchesMonth = invMonth === selectedMonth || t.monthYear.toLowerCase().includes(selectedMonth.toLowerCase());
      if (!matchesMonth) return false;
    }

    // Filter by specific Year
    if (selectedYear && selectedYear !== 'all') {
      const invYear = String(t.rawInvoice?.year || (t.date ? new Date(t.date).getFullYear() : ''));
      const matchesYear = invYear === String(selectedYear) || t.monthYear.includes(String(selectedYear));
      if (!matchesYear) return false;
    }

    const matchesFrom = !fromDate || t.date >= fromDate;
    const matchesTo = !toDate || t.date <= toDate;
    return matchesFrom && matchesTo;
  });

  // Filter by transaction type
  if (transactionType === 'invoices') {
    filtered = filtered.filter((t) => t.type === 'invoice');
  } else if (transactionType === 'payments') {
    filtered = filtered.filter((t) => t.type === 'payment');
  }

  // Filter by search query
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter((t) =>
      t.ref.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.typeLabel.toLowerCase().includes(q) ||
      t.method.toLowerCase().includes(q) ||
      t.monthYear.toLowerCase().includes(q)
    );
  }

  // Calculate running balance and individual invoice balance
  let currentBalance = openingBalance;
  const ledgerRows = filtered.map((t) => {
    const itemBalance = t.debit - t.credit;
    currentBalance = currentBalance + itemBalance;
    return {
      ...t,
      balance: itemBalance,
      runningBalance: currentBalance
    };
  });

  const periodInvoiced = filtered.filter((t) => t.type === 'invoice').reduce((sum, t) => sum + t.debit, 0);
  const periodPaid = filtered.filter((t) => t.type === 'payment').reduce((sum, t) => sum + t.credit, 0);
  const closingBalance = currentBalance;

  return {
    customer,
    business,
    currency: cur,
    invoicesCount: custInvoices.length,
    totalInvoiced: globalTotalInvoiced,
    totalPaid: globalTotalPaid,
    netBalance: globalNetBalance,
    outstandingBalance: globalOutstanding,
    advanceCredit: globalAdvance,
    periodInvoiced,
    periodPaid,
    openingBalance,
    closingBalance,
    ledgerRows,
    totalTransactionsCount: allTransactions.length,
    filteredTransactionsCount: ledgerRows.length
  };
}

/**
 * Generate formatted HTML Statement Document for Print & PDF
 */
export function generateLedgerStatementHtml(customer = {}, business = {}, invoices = [], options = {}) {
  const ledger = calculateClientLedger(customer, business, invoices, options);
  const p = business?.proposalData || {};
  const cur = ledger.currency;

  const orgName = p.companyName || business.name || 'iSysware Software Solution';
  const orgAddress = p.officeAddress || business.address || '';
  const orgContact = [p.supportPhone || business.phone, p.inquiryEmail || business.email, p.websiteUrl].filter(Boolean).join(' • ');

  const fromLabel = options.fromDate || 'Start';
  const toLabel = options.toDate || today();
  const periodText = options.fromDate || options.toDate ? `${fromLabel} to ${toLabel}` : 'All Time History';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Statement - ${esc(customer.name || 'Client')}</title>
  <style>
    @page { margin: 8mm; size: A4 portrait; }
    * { box-sizing: border-box; }
    html, body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      background: #ffffff !important;
      padding: 0 !important;
      margin: 0 !important;
      color: #172033;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .statement-container {
      width: 750px !important;
      max-width: 750px !important;
      margin: 0 !important;
      padding: 24px 28px !important;
      background: #ffffff !important;
      border: 1.5px solid #cbd5e1 !important;
      border-radius: 10px !important;
      box-sizing: border-box !important;
      position: relative;
    }
    .st-head {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      padding-bottom: 14px;
      border-bottom: 2px solid #0b4b8f;
    }
    .st-brand {
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }
    .st-logo {
      width: 52px;
      height: 52px;
      border: 1px solid #d6deea;
      border-radius: 8px;
      display: grid;
      place-items: center;
      overflow: hidden;
      font-weight: 800;
      color: #0b4b8f;
      background: #f8fafc;
    }
    .st-logo img { width: 100%; height: 100%; object-fit: contain; }
    .st-brand h2 { margin: 0 0 2px; font-size: 19px; font-weight: 850; color: #0b4b8f; }
    .st-brand p { margin: 2px 0; color: #64748b; font-size: 10.5px; }
    
    .st-meta { text-align: right; }
    .st-meta h1 { margin: 0 0 3px; font-size: 21px; font-weight: 900; color: #0b4b8f; letter-spacing: 0.5px; }
    .st-meta div { font-size: 11px; margin: 2px 0; color: #475569; }

    .st-info-grid {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 14px;
      margin: 14px 0;
      padding: 10px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
    }
    .st-info-grid h4 {
      margin: 0 0 4px;
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      color: #0b4b8f;
      letter-spacing: 0.5px;
    }
    .st-info-grid p { margin: 2px 0; font-size: 11px; color: #1e293b; }

    .st-kpis {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin: 14px 0;
    }
    .st-kpi-card {
      padding: 9px 10px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      text-align: center;
    }
    .st-kpi-card.billed { background: #eff6ff; border-color: #bfdbfe; }
    .st-kpi-card.paid { background: #f0fdf4; border-color: #bbf7d0; }
    .st-kpi-card.due { background: #fef2f2; border-color: #fecaca; }
    .st-kpi-card.advance { background: #faf5ff; border-color: #e9d5ff; }
    .st-kpi-label { font-size: 9px; text-transform: uppercase; font-weight: 750; color: #64748b; margin-bottom: 2px; }
    .st-kpi-val { font-size: 13.5px; font-weight: 850; }
    .st-kpi-card.billed .st-kpi-val { color: #1d4ed8; }
    .st-kpi-card.paid .st-kpi-val { color: #15803d; }
    .st-kpi-card.due .st-kpi-val { color: #b91c1c; }
    .st-kpi-card.advance .st-kpi-val { color: #7e22ce; }

    table.st-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    .st-table th, .st-table td {
      font-size: 10px;
      padding: 6px 7px;
      border: 1px solid #e2e8f0;
      text-align: left;
    }
    .st-table th {
      background: #0b4b8f;
      color: #fff;
      font-weight: 750;
    }
    .st-table tr:nth-child(even) td { background: #f8fafc; }
    .st-table tr.pay-row td { background: #f0fdf4; }
    .st-table tr.opening-row td { background: #fef9c3; font-weight: 700; color: #854d0e; }

    .sigs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 50px;
      margin-top: 32px;
    }
    .sig {
      text-align: center;
      border-top: 1px solid #94a3b8;
      padding-top: 5px;
      font-size: 9.5px;
      color: #64748b;
    }

    .st-footer {
      text-align: center;
      margin-top: 20px;
      padding-top: 8px;
      border-top: 1px solid #f1f5f9;
      font-size: 9px;
      color: #94a3b8;
    }

    @media print {
      body { background: #fff !important; padding: 0 !important; }
      .statement-container {
        border: 1.5px solid #cbd5e1 !important;
        border-radius: 10px !important;
        width: 100% !important;
        max-width: 100% !important;
        box-shadow: none !important;
      }
      @page { size: A4; margin: 8mm; }
    }
  </style>
</head>
<body>
  <div class="statement-container">
    <div class="st-head">
      <div class="st-brand">
        <div class="st-logo">${business.logo ? `<img src="${business.logo}" alt="Logo">` : 'LOGO'}</div>
        <div>
          <h2>${esc(orgName)}</h2>
          ${orgAddress ? `<p>${esc(orgAddress)}</p>` : ''}
          ${orgContact ? `<p>${esc(orgContact)}</p>` : ''}
          ${p.ntnTax ? `<p>NTN/Tax: ${esc(p.ntnTax)}</p>` : ''}
        </div>
      </div>
      <div class="st-meta">
        <h1>CLIENT LEDGER</h1>
        <div>Statement Date: <strong>${today()}</strong></div>
        <div>Period: <strong>${esc(periodText)}</strong></div>
        <div>Total Records: <strong>${ledger.filteredTransactionsCount}</strong></div>
      </div>
    </div>

    <div class="st-info-grid">
      <div>
        <h4>Client Details:</h4>
        <p><strong>${esc(customer.name || 'Client')}</strong></p>
        ${(customer.company || business.name) ? `<p>Organization: ${esc(customer.company || business.name)}</p>` : ''}
        ${customer.phone ? `<p>Phone: ${esc(customer.phone)}</p>` : ''}
        ${customer.whatsapp && customer.whatsapp !== customer.phone ? `<p>WhatsApp: ${esc(customer.whatsapp)}</p>` : ''}
        ${customer.address ? `<p>Address: ${esc(customer.address)}</p>` : ''}
      </div>
      <div>
        <h4>Account Status:</h4>
        <p>Total Invoices: <strong>${ledger.invoicesCount}</strong></p>
        <p>Net Balance Status: <strong>${
          ledger.outstandingBalance > 0
            ? `⚠️ Outstanding Dues (${money(ledger.outstandingBalance, cur)})`
            : ledger.advanceCredit > 0
            ? `💎 Advance Credit (${money(ledger.advanceCredit, cur)})`
            : '✅ Up to Date (Settled)'
        }</strong></p>
      </div>
    </div>

    <div class="st-kpis">
      <div class="st-kpi-card billed">
        <div class="st-kpi-label">Total Invoiced</div>
        <div class="st-kpi-val">${money(ledger.totalInvoiced, cur)}</div>
      </div>
      <div class="st-kpi-card paid">
        <div class="st-kpi-label">Total Paid</div>
        <div class="st-kpi-val">${money(ledger.totalPaid, cur)}</div>
      </div>
      <div class="st-kpi-card due">
        <div class="st-kpi-label">Outstanding Balance</div>
        <div class="st-kpi-val">${money(ledger.outstandingBalance, cur)}</div>
      </div>
      <div class="st-kpi-card advance">
        <div class="st-kpi-label">Advance / Credit</div>
        <div class="st-kpi-val">${money(ledger.advanceCredit, cur)}</div>
      </div>
    </div>

    <table class="st-table">
      <thead>
        <tr>
          <th style="width: 12%;">Date</th>
          <th style="width: 14%;">Reference #</th>
          <th style="width: 16%;">Type</th>
          <th style="width: 26%;">Description / Details</th>
          <th style="width: 11%; text-align: right;">Debit (+)</th>
          <th style="width: 11%; text-align: right;">Credit (-)</th>
          <th style="width: 10%; text-align: right;">Balance</th>
        </tr>
      </thead>
      <tbody>
        ${options.fromDate ? `
          <tr class="opening-row">
            <td>${esc(options.fromDate)}</td>
            <td><strong>B/F</strong></td>
            <td>Opening Balance</td>
            <td>Balance brought forward prior to ${esc(options.fromDate)}</td>
            <td style="text-align: right;">${ledger.openingBalance > 0 ? money(ledger.openingBalance, cur) : '-'}</td>
            <td style="text-align: right;">${ledger.openingBalance < 0 ? money(Math.abs(ledger.openingBalance), cur) : '-'}</td>
            <td style="text-align: right; font-weight: 800;">${money(ledger.openingBalance, cur)}</td>
          </tr>
        ` : ''}

        ${ledger.ledgerRows.length > 0 ? ledger.ledgerRows.map((r) => `
          <tr class="${r.type === 'payment' ? 'pay-row' : ''}">
            <td>${esc(r.date)}</td>
            <td><strong>${esc(r.ref)}</strong></td>
            <td>${esc(r.typeLabel)}</td>
            <td>${esc(r.description)}</td>
            <td style="text-align: right;">${r.debit > 0 ? money(r.debit, cur) : '-'}</td>
            <td style="text-align: right; color: #16a34a; font-weight: ${r.credit > 0 ? '700' : 'normal'}">${r.credit > 0 ? money(r.credit, cur) : '-'}</td>
            <td style="text-align: right; font-weight: 750; color: ${r.runningBalance > 0 ? '#b91c1c' : r.runningBalance < 0 ? '#7e22ce' : '#16a34a'}">
              ${money(r.runningBalance, cur)}
            </td>
          </tr>
        `).join('') : `
          <tr>
            <td colSpan="7" style="text-align: center; padding: 18px; color: #64748b;">
              No transactions found for the selected period.
            </td>
          </tr>
        `}
      </tbody>
      <tfoot>
        <tr style="background: #f1f5f9; font-weight: 800;">
          <td colSpan="4" style="text-align: right;">Total / Closing Balance:</td>
          <td style="text-align: right;">${money(ledger.totalInvoiced, cur)}</td>
          <td style="text-align: right; color: #16a34a;">${money(ledger.totalPaid, cur)}</td>
          <td style="text-align: right; color: ${ledger.closingBalance > 0 ? '#b91c1c' : '#16a34a'}">${money(ledger.closingBalance, cur)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="sigs">
      <div class="sig">Client Signature & Stamp</div>
      <div class="sig">Authorized Accountant Signature</div>
    </div>

    <div class="st-footer">
      Generated automatically by ${esc(orgName)} Billing & Accounting Management • System Record
    </div>
  </div>
</body>
</html>`;
}

/**
 * 📊 Export client ledger as clean, formatted Excel spreadsheet (.xls / .csv)
 */
export function exportLedgerToExcel(customer = {}, business = {}, invoices = [], options = {}) {
  const ledger = calculateClientLedger(customer, business, invoices, options);
  const cur = ledger.currency;
  const clientName = customer?.name || 'Client';
  const orgName = business?.name || 'Company';

  // Build CSV content with UTF-8 BOM for perfect Excel compatibility
  const rows = [];

  rows.push([`CLIENT ACCOUNT LEDGER & STATEMENT`]);
  rows.push([`Organization:`, orgName]);
  rows.push([`Client Name:`, clientName]);
  rows.push([`Phone / WhatsApp:`, customer.phone || customer.whatsapp || '-']);
  rows.push([`Address:`, customer.address || '-']);
  rows.push([`Statement Date:`, today()]);
  rows.push([`Period:`, options.fromDate || options.toDate ? `${options.fromDate || 'Start'} to ${options.toDate || today()}` : 'All Time']);
  rows.push([]);
  rows.push([`FINANCIAL SUMMARY`]);
  rows.push([`Total Invoiced:`, ledger.totalInvoiced, cur]);
  rows.push([`Total Paid / Received:`, ledger.totalPaid, cur]);
  rows.push([`Outstanding Balance:`, ledger.outstandingBalance, cur]);
  rows.push([`Advance / Credit:`, ledger.advanceCredit, cur]);
  rows.push([`Total Invoices Count:`, ledger.invoicesCount]);
  rows.push([]);
  rows.push([`TRANSACTION HISTORY`]);
  rows.push([`Date`, `Reference No`, `Transaction Type`, `Description / Details`, `Debit (+)`, `Credit (-)`, `Running Balance`, `Status`]);

  if (options.fromDate) {
    rows.push([
      options.fromDate,
      'B/F',
      'Opening Balance',
      `Balance prior to ${options.fromDate}`,
      ledger.openingBalance > 0 ? ledger.openingBalance : 0,
      ledger.openingBalance < 0 ? Math.abs(ledger.openingBalance) : 0,
      ledger.openingBalance,
      'Opening'
    ]);
  }

  ledger.ledgerRows.forEach((r) => {
    rows.push([
      r.date,
      r.ref,
      r.typeLabel,
      r.description,
      r.debit,
      r.credit,
      r.runningBalance,
      r.status
    ]);
  });

  rows.push([]);
  rows.push([`TOTALS:`, ``, ``, ``, ledger.totalInvoiced, ledger.totalPaid, ledger.closingBalance, ``]);

  // Convert array of rows to CSV string
  const csvContent = '\uFEFF' + rows.map((e) =>
    e.map((cell) => {
      const cellStr = String(cell ?? '');
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(',')
  ).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const cleanName = (clientName || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Ledger_${cleanName}_${today()}.csv`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 500);

  return { success: true, fileName };
}

/**
 * 🖨️ Direct In-Browser Print Helper
 */
export function printLedgerStatement(htmlContent) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(htmlContent);
  doc.close();

  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => {
      iframe.remove();
    }, 1000);
  }, 400);
}
