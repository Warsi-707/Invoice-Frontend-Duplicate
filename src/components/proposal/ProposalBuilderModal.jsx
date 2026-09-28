import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import ProposalPreviewModal from './ProposalPreviewModal';
import { money, today } from '../../utils/formatters';
import { downloadProposalFile, generateProposalHtml } from '../../utils/proposal';
import { sendPdfToWhatsApp, downloadAsPdf, downloadAndSendWhatsApp } from '../../utils/whatsappPdf';
import { useApp } from '../../context/AppContext';

const PRESET_TERMS = {
  preset1: `1. Validity: This commercial quotation is valid for 14 calendar days from the date of issuance.
2. Payment Terms: 40% advance milestone on contract signing, 30% on beta milestone preview, and 30% upon final delivery & handover.
3. Taxes: Quoted prices are exclusive of applicable provincial sales tax (GST/PST) unless explicitly itemized.
4. Support & Warranty: 3 months of complimentary technical bug-fixing and cloud maintenance support is included post-launch.`,

  preset2: `1. Validity: This proposal is valid for 30 calendar days from the date of issuance.
2. Payment Terms: 100% Monthly retainer billed in advance at the start of each service cycle.
3. SLA Commitments: 99.9% Cloud Uptime, 2-Hour critical response time, and 24/7 automated monitoring.
4. Scope: Covers continuous feature updates, security patches, and server maintenance.`,

  preset3: `1. Validity: Quoted hardware and license rates are valid for 7 calendar days due to market currency fluctuations.
2. Payment Terms: 100% advance payment required against official Purchase Order (PO).
3. Delivery: Delivery lead time is 3-5 working days from payment confirmation.
4. Warranty: Standard 1-Year official manufacturer warranty against defects.`
};

