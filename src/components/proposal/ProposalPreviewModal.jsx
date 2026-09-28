import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { money } from '../../utils/formatters';
import { generateProposalHtml } from '../../utils/proposal';
import { sendPdfToWhatsApp, downloadAsPdf, downloadAndSendWhatsApp } from '../../utils/whatsappPdf';
import { useApp } from '../../context/AppContext';

export default function ProposalPreviewModal({
  isOpen,
  onClose,
  proposal,
  business = {},
  customer = {}
}) {
  const { showToast } = useApp();
  const [isSendingWa, setIsSendingWa] = useState(false);

  if (!proposal) return null;

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

  const bizName = proposal.companyName || business.name || 'Commercial Proposal';
  const clientName = customer.name || proposal.clientName || 'Valued Client';
  const clientCompany = customer.company || proposal.clientCompany || '';
  const proposalNo = proposal.proposalNo || `PROP-${new Date().getFullYear()}-001`;
  const proposalDate = proposal.date || new Date().toISOString().split('T')[0];
  const validity = proposal.validity || '15 Days from issuance';

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    showToast('⚡ Processing PDF...');
    const html = generateProposalHtml(proposal, business, customer);
    const cleanTitle = (proposal.title || 'Proposal').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${proposalNo}_${clientName}_${cleanTitle}.pdf`;
    const recipientPhone = customer?.whatsapp || customer?.phone || proposal?.phone || proposal?.whatsapp || proposal?.clientPhone || proposal?.clientWhatsapp || '';
    const caption = `📄 *Proposal ${proposalNo}*\n🏢 ${bizName}\n👤 ${clientName}\n💰 Total: ${money(grandTotal, cur)}`;

    await downloadAndSendWhatsApp({
      htmlContent: html,
      fileName,
      phone: recipientPhone,
      caption,
      onWhatsAppSuccess: () => showToast(`✅ Proposal PDF sent to ${clientName} via WhatsApp!`),
      onWhatsAppError: (err) => showToast(`⚠️ WhatsApp: ${err.message || 'WhatsApp connect karein'}`)
    });
    showToast('✅ Proposal PDF downloaded!');
  };

  const handleSendWhatsApp = async () => {
    setIsSendingWa(true);
    try {
      const recipientPhone = customer?.whatsapp || customer?.phone || proposal?.phone || proposal?.whatsapp || proposal?.clientPhone || proposal?.clientWhatsapp || '';
      if (!recipientPhone) { alert('Please specify a client with a valid WhatsApp number.'); return; }
      showToast('⏳ Sending PDF to WhatsApp...');
      const html = generateProposalHtml(proposal, business, customer);
      const cleanTitle = (proposal.title || 'Proposal').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `${proposalNo}_${clientName}_${cleanTitle}.pdf`;
      const caption = `📄 *Proposal ${proposalNo}*\n🏢 ${bizName}\n👤 ${clientName}\n💰 Total: ${money(grandTotal, cur)}`;
      await sendPdfToWhatsApp({ phone: recipientPhone, htmlContent: html, fileName, caption });
      showToast(`✅ Proposal PDF sent to ${clientName} via WhatsApp!`);
    } catch (err) {
      alert('WhatsApp error: ' + (err.message || 'Please link WhatsApp in Settings first.'));
    } finally {
      setIsSendingWa(false);
    }
  };

  const headerExtra = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Button
        variant="green"
        size="xs"
        onClick={handleSendWhatsApp}
        disabled={isSendingWa}
        style={{ background: '#10b981', color: '#fff', padding: '4px 10px', fontSize: '11px' }}
      >
        {isSendingWa ? 'Sending...' : 'Send WhatsApp'}
      </Button>
      <Button variant="light" size="xs" onClick={handleDownload}>
        ⬇ Download PDF
      </Button>
      <Button variant="primary" size="xs" onClick={handlePrint}>
        Print A4
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Commercial Proposal & Letterhead Preview"
      headerExtra={headerExtra}
      maxWidth="880px"
    >
      <div className="proposal-preview-a4">
        {/* Letterhead Top Header */}
        <div className="prop-head">
          <div className="prop-brand">
            <h2>{bizName}</h2>
            {proposal.tagline && <div className="prop-tagline">{proposal.tagline}</div>}
            {(proposal.officeAddress || business.address) && <p>{proposal.officeAddress || business.address}</p>}
            {[proposal.supportPhone || business.phone, proposal.inquiryEmail || business.email, proposal.websiteUrl].filter(Boolean).length > 0 && (
              <p>{[proposal.supportPhone || business.phone, proposal.inquiryEmail || business.email, proposal.websiteUrl].filter(Boolean).join(' • ')}</p>
            )}
            {proposal.ntnTax && <div className="prop-tax-badge">{proposal.ntnTax}</div>}
          </div>
          <div className="prop-meta">
            <div className="prop-badge" style={{ background: '#0b4b8f', color: '#ffffff', fontWeight: '800' }}>Commercial Proposal</div>
            <div>Proposal #: <strong>{proposalNo}</strong></div>
            <div>Date: <strong>{proposalDate}</strong></div>
            <div>Validity: <strong>{validity}</strong></div>
          </div>
        </div>

        {/* Client Box */}
        <div className="prop-client-grid">
          <div className="prop-client-card">
            <h4>Prepared For</h4>
            <p><strong>{clientName}</strong></p>
            {clientCompany && <p>Organization: {clientCompany}</p>}
            {customer.phone && <p>Phone: {customer.phone}</p>}
          </div>
          <div className="prop-client-card">
            <h4>Proposal Details</h4>
            <p><strong>{proposal.title || 'Commercial Proposal & Quotation'}</strong></p>
            <p>Currency: <strong>{cur}</strong></p>
          </div>
        </div>

        {/* Overview (Optional) */}
        {proposal.summary && (
          <div className="prop-section">
            <div className="prop-section-title">1. Project Overview & Scope of Work</div>
            <div className="prop-overview-text">{proposal.summary}</div>
          </div>
        )}

        {/* Deliverables Table */}
        <div className="prop-section">
          <div className="prop-section-title">{proposal.summary ? '2.' : '1.'} Deliverables & Commercial Pricing</div>
          <table className="prop-table">
            <thead>
              <tr>
                <th style={{ width: '32px', textAlign: 'center' }}>#</th>
                <th style={{ textAlign: 'left' }}>Deliverable / Service</th>
                <th style={{ width: '55px', textAlign: 'center' }}>Qty</th>
                <th style={{ width: '110px', textAlign: 'right' }}>Unit Price</th>
                <th style={{ width: '90px', textAlign: 'right' }}>Discount</th>
                <th style={{ width: '65px', textAlign: 'center' }}>Tax</th>
                <th style={{ width: '125px', textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const gross = Number(it.qty || 1) * Number(it.price || 0);
                const disc = Number(it.discount || 0);
                const taxP = Number(it.taxPct || 0);
                const taxBase = Math.max(0, gross - disc);
                const lineTax = (taxBase * taxP) / 100;
                const lineTot = taxBase + lineTax;

                return (
                  <tr key={it.id || idx}>
                    <td style={{ textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                    <td>
                      <strong>{it.name || 'Deliverable'}</strong>
                      {it.desc && <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>{it.desc}</div>}
                    </td>
                    <td style={{ textAlign: 'center' }}>{it.qty || 1}</td>
                    <td style={{ textAlign: 'right' }}>{money(it.price || 0, cur)}</td>
                    <td style={{ textAlign: 'right', color: disc > 0 ? '#dc2626' : '#64748b' }}>
                      {disc > 0 ? `- ${money(disc, cur)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'center', color: taxP > 0 ? '#0369a1' : '#64748b' }}>
                      {taxP > 0 ? `${taxP}%` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '750' }}>
                      {money(lineTot, cur)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {(totalDiscount > 0 || totalTaxAmount > 0) && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'right', fontWeight: '750', fontSize: '11px', background: '#f8fafc', color: '#475569' }}>Subtotal:</td>
                  <td style={{ textAlign: 'right', fontWeight: '750', fontSize: '11.5px', background: '#f8fafc' }}>{money(subtotal, cur)}</td>
                </tr>
              )}
              {totalDiscount > 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'right', fontSize: '11px', color: '#dc2626', background: '#f8fafc' }}>Total Discount:</td>
                  <td style={{ textAlign: 'right', fontWeight: '700', fontSize: '11px', color: '#dc2626', background: '#f8fafc' }}>- {money(totalDiscount, cur)}</td>
                </tr>
              )}
              {totalTaxAmount > 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'right', fontSize: '11px', color: '#0369a1', background: '#f8fafc' }}>Total Tax:</td>
                  <td style={{ textAlign: 'right', fontWeight: '700', fontSize: '11px', color: '#0369a1', background: '#f8fafc' }}>+ {money(totalTaxAmount, cur)}</td>
                </tr>
              )}
              <tr style={{ borderTop: '2px solid #0b4b8f' }}>
                <td colSpan={6} style={{ textAlign: 'right', fontWeight: '800', fontSize: '12px', color: '#0b4b8f', background: '#edf4fe', textTransform: 'uppercase' }}>TOTAL:</td>
                <td style={{ textAlign: 'right', fontWeight: '800', fontSize: '12.5px', color: '#0b4b8f', background: '#edf4fe' }}>{money(grandTotal, cur)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 3. Payment Milestones (Above Terms) */}
        {proposal.milestones && proposal.milestones.length > 0 && (
          <div className="prop-section">
            <div className="prop-section-title">{proposal.summary ? '3.' : '2.'} Payment Milestones & Billing Schedule</div>
            <table className="prop-table">
              <thead>
                <tr>
                  <th style={{ width: '36px', textAlign: 'center' }}>#</th>
                  <th>Milestone / Deliverable</th>
                  <th style={{ width: '70px', textAlign: 'center' }}>%</th>
                  <th style={{ width: '140px', textAlign: 'right' }}>Amount ({cur})</th>
                  <th style={{ width: '220px' }}>Due Condition</th>
                </tr>
              </thead>
              <tbody>
                {proposal.milestones.map((ms, idx) => {
                  const msAmt = grandTotal > 0 ? (Number(ms.pct || 0) / 100) * grandTotal : 0;
                  return (
                    <tr key={ms.id || idx}>
                      <td style={{ textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                      <td><strong>{ms.name || `Milestone ${idx + 1}`}</strong></td>
                      <td style={{ textAlign: 'center', fontWeight: '700', color: '#0b4b8f' }}>{ms.pct || 0}%</td>
                      <td style={{ textAlign: 'right', fontWeight: '800', color: '#065f46' }}>{money(msAmt, cur)}</td>
                      <td style={{ fontSize: '10.5px', color: '#475569' }}>{ms.dueCondition || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Terms & Conditions (Below Milestones) */}
        {proposal.terms && (
          <div className="prop-section">
            <div className="prop-section-title">{(proposal.summary ? 2 : 1) + (proposal.milestones && proposal.milestones.length > 0 ? 2 : 1)}. Payment Terms & Conditions</div>
            <div className="prop-terms-box">{proposal.terms}</div>
          </div>
        )}

        {/* Signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', marginTop: '36px' }}>
          <div style={{ textAlign: 'center', borderTop: '1px solid #9aa6b6', paddingTop: '6px', fontSize: '10px', color: '#64748b' }}>
            <div>Client Signature</div>
            {clientName && <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>{clientName}</div>}
          </div>
          <div style={{ textAlign: 'center', borderTop: '1px solid #9aa6b6', paddingTop: '6px', fontSize: '10px', color: '#64748b' }}>
            <div>{proposal.signatoryName || 'Authorized Signature'}</div>
            {proposal.signatoryTitle && <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>{proposal.signatoryTitle}</div>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
