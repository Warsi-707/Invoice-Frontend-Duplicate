import { money, esc } from './formatters.js';

const DEFAULT_TERMS = `1. Validity: This commercial quotation is valid for 15 calendar days from the date of issuance.
2. Payment Terms: 40% advance milestone on contract signing, 30% on beta milestone preview, and 30% upon final delivery & handover.
3. Taxes: Quoted prices are in Pakistani Rupees (PKR) and exclusive of applicable provincial sales tax (GST/PST) unless explicitly itemized.
4. Support & Warranty: 3 months of complimentary technical bug-fixing and cloud maintenance support is included post-launch.
5. Intellectual Property: Complete source code ownership and database rights will be transferred upon settlement of final invoice.`;

export function generateProposalHtml(proposal = {}, business = {}, customer = {}) {
  const cur = business.currency || 'PKR';
  const items = proposal.items || [];
  const subtotal = items.reduce((sum, item) => sum + (Number(item.qty || 1) * Number(item.price || 0)), 0);
  const totalDiscount = items.reduce((sum, item) => sum + Number(item.discount || 0), 0) || Number(proposal.discount || 0);
  const totalTaxAmount = items.reduce((sum, item) => {
    const gross = Number(item.qty || 1) * Number(item.price || 0);
    const taxBase = Math.max(0, gross - Number(item.discount || 0));
    return sum + (taxBase * Number(item.taxPct || 0)) / 100;
  }, 0) || (((subtotal - totalDiscount) * Number(proposal.taxPct || 0)) / 100);
  const grandTotal = Math.max(0, subtotal - totalDiscount + totalTaxAmount);

  const bizName = proposal.companyName || business.name || business.companyName || 'iSysware Software Solution';
  const clientName = customer.name || proposal.clientName || 'Valued Client';
  const clientCompany = customer.company || proposal.clientCompany || '';
  const proposalNo = proposal.proposalNo || `PROP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;
  const proposalDate = proposal.date || new Date().toISOString().split('T')[0];
  const validity = proposal.validity || `${proposal.validityDays || 15} Days from issuance`;
  const summaryText = proposal.summary || `We are pleased to submit this commercial proposal for ${clientName}. Our team is committed to providing industry-leading services, robust software solutions, and high-quality deliverables tailored specifically to your operational requirements.`;
  const termsText = proposal.terms || business.proposalData?.terms || DEFAULT_TERMS;
  const sigName = proposal.signatoryName || business.signatoryName || business.proposalData?.signatoryName || 'Authorized Signature';
  const sigTitle = proposal.signatoryTitle || business.signatoryTitle || business.proposalData?.signatoryTitle || 'Management Representative';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${esc(proposal.title || 'Commercial Proposal')} - ${esc(proposalNo)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm;
    }
    * { box-sizing: border-box; }
    html, body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      background: #ffffff !important;
      margin: 0 !important;
      padding: 0 !important;
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .a4-page {
      width: 750px !important;
      max-width: 750px !important;
      margin: 0 !important;
      background: #ffffff !important;
      border: 1.5px solid #cbd5e1 !important;
      border-radius: 10px !important;
      padding: 26px 30px !important;
      box-sizing: border-box !important;
      color: #0f172a;
    }
    .prop-top-content {
      width: 100%;
    }
    .prop-head {
      border-bottom: 2px solid #0b4b8f;
      padding-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
    }
    .prop-brand h2 {
      margin: 0 0 3px;
      font-size: 20px;
      font-weight: 800;
      color: #0b4b8f;
    }
    .prop-tagline {
      font-size: 11px;
      font-weight: 600;
      color: #0284c7;
      margin-bottom: 4px;
    }
    .prop-brand p {
      margin: 2px 0;
      font-size: 11px;
      color: #475569;
    }
    .prop-tax-badge {
      display: inline-block;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      color: #334155;
      margin-top: 4px;
    }
    .prop-meta {
      text-align: right;
      font-size: 11px;
    }
    .prop-meta div {
      margin: 2px 0;
      color: #475569;
    }
    .prop-meta strong {
      color: #0f172a;
    }
    .prop-meta .prop-badge, .prop-badge {
      background: #0b4b8f !important;
      color: #ffffff !important;
      font-size: 11px !important;
      font-weight: 800 !important;
      padding: 4px 10px !important;
      border-radius: 4px !important;
      display: inline-block !important;
      text-transform: uppercase !important;
      margin-bottom: 8px !important;
      letter-spacing: 0.5px !important;
    }
    .prop-client-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin: 14px 0 16px;
      padding: 12px 14px;
      background: #f8fbff;
      border: 1px solid #dbeafe;
      border-radius: 8px;
      box-sizing: border-box;
    }
    .prop-client-card h4 {
      margin: 0 0 4px;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 800;
      color: #0284c7;
    }
    .prop-client-card p {
      margin: 2px 0;
      font-size: 11.5px;
      color: #1e293b;
    }
    .prop-section {
      margin-top: 14px;
      width: 100%;
      box-sizing: border-box;
    }
    .prop-section-title {
      font-size: 12px;
      font-weight: 800;
      color: #0b4b8f;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
    }
    .prop-overview-text {
      font-size: 11px;
      line-height: 1.5;
      color: #334155;
      white-space: pre-line;
    }
    .prop-table {
      width: 100% !important;
      min-width: 0 !important;
      table-layout: fixed;
      border-collapse: collapse;
      margin-top: 6px;
      box-sizing: border-box;
    }
    .prop-table th {
      background: #eff6ff;
      color: #1e3a8a;
      font-size: 10.5px;
      font-weight: 750;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      text-align: left;
      box-sizing: border-box;
    }
    .prop-table td {
      padding: 6px 8px;
      font-size: 11px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
      word-break: break-word;
      box-sizing: border-box;
    }
    .prop-terms-box {
      padding: 8px 12px;
      background: #f8fafc;
      border-left: 3px solid #0b4b8f;
      font-size: 10.5px;
      line-height: 1.55;
      color: #334155;
      white-space: pre-line !important;
    }
    .prop-sigs {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 80px !important;
      margin-top: 32px !important;
      padding-top: 4px !important;
    }
    .prop-sig-line {
      text-align: center;
      border-top: 1px solid #9aa6b6;
      padding-top: 6px;
      font-size: 10px;
      color: #64748b;
    }
    @media print {
      body {
        background: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .a4-page {
        width: 100% !important;
        max-width: 100% !important;
        border: 1.5px solid #cbd5e1 !important;
        border-radius: 10px !important;
        box-shadow: none !important;
        page-break-inside: avoid !important;
      }
    }
  </style>
</head>
<body>
  <div class="a4-page">
    <div class="prop-top-content">
      <!-- Letterhead Top Header -->
      <div class="prop-head">
        <div class="prop-brand">
          <h2>${esc(bizName)}</h2>
          ${proposal.tagline ? `<div class="prop-tagline">${esc(proposal.tagline)}</div>` : ''}
          ${(proposal.officeAddress || business.address) ? `<p>${esc(proposal.officeAddress || business.address)}</p>` : ''}
          ${[proposal.supportPhone || business.phone, proposal.inquiryEmail || business.email, proposal.websiteUrl].filter(Boolean).length > 0 ? `<p>${esc([proposal.supportPhone || business.phone, proposal.inquiryEmail || business.email, proposal.websiteUrl].filter(Boolean).join(' • '))}</p>` : ''}
          ${proposal.ntnTax ? `<div class="prop-tax-badge">${esc(proposal.ntnTax)}</div>` : ''}
        </div>
        <div class="prop-meta">
          <div class="prop-badge" style="background: #0b4b8f !important; color: #ffffff !important; font-weight: 800 !important;">Commercial Proposal</div>
          <div>Proposal #: <strong>${esc(proposalNo)}</strong></div>
          <div>Date: <strong>${esc(proposalDate)}</strong></div>
          <div>Validity: <strong>${esc(validity)}</strong></div>
        </div>
      </div>

      <!-- Client Box -->
      <div class="prop-client-grid">
        <div class="prop-client-card">
          <h4>Prepared For</h4>
          <p><strong>${esc(clientName)}</strong></p>
          ${clientCompany ? `<p>Organization: ${esc(clientCompany)}</p>` : ''}
          ${customer.phone ? `<p>Phone: ${esc(customer.phone)}</p>` : ''}
        </div>
        <div class="prop-client-card">
          <h4>Proposal Details</h4>
          <p><strong>${esc(proposal.title || 'Commercial Proposal & Quotation')}</strong></p>
          <p>Currency: <strong>${esc(cur)}</strong></p>
        </div>
      </div>

      <!-- 1. Overview -->
      <div class="prop-section">
        <div class="prop-section-title">1. Project Overview & Scope of Work</div>
        <div class="prop-overview-text">${esc(summaryText)}</div>
      </div>

      <!-- 2. Deliverables Table -->
      <div class="prop-section">
        <div class="prop-section-title">2. Deliverables & Commercial Pricing</div>
        <table class="prop-table">
          <thead>
            <tr>
              <th style="width: 32px; text-align: center;">#</th>
              <th style="text-align: left;">Deliverable / Service</th>
              <th style="width: 55px; text-align: center;">Qty</th>
              <th style="width: 110px; text-align: right;">Unit Price</th>
              <th style="width: 90px; text-align: right;">Discount</th>
              <th style="width: 65px; text-align: center;">Tax</th>
              <th style="width: 125px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((it, idx) => {
              const gross = Number(it.qty || 1) * Number(it.price || 0);
              const disc = Number(it.discount || 0);
              const taxP = Number(it.taxPct || 0);
              const taxBase = Math.max(0, gross - disc);
              const lineTax = (taxBase * taxP) / 100;
              const lineTot = taxBase + lineTax;

              return `
                <tr>
                  <td style="text-align: center; color: #64748b;">${idx + 1}</td>
                  <td>
                    <strong>${esc(it.name || 'Deliverable')}</strong>
                    ${it.desc ? `<div style="font-size: 10px; color: #64748b; margin-top: 2px;">${esc(it.desc)}</div>` : ''}
                  </td>
                  <td style="text-align: center;">${it.qty || 1}</td>
                  <td style="text-align: right;">${money(it.price || 0, cur)}</td>
                  <td style="text-align: right; color: ${disc > 0 ? '#dc2626' : '#64748b'};">
                    ${disc > 0 ? `- ${money(disc, cur)}` : '—'}
                  </td>
                  <td style="text-align: center; color: ${taxP > 0 ? '#0369a1' : '#64748b'};">
                    ${taxP > 0 ? `${taxP}%` : '—'}
                  </td>
                  <td style="text-align: right; font-weight: 750;">
                    ${money(lineTot, cur)}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            ${(totalDiscount > 0 || totalTaxAmount > 0) ? `
              <tr>
                <td colspan="6" style="text-align: right; font-weight: 750; font-size: 11px; background: #f8fafc; color: #475569;">Subtotal:</td>
                <td style="text-align: right; font-weight: 750; font-size: 11.5px; background: #f8fafc;">${money(subtotal, cur)}</td>
              </tr>
            ` : ''}
            ${totalDiscount > 0 ? `
              <tr>
                <td colspan="6" style="text-align: right; font-size: 11px; color: #dc2626; background: #f8fafc;">Total Discount:</td>
                <td style="text-align: right; font-weight: 700; font-size: 11px; color: #dc2626; background: #f8fafc;">- ${money(totalDiscount, cur)}</td>
              </tr>
            ` : ''}
            ${totalTaxAmount > 0 ? `
              <tr>
                <td colspan="6" style="text-align: right; font-size: 11px; color: #0369a1; background: #f8fafc;">Total Tax:</td>
                <td style="text-align: right; font-weight: 700; font-size: 11px; color: #0369a1; background: #f8fafc;">+ ${money(totalTaxAmount, cur)}</td>
              </tr>
            ` : ''}
            <tr style="border-top: 2px solid #0b4b8f;">
              <td colspan="6" style="text-align: right; font-weight: 800; font-size: 12px; color: #0b4b8f; background: #edf4fe; text-transform: uppercase;">TOTAL:</td>
              <td style="text-align: right; font-weight: 800; font-size: 12.5px; color: #0b4b8f; background: #edf4fe;">${money(grandTotal, cur)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- 3. Payment Milestones (If present) -->
      ${proposal.milestones && proposal.milestones.length > 0 ? `
        <div class="prop-section">
          <div class="prop-section-title">3. Payment Milestones & Billing Schedule</div>
          <table class="prop-table">
            <thead>
              <tr>
                <th style="width: 36px; text-align: center;">#</th>
                <th>Milestone / Deliverable</th>
                <th style="width: 70px; text-align: center;">%</th>
                <th style="width: 140px; text-align: right;">Amount (${esc(cur)})</th>
                <th style="width: 220px;">Due Condition</th>
              </tr>
            </thead>
            <tbody>
              ${proposal.milestones.map((ms, idx) => {
                const msAmt = grandTotal > 0 ? (Number(ms.pct || 0) / 100) * grandTotal : 0;
                return `
                  <tr>
                    <td style="text-align: center; color: #64748b;">${idx + 1}</td>
                    <td><strong>${esc(ms.name || `Milestone ${idx + 1}`)}</strong></td>
                    <td style="text-align: center; font-weight: 700; color: #0b4b8f;">${ms.pct || 0}%</td>
                    <td style="text-align: right; font-weight: 800; color: #065f46;">${money(msAmt, cur)}</td>
                    <td style="font-size: 10.5px; color: #475569;">${esc(ms.dueCondition || '—')}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <!-- 4. Terms & Conditions -->
      <div class="prop-section">
        <div class="prop-section-title">${proposal.milestones && proposal.milestones.length > 0 ? '4.' : '3.'} Payment Terms & Conditions</div>
        <div class="prop-terms-box">${esc(termsText)}</div>
      </div>
    </div>

    <!-- Signatures (Pinned at bottom of A4) -->
    <div class="prop-sigs">
      <div class="prop-sig-line">
        <div>Client Signature</div>
        ${clientName ? `<div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">${esc(clientName)}</div>` : ''}
      </div>
      <div class="prop-sig-line">
        <div>${esc(sigName)}</div>
        ${sigTitle ? `<div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">${esc(sigTitle)}</div>` : ''}
      </div>
    </div>
  </div>
</body>
</html>`;
}

import { downloadAsPdf } from './whatsappPdf.js';

export async function downloadProposalFile(proposal = {}, business = {}, customer = {}) {
  const doc = generateProposalHtml(proposal, business, customer);
  const cleanTitle = (proposal.title || 'Proposal').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${proposal.proposalNo || 'Proposal'}_${cleanTitle}.pdf`;
  await downloadAsPdf(doc, filename);
}