export default function ProposalBuilderModal({
  isOpen,
  onClose,
  customer = {},
  business = {}
}) {
  const { state, showToast, updateSettings } = useApp();
  const savedProp = state.settings?.proposalData || {};
  const cur = business.currency || state.settings?.currency || 'PKR';

  // Proposal Form State
  const [title, setTitle] = useState('');
  const [proposalNo, setProposalNo] = useState('');
  const [date, setDate] = useState(today());
  const [validityDays, setValidityDays] = useState(14);
  const [discount, setDiscount] = useState(0);
  const [taxPct, setTaxPct] = useState(0);
  const [summary, setSummary] = useState('');
  const [terms, setTerms] = useState('');
  const [items, setItems] = useState([
    { id: 'item-1', name: '', desc: '', qty: 1, price: '' }
  ]);
  const [milestones, setMilestones] = useState([]);

  // Live Preview Modal State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSendingWa, setIsSendingWa] = useState(false);

  const customerId = customer?.id;

  // Initialize form ONLY when opened or when switching target customer
  useEffect(() => {
    if (isOpen && customer) {
      const savedForCustomer = savedProp?.customerId && String(savedProp.customerId) === String(customer.id)
        ? savedProp
        : null;
      setTitle(savedForCustomer?.title || (customer.name ? `Commercial Proposal for ${customer.name}` : ''));
      const uniqueSuffix = customer.id ? String(customer.id).slice(-4).toUpperCase() : String(Math.floor(Math.random() * 900) + 100);
      setProposalNo(savedForCustomer?.proposalNo || `PROP-${new Date().getFullYear()}-${uniqueSuffix}`);
      setDate(savedForCustomer?.date || today());
      setValidityDays(savedForCustomer?.validityDays || savedProp?.validityDays || 14);
      setDiscount(savedForCustomer?.discount || 0);
      setTaxPct(savedForCustomer?.taxPct || 0);
      setSummary(savedForCustomer?.summary || savedProp?.summary || '');
      setTerms(savedForCustomer?.terms || savedProp?.terms || '');
      setMilestones(savedForCustomer?.milestones && savedForCustomer.milestones.length > 0 ? savedForCustomer.milestones : []);

      // Populate from customer saved items if any, otherwise 1 empty row
      if (savedForCustomer?.items?.length > 0) {
        setItems(savedForCustomer.items.map((it, idx) => ({
          id: it.id || `saved-prop-item-${idx + 1}`,
          name: it.name || '',
          desc: it.desc || '',
          qty: Number(it.qty || 1),
          price: it.price !== undefined && it.price !== '' ? Number(it.price) : '',
          discount: it.discount !== undefined ? it.discount : '',
          taxPct: it.taxPct !== undefined ? it.taxPct : ''
        })));
      } else if (customer.items && customer.items.length > 0) {
        setItems(
          customer.items.map((it, idx) => ({
            id: it.id || `prop-item-${idx + 1}`,
            name: it.name || '',
            desc: it.desc || '',
            qty: Number(it.qty || 1),
            price: it.price !== undefined && it.price !== '' ? Number(it.price) : '',
            discount: it.discount !== undefined ? it.discount : '',
            taxPct: it.taxPct !== undefined ? it.taxPct : ''
          }))
        );
      } else {
        setItems([{ id: `prop-item-${Date.now()}`, name: '', desc: '', qty: 1, price: '', discount: '', taxPct: '' }]);
      }
    }
  }, [isOpen, customerId]);

  // Item Handlers
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { id: `prop-item-${Date.now()}`, name: '', desc: '', qty: 1, price: '', discount: '', taxPct: '' }
    ]);
  };

  const handleUpdateItem = (index, field, value) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveItem = (index) => {
    setItems((prev) => {
      if (prev.length <= 1) {
        return [{ id: `prop-item-${Date.now()}`, name: '', desc: '', qty: 1, price: '', discount: '', taxPct: '' }];
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // Milestone Handlers
  const handleAddMilestone = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const remainingPct = Math.max(0, 100 - totalMilestonePct);
    setMilestones((prev) => [
      ...prev,
      {
        id: `ms-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: prev.length === 0 ? 'Advance Milestone (Contract Signing & Kickoff)' : prev.length === 1 ? 'Beta Prototype & Module Approval' : 'Final Handover & Launch',
        pct: remainingPct > 0 ? remainingPct : 20,
        dueCondition: ''
      }
    ]);
  };

  const handleApplyMilestonePreset = (type, e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (type === '50-50') {
      setMilestones([
        { id: `ms-1-${Date.now()}`, name: 'Advance Milestone (Contract Signing & Kickoff)', pct: 50, dueCondition: 'Upon contract signing & project commencement' },
        { id: `ms-2-${Date.now()}`, name: 'Final Handover & Launch (Go-Live)', pct: 50, dueCondition: 'Upon final testing, deployment & handover' }
      ]);
    } else if (type === '40-30-30') {
      setMilestones([
        { id: `ms-1-${Date.now()}`, name: 'Project Advance (Contract Signing & Setup)', pct: 40, dueCondition: 'Upon contract signing & initial setup' },
        { id: `ms-2-${Date.now()}`, name: 'Beta Milestone & Core Approval', pct: 30, dueCondition: 'Upon completion & approval of beta version' },
        { id: `ms-3-${Date.now()}`, name: 'Final Deployment & Handover', pct: 30, dueCondition: 'Upon final release, handover & QA signoff' }
      ]);
    } else if (type === '100') {
      setMilestones([
        { id: `ms-1-${Date.now()}`, name: '100% Advance Payment', pct: 100, dueCondition: 'Upon project confirmation & PO issuance' }
      ]);
    }
  };

  const handleUpdateMilestone = (index, field, value) => {
    setMilestones((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveMilestone = (index) => {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  };

  // Financial Calculations
  const subtotal = items.reduce(
    (sum, it) => sum + Number(it.qty || 1) * Number(it.price || 0),
    0
  );
  const totalDiscount = items.reduce(
    (sum, it) => sum + Number(it.discount || 0),
    0
  );
  const totalTaxAmount = items.reduce((sum, it) => {
    const gross = Number(it.qty || 1) * Number(it.price || 0);
    const taxBase = Math.max(0, gross - Number(it.discount || 0));
    return sum + (taxBase * Number(it.taxPct || 0)) / 100;
  }, 0);
  const grandTotal = Math.max(0, subtotal - totalDiscount + totalTaxAmount);
  const totalMilestonePct = milestones.reduce((sum, m) => sum + Number(m.pct || 0), 0);

  // Construct current proposal object
  const currentProposalObject = {
    customerId: customer.id,
    title: title.trim() || 'Commercial Proposal & Quotation',
    proposalNo,
    date,
    companyName: savedProp.companyName || business.name || '',
    tagline: savedProp.tagline || '',
    officeAddress: savedProp.officeAddress || business.address || '',
    ntnTax: savedProp.ntnTax || '',
    supportPhone: savedProp.supportPhone || business.phone || '',
    inquiryEmail: savedProp.inquiryEmail || '',
    websiteUrl: savedProp.websiteUrl || '',
    signatoryName: savedProp.signatoryName || '',
    signatoryTitle: savedProp.signatoryTitle || '',
    validity: `${validityDays || 14} Days from issuance`,
    summary: summary.trim(),
    terms: terms.trim(),
    milestones: milestones.filter(m => m.name || m.pct),
    items: items.map((it) => ({
      id: it.id,
      name: it.name || 'Custom Deliverable',
      desc: it.desc || '',
      qty: Number(it.qty || 1),
      price: Number(it.price || 0),
      discount: Number(it.discount || 0),
      taxPct: Number(it.taxPct || 0)
    })),
    discount: totalDiscount,
    taxPct: 0,
    taxAmount: totalTaxAmount,
    grandTotal
  };

  const handleSaveProposal = () => {
    const proposalDraft = {
      ...savedProp,
      ...currentProposalObject,
      savedAt: new Date().toISOString()
    };

    updateSettings({ proposalData: proposalDraft });
    showToast('Proposal saved.');
  };

  const handleDownload = async () => {
    showToast('⚡ Processing PDF...');
    const cleanTitle = (title || 'Proposal').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${proposalNo || 'Proposal'}_${customer.name || 'Client'}_${cleanTitle}.pdf`;
    const html = generateProposalHtml(currentProposalObject, business, customer);
    const recipientPhone = customer.whatsapp || customer.phone;
    const caption = `📄 *Proposal ${proposalNo}*\n🏢 ${currentProposalObject.companyName || business.name || ''}\n👤 ${customer.name || 'Client'}\n💰 Total: ${money(grandTotal, cur)}`;

    await downloadAndSendWhatsApp({
      htmlContent: html,
      fileName,
      phone: recipientPhone,
      caption,
      onWhatsAppSuccess: () => showToast(`✅ Proposal PDF sent to ${customer.name || 'Client'} via WhatsApp!`)
    });
    showToast('✅ Proposal PDF downloaded!');
  };

  const handleSendWhatsApp = async () => {
    setIsSendingWa(true);
    try {
      const recipientPhone = customer.whatsapp || customer.phone;
      if (!recipientPhone) {
        alert('Please specify a client with a valid WhatsApp number.');
        return;
      }
      showToast('⏳ Sending PDF to WhatsApp...');
      const cleanTitle = (title || 'Proposal').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `${proposalNo || 'Proposal'}_${customer.name || 'Client'}_${cleanTitle}.pdf`;
      const html = generateProposalHtml(currentProposalObject, business, customer);
      const caption = `📄 *Proposal ${proposalNo}*\n🏢 ${currentProposalObject.companyName || business.name || ''}\n👤 ${customer.name || 'Client'}\n💰 Total: ${money(grandTotal, cur)}`;
      await sendPdfToWhatsApp({ phone: recipientPhone, htmlContent: html, fileName, caption });
      showToast(`✅ Proposal PDF sent to ${customer.name || 'Client'} via WhatsApp!`);
    } catch (err) {
      alert('WhatsApp error: ' + (err.message || 'Please link WhatsApp in Settings first.'));
    } finally {
      setIsSendingWa(false);
    }
  };

  const headerExtra = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <Button variant="light" size="xs" onClick={handleSaveProposal}
        style={{ padding: '4px 10px', fontSize: '11px' }}
      >
        Save Proposal
      </Button>
      <Button
        variant="green"
        size="xs"
        onClick={handleSendWhatsApp}
        disabled={isSendingWa}
        style={{ background: '#10b981', color: '#fff', padding: '4px 10px', fontSize: '11px' }}
      >
        {isSendingWa ? 'Sending...' : 'Send WhatsApp'}
      </Button>
      <Button variant="light" size="xs" onClick={handleDownload}
        style={{ padding: '4px 10px', fontSize: '11px' }}
      >
        Download PDF
      </Button>
      <Button
        variant="light"
        size="xs"
        onClick={() => setIsPreviewOpen(true)}
        style={{ background: '#ffffff', color: '#0b4b8f', border: '1px solid #cbd5e1', fontWeight: '700', padding: '4px 10px', fontSize: '11px' }}
      >
        View Proposal
      </Button>
    </div>
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Commercial Proposal Builder: ${customer.name || 'Client'}`}
        headerExtra={headerExtra}
        maxWidth="920px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Client & Business Overview Card */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>CLIENT / RECIPIENT:</span>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>{customer.name || '-'}</div>
              <div style={{ fontSize: '11.5px', color: '#475569' }}>Phone / WA: <strong>{customer.phone || customer.whatsapp || '-'}</strong></div>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>ISSUING BUSINESS / AGENCY:</span>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#0b4b8f' }}>{savedProp.companyName || business.name || 'Commercial Proposal'}</div>
              <div style={{ fontSize: '11.5px', color: '#475569' }}>
                {savedProp.tagline ? <span>{savedProp.tagline} | </span> : (business.category ? <span>Category: <strong>{business.category}</strong> | </span> : '')}
                Currency: <strong>{cur}</strong>
              </div>
            </div>
          </div>

          {/* General Proposal Details */}
          <div className="grid two" style={{ gap: '12px 14px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label>Proposal Subject / Title <span className="req">*</span></label>
              <input
                className="input"
                placeholder="e.g. Commercial Proposal & Quotation for Software / Services Deployment"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div>
              <label>Proposal Date</label>
              <input
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div>
              <label>Proposal Validity (Days)</label>
              <input
                type="number"
                min="1"
                max="365"
                className="input"
                placeholder="14"
                value={validityDays}
                onChange={(e) => setValidityDays(Math.max(1, Number(e.target.value || 14)))}
              />
            </div>
          </div>

          {/* 1. Project Overview & Scope Description (Optional Paragraph) */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '800', color: '#0b4b8f', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  1. Project Overview &amp; Introduction (Optional Paragraph)
                </label>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Write introductory details, project background, or client message to appear before deliverables.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600' }}>Presets:</span>
                <button
                  type="button"
                  onClick={() => setSummary(`We are pleased to submit this commercial proposal for ${customer?.name || 'your esteemed organization'}. Our team is committed to providing industry-leading services and high-quality deliverables tailored specifically to your operational requirements.`)}
                  style={{ padding: '3px 8px', fontSize: '10.5px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', color: '#0b4b8f' }}
                >
                  General Intro
                </button>
                <button
                  type="button"
                  onClick={() => setSummary(`This commercial proposal outlines the scope of work, technical architecture, deployment deliverables, and service commitments for ${customer?.name || 'Client'}.`)}
                  style={{ padding: '3px 8px', fontSize: '10.5px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', color: '#0b4b8f' }}
                >
                  Technical Scope
                </button>
                {summary && (
                  <button
                    type="button"
                    onClick={() => setSummary('')}
                    style={{ padding: '3px 8px', fontSize: '10.5px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <textarea
              className="textarea"
              rows={2}
              placeholder="Enter introduction, project overview, or client message here..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              style={{ fontSize: '12px', width: '100%', borderRadius: '6px', background: '#fff' }}
            />
          </div>

          {/* Interactive Deliverables & Pricing Table */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0b4b8f', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  {summary ? '2.' : '1.'} Deliverables, Scope &amp; Custom Pricing
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                  Enter your deliverable items, service descriptions, and exact custom prices below.
                </p>
              </div>
              <Button variant="light" size="xs" onClick={handleAddItem} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span>+</span>
                <span>Add Deliverable Line</span>
              </Button>
            </div>

            <div className="table-wrap" style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', minWidth: '0' }}>
                <thead>
                  <tr>
                    <th style={{ width: '32px', textAlign: 'center' }}>#</th>
                    <th>Deliverable / Service</th>
                    <th style={{ width: '65px', textAlign: 'center' }}>Qty</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>Unit Price ({cur})</th>
                    <th style={{ width: '95px', textAlign: 'right' }}>Discount ({cur})</th>
                    <th style={{ width: '70px', textAlign: 'center' }}>Tax (%)</th>
                    <th style={{ width: '115px', textAlign: 'right' }}>Total</th>
                    <th style={{ width: '36px', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const gross = Number(it.qty || 1) * Number(it.price || 0);
                    const disc = Number(it.discount || 0);
                    const taxP = Number(it.taxPct || 0);
                    const taxBase = Math.max(0, gross - disc);
                    const lineTax = (taxBase * taxP) / 100;
                    const lineTotal = taxBase + lineTax;

                    return (
                      <tr key={it.id || idx}>
                        <td style={{ textAlign: 'center', color: '#64748b', fontSize: '11px' }}>{idx + 1}</td>
                        <td>
                          <input
                            className="input"
                            placeholder="e.g. Website Development"
                            value={it.name}
                            onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                            style={{ height: '32px', fontSize: '12px' }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            className="input"
                            placeholder="1"
                            value={it.qty}
                            onChange={(e) => handleUpdateItem(idx, 'qty', Math.max(1, Number(e.target.value || 1)))}
                            style={{ height: '32px', textAlign: 'center', fontSize: '12px' }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            className="input"
                            placeholder="0"
                            value={it.price}
                            onChange={(e) => handleUpdateItem(idx, 'price', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                            style={{ height: '32px', textAlign: 'right', fontSize: '12px', fontWeight: '700' }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            className="input"
                            placeholder="0"
                            value={it.discount !== undefined ? it.discount : ''}
                            onChange={(e) => handleUpdateItem(idx, 'discount', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                            style={{ height: '32px', textAlign: 'right', fontSize: '12px', color: Number(it.discount) > 0 ? '#dc2626' : undefined }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="input"
                            placeholder="0"
                            value={it.taxPct !== undefined ? it.taxPct : ''}
                            onChange={(e) => handleUpdateItem(idx, 'taxPct', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                            style={{ height: '32px', textAlign: 'center', fontSize: '12px', color: Number(it.taxPct) > 0 ? '#0369a1' : undefined }}
                          />
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '800', color: '#0f172a', fontSize: '12px' }}>
                          {money(lineTotal, cur)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="action-icon-btn delete"
                            title="Remove Line"
                            onClick={() => handleRemoveItem(idx)}
                            style={{ width: '26px', height: '26px' }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
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
                      <td style={{ background: '#f8fafc' }}></td>
                    </tr>
                  )}
                  {totalDiscount > 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'right', fontSize: '11px', color: '#dc2626', background: '#f8fafc' }}>Total Discount:</td>
                      <td style={{ textAlign: 'right', fontWeight: '700', fontSize: '11px', color: '#dc2626', background: '#f8fafc' }}>- {money(totalDiscount, cur)}</td>
                      <td style={{ background: '#f8fafc' }}></td>
                    </tr>
                  )}
                  {totalTaxAmount > 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'right', fontSize: '11px', color: '#0369a1', background: '#f8fafc' }}>Total Tax:</td>
                      <td style={{ textAlign: 'right', fontWeight: '700', fontSize: '11px', color: '#0369a1', background: '#f8fafc' }}>+ {money(totalTaxAmount, cur)}</td>
                      <td style={{ background: '#f8fafc' }}></td>
                    </tr>
                  )}
                  <tr style={{ borderTop: '2px solid #0b4b8f' }}>
                    <td colSpan={6} style={{ textAlign: 'right', fontWeight: '800', fontSize: '12px', color: '#0b4b8f', background: '#edf4fe', textTransform: 'uppercase' }}>TOTAL:</td>
                    <td style={{ textAlign: 'right', fontWeight: '800', fontSize: '12.5px', color: '#0b4b8f', background: '#edf4fe' }}>{money(grandTotal, cur)}</td>
                    <td style={{ background: '#edf4fe' }}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Payment Milestones Section */}
          <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #1e3a5f' }}>
            {/* Dark Header */}
            <div style={{ background: 'linear-gradient(135deg, #0f2744 0%, #0b4b8f 100%)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>💳</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#fff' }}>Payment Milestones &amp; Billing Schedule</div>
                  <div style={{ fontSize: '10.5px', color: '#93c5fd' }}>Set structured percentage payments tied to project deliverables.</div>
                </div>
                {milestones.length > 0 && (
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: '750',
                    padding: '3px 9px',
                    borderRadius: '10px',
                    background: totalMilestonePct === 100 ? '#16a34a' : totalMilestonePct > 100 ? '#dc2626' : '#d97706',
                    color: '#fff'
                  }}>
                    {totalMilestonePct}% {totalMilestonePct === 100 ? '✓ Balanced' : totalMilestonePct > 100 ? '⚠ Over 100%' : `(${100 - totalMilestonePct}% remaining)`}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10.5px', color: '#93c5fd', fontWeight: '600' }}>Presets:</span>
                <button
                  type="button"
                  onClick={() => handleApplyMilestonePreset('50-50')}
                  style={{
                    padding: '4px 8px', fontSize: '10.5px', fontWeight: '700',
                    background: 'rgba(255,255,255,0.12)', color: '#fff',
                    border: '1px solid rgba(255,255,255,0.25)', borderRadius: '5px', cursor: 'pointer'
                  }}
                  title="50% Advance, 50% Final"
                >
                  50 / 50
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyMilestonePreset('40-30-30')}
                  style={{
                    padding: '4px 8px', fontSize: '10.5px', fontWeight: '700',
                    background: 'rgba(255,255,255,0.12)', color: '#fff',
                    border: '1px solid rgba(255,255,255,0.25)', borderRadius: '5px', cursor: 'pointer'
                  }}
                  title="40% Advance, 30% Beta, 30% Final"
                >
                  40 / 30 / 30
                </button>
                <button
                  type="button"
                  onClick={handleAddMilestone}
                  style={{
                    padding: '6px 14px', fontSize: '11px', fontWeight: '750',
                    background: '#fff', color: '#0b4b8f',
                    border: 'none', borderRadius: '6px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.18)'
                  }}
                >
                  + Add Milestone
                </button>
              </div>
            </div>

            {/* Milestone Rows or Empty State */}
            {milestones.length > 0 ? (
              <div style={{ background: '#0f2744', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {milestones.map((ms, idx) => {
                  const msAmount = grandTotal > 0 ? (Number(ms.pct || 0) / 100) * grandTotal : 0;
                  return (
                    <div key={ms.id} style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 82px 110px 1fr 32px',
                      gap: '8px',
                      alignItems: 'center',
                      background: '#1a3a60',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      border: '1px solid #1e4a7a'
                    }}>
                      {/* Numbered Name Input */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#93c5fd', minWidth: '18px' }}>{idx + 1}.</span>
                        <input
                          className="input"
                          placeholder={idx === 0 ? 'Advance Milestone (Contract Signing & Kickoff)' : idx === 1 ? 'Beta Prototype & Core Module Approval' : 'Final Deployment & Complete Handover'}
                          value={ms.name}
                          onChange={(e) => handleUpdateMilestone(idx, 'name', e.target.value)}
                          style={{
                            height: '32px', fontSize: '11.5px', flex: 1,
                            background: '#0f2744', border: '1px solid #2d5fa0',
                            color: '#e2e8f0', borderRadius: '6px'
                          }}
                        />
                      </div>

                      {/* Percentage */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="input"
                          placeholder="0"
                          value={ms.pct}
                          onChange={(e) => handleUpdateMilestone(idx, 'pct', e.target.value === '' ? '' : Math.min(100, Math.max(0, Number(e.target.value))))}
                          style={{
                            height: '32px', textAlign: 'center', fontSize: '13px',
                            fontWeight: '800', width: '52px',
                            background: '#0f2744', border: '1px solid #2d5fa0',
                            color: '#fff', borderRadius: '6px'
                          }}
                        />
                        <span style={{ fontSize: '12px', color: '#93c5fd', fontWeight: '700' }}>%</span>
                      </div>

                      {/* Amount Badge */}
                      <div style={{
                        height: '32px', display: 'flex', alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        fontSize: '12px', fontWeight: '800', color: '#4ade80',
                        whiteSpace: 'nowrap', letterSpacing: '0.3px'
                      }}>
                        {money(msAmount, cur)}
                      </div>

                      {/* Trigger / Due Condition */}
                      <div>
                        <input
                          className="input"
                          placeholder="e.g. Upon contract signing & commencement"
                          value={ms.dueCondition || ''}
                          onChange={(e) => handleUpdateMilestone(idx, 'dueCondition', e.target.value)}
                          style={{
                            height: '32px', fontSize: '11px',
                            background: '#0f2744', border: '1px solid #2d5fa0',
                            color: '#e2e8f0', borderRadius: '6px'
                          }}
                        />
                      </div>

                      {/* Remove Button */}
                      <div style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="action-icon-btn delete"
                          title="Remove Milestone"
                          onClick={() => handleRemoveMilestone(idx)}
                          style={{ width: '26px', height: '26px', color: '#f87171' }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ background: '#0f2744', padding: '14px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                <span>No milestones configured yet. Click </span>
                <button
                  type="button"
                  onClick={() => handleApplyMilestonePreset('50-50')}
                  style={{ background: 'transparent', border: 'none', color: '#60a5fa', fontWeight: '700', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  [50/50]
                </button>
                <span> or </span>
                <button
                  type="button"
                  onClick={() => handleApplyMilestonePreset('40-30-30')}
                  style={{ background: 'transparent', border: 'none', color: '#60a5fa', fontWeight: '700', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  [40/30/30]
                </button>
                <span> or </span>
                <button
                  type="button"
                  onClick={handleAddMilestone}
                  style={{ background: 'transparent', border: 'none', color: '#4ade80', fontWeight: '700', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  + Add Milestone
                </button>
                <span> to structure deliverable payments.</span>
              </div>
            )}
          </div>


          {/* Terms & Conditions — BELOW milestones */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ margin: 0, fontWeight: '700', fontSize: '12px' }}>Proposal Terms & Conditions</label>
              <div className="preset-btn-group" style={{ gap: '4px' }}>
                <span style={{ fontSize: '10.5px', color: '#64748b' }}>Quick Presets:</span>
                <button type="button" className="preset-chip-btn" onClick={() => setTerms(PRESET_TERMS.preset1)} style={{ padding: '2px 6px', fontSize: '10px' }}>
                  Preset 1
                </button>
                <button type="button" className="preset-chip-btn" onClick={() => setTerms(PRESET_TERMS.preset2)} style={{ padding: '2px 6px', fontSize: '10px' }}>
                  Preset 2
                </button>
                <button type="button" className="preset-chip-btn" onClick={() => setTerms(PRESET_TERMS.preset3)} style={{ padding: '2px 6px', fontSize: '10px' }}>
                  Preset 3
                </button>
              </div>
            </div>
            <textarea
              className="textarea"
              rows={4}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Enter custom commercial terms & conditions, payment milestones, delivery warranty..."
              style={{ fontSize: '11.5px', lineHeight: '1.4' }}
            />
          </div>



          {/* Bottom Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
            <Button variant="light" onClick={onClose}>
              Cancel
            </Button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="light" onClick={handleSaveProposal}>
                Save Proposal
              </Button>
              <Button variant="light" onClick={handleDownload}>
                Download PDF
              </Button>
              <Button
                variant="green"
                onClick={handleSendWhatsApp}
                disabled={isSendingWa}
                style={{ background: '#10b981', color: '#fff' }}
              >
                {isSendingWa ? 'Sending...' : 'Send WhatsApp'}
              </Button>
              <Button variant="primary" onClick={() => setIsPreviewOpen(true)}>
                Fullscreen Preview
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Live High-Resolution A4 Stationery Preview Modal */}
      {isPreviewOpen && (
        <ProposalPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          proposal={currentProposalObject}
          business={business}
          customer={customer}
        />
      )}
    </>
  );
}
