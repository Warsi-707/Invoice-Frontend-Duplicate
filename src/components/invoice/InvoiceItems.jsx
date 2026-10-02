import React from 'react';
import Button from '../common/Button';
import { money, today } from '../../utils/formatters';
import { useApp } from '../../context/AppContext';
import { DEFAULT_SERVICES } from '../../utils/storage';
import {
  BILLING_CYCLES,
  DELIVERY_METHODS,
  calculateNextDueDate,
  getDaysUntilDue
} from '../../utils/subscription';
import {
  validateMilestonesTotal,
  calculateProjectMilestoneSummary,
  createNewMilestone,
  getMilestoneLiveMetrics
} from '../../utils/milestone';
import MilestoneSummaryCard from './MilestoneSummaryCard';

export default function InvoiceItems({
  items,
  onChange,
  currency = 'PKR'
}) {
  const { state, showToast } = useApp();
  const savedServices = (state.settings?.services && Array.isArray(state.settings.services) && state.settings.services.length > 0)
    ? state.settings.services
    : DEFAULT_SERVICES;

  const handleItemChange = (index, fieldOrFields, value) => {
    const updated = items.map((item, idx) => {
      if (idx !== index) return item;
      const updates = typeof fieldOrFields === 'object' && fieldOrFields !== null
        ? fieldOrFields
        : { [fieldOrFields]: value };
      const newItem = { ...item, ...updates };
      const q = Math.max(0, Number(newItem.qty !== undefined ? newItem.qty : 1));
      const p = Math.max(0, Number(newItem.price || 0));
      newItem.amount = q * p;

      // If milestone-based project and total changed, re-sync percentage-based milestones
      if (newItem.billingType !== 'subscription' && newItem.projectBillingMode === 'milestone' && Array.isArray(newItem.milestones)) {
        newItem.milestones = newItem.milestones.map((ms) => {
          if (ms.amountType === 'percentage' && ms.percentage !== undefined) {
            return {
              ...ms,
              amount: Math.round(newItem.amount * (Number(ms.percentage) / 100))
            };
          } else if (newItem.amount > 0 && ms.amount !== undefined) {
            return {
              ...ms,
              percentage: Math.round((Number(ms.amount) / newItem.amount) * 1000) / 10
            };
          }
          return ms;
        });
      }

      return newItem;
    });
    onChange(updated);
  };

  const handleMilestoneChange = (itemIndex, msIndex, field, value) => {
    const item = items[itemIndex];
    if (!item) return;
    const projectTotal = Math.max(0, Number(item.qty || 1) * Number(item.price || 0));
    const currentMilestones = Array.isArray(item.milestones) ? [...item.milestones] : [];

    const ms = { ...currentMilestones[msIndex] };
    if (field === 'name') {
      ms.name = value;
    } else if (field === 'startDate') {
      ms.startDate = value;
    } else if (field === 'dueDate') {
      ms.dueDate = value;
    } else if (field === 'status') {
      ms.status = value;
    } else if (field === 'amountType') {
      ms.amountType = value;
    } else if (field === 'percentage') {
      const pct = Math.max(0, Math.min(100, Number(value || 0)));
      ms.percentage = pct;
      ms.amount = Math.round(projectTotal * (pct / 100));
    } else if (field === 'amount') {
      const amt = Math.max(0, Number(value || 0));
      ms.amount = amt;
      ms.percentage = projectTotal > 0 ? Math.round((amt / projectTotal) * 1000) / 10 : 0;
    }

    currentMilestones[msIndex] = ms;

    // Check if total exceeds projectTotal
    const totalAllocated = currentMilestones.reduce((sum, m) => sum + Number(m.amount || 0), 0);
    if (totalAllocated > projectTotal && showToast) {
      showToast(`⚠️ Warning: Milestone total (${money(totalAllocated, currency)}) exceeds Project Total (${money(projectTotal, currency)})!`);
    }

    handleItemChange(itemIndex, 'milestones', currentMilestones);
  };

  const handleAddMilestone = (itemIndex) => {
    const item = items[itemIndex];
    if (!item) return;
    const projectTotal = Math.max(0, Number(item.qty || 1) * Number(item.price || 0));
    const currentMilestones = Array.isArray(item.milestones) ? [...item.milestones] : [];

    const totalAllocated = currentMilestones.reduce((sum, m) => sum + Number(m.amount || 0), 0);
    const unallocated = Math.max(0, projectTotal - totalAllocated);

    const newMs = createNewMilestone(currentMilestones.length + 1, projectTotal, unallocated);
    handleItemChange(itemIndex, 'milestones', [...currentMilestones, newMs]);
  };

  const handleRemoveMilestone = (itemIndex, msIndex) => {
    const item = items[itemIndex];
    if (!item || !Array.isArray(item.milestones)) return;
    const currentMilestones = item.milestones.filter((_, idx) => idx !== msIndex);
    handleItemChange(itemIndex, 'milestones', currentMilestones);
  };

  const handleAddItem = () => {
    onChange([
      ...items,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: '',
        qty: 1,
        price: '',
        amount: 0,
        billingType: 'project',
        projectBillingMode: 'one_time',
        startDate: today(),
        billingCycle: 'monthly',
        nextDueDate: calculateNextDueDate(today(), 'monthly'),
        autoRenewal: true,
        autoGenerateInvoice: true,
        reminderDays: 7,
        deliveryMethod: 'whatsapp'
      }
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length === 1) {
      onChange([
        {
          id: `item-${Date.now()}`,
          name: '',
          qty: 1,
          price: '',
          amount: 0,
          billingType: 'project',
          projectBillingMode: 'one_time',
          startDate: today(),
          billingCycle: 'monthly',
          nextDueDate: calculateNextDueDate(today(), 'monthly'),
          autoRenewal: true,
          autoGenerateInvoice: true,
          reminderDays: 7,
          deliveryMethod: 'whatsapp'
        }
      ]);
    } else {
      onChange(items.filter((_, idx) => idx !== index));
    }
  };

  return (
    <div className="items-card">
      <div className="items-card-head">
        <div>
          <h3 style={{ margin: 0 }}>Items / Services &amp; Billing Type</h3>
          <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
            Select <strong>Project Based (One-Time)</strong> or <strong>Subscription Based (Recurring)</strong> for automated recurring billing.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {savedServices && savedServices.length > 0 && (
            <select
              className="select"
              style={{
                height: '26px',
                fontSize: '11px',
                padding: '2px 8px',
                background: '#eff6ff',
                borderColor: '#93c5fd',
                color: '#1d4ed8',
                fontWeight: '700',
                cursor: 'pointer'
              }}
              value=""
              onChange={(e) => {
                const srvId = e.target.value;
                if (!srvId) return;
                const srv = savedServices.find(s => String(s.id) === String(srvId) || s.name === srvId);
                if (srv) {
                  const newRow = {
                    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                    name: srv.name,
                    qty: 1,
                    price: '',
                    amount: 0,
                    billingType: 'project',
                    startDate: today(),
                    billingCycle: 'monthly',
                    nextDueDate: calculateNextDueDate(today(), 'monthly'),
                    autoRenewal: true,
                    autoGenerateInvoice: true,
                    reminderDays: 7,
                    deliveryMethod: 'whatsapp'
                  };
                  if (items.length === 1 && !items[0].name.trim() && (items[0].price === '' || items[0].price === 0)) {
                    onChange([newRow]);
                  } else {
                    onChange([...items, newRow]);
                  }
                  if (showToast) showToast(`+ Added "${srv.name}"`);
                }
              }}
            >
              <option value="">+ Add from Catalog...</option>
              {savedServices.map((srv, sIdx) => (
                <option key={srv.id || sIdx} value={srv.id || srv.name}>
                  {srv.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={handleAddItem}
            style={{
              height: '26px',
              fontSize: '11px',
              padding: '0 10px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '5px',
              color: '#334155',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              lineHeight: '1'
            }}
          >
            <span>+</span>
            <span>Add Item</span>
          </button>
        </div>
      </div>

      <datalist id="invoice-services-datalist">
        {savedServices.map((srv, sIdx) => (
          <option key={srv.id || sIdx} value={srv.name}>
            {srv.category || ''}
          </option>
        ))}
      </datalist>

      <div className="items-grid-header">
        <div>Description *</div>
        <div>Qty</div>
        <div>Unit Price</div>
        <div>Amount</div>
        <div></div>
      </div>

      <div className="item-stack">
        {items.map((item, index) => {
          const qtyNum = Math.max(0, Number(item.qty || 0));
          const priceNum = Math.max(0, Number(item.price || 0));
          const rowAmount = qtyNum * priceNum;
          const isSubscription = item.billingType === 'subscription';
          const isMilestone = !isSubscription && item.projectBillingMode === 'milestone';
          const itemStartDate = item.startDate || today();
          const itemCycle = item.billingCycle || 'monthly';
          const calculatedDue = item.nextDueDate || calculateNextDueDate(itemStartDate, itemCycle);
          const daysLeft = isSubscription ? getDaysUntilDue(calculatedDue) : null;

          return (
            <div key={item.id || index} style={{ borderBottom: index < items.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
              {/* Main Line Item Row */}
              <div className="item-row" style={{ alignItems: 'flex-start', borderBottom: '1px dashed #cbd5e1', paddingBottom: '8px' }}>
                <div>
                  <input
                    className="input"
                    style={{ height: '38px' }}
                    placeholder="Item or service description"
                    value={item.name || ''}
                    onChange={(e) => {
                      handleItemChange(index, 'name', e.target.value);
                    }}
                    list="invoice-services-datalist"
                    autoComplete="off"
                  />
                  {/* Billing Type Selector Pill Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Type:</span>
                    <button
                      type="button"
                      onClick={() => handleItemChange(index, { billingType: 'project' })}
                      style={{
                        padding: '2px 8px',
                        fontSize: '10.5px',
                        fontWeight: !isSubscription ? '700' : '500',
                        background: !isSubscription ? '#0b4b8f' : '#ffffff',
                        color: !isSubscription ? '#ffffff' : '#475569',
                        border: !isSubscription ? '1px solid #0b4b8f' : '1px solid #cbd5e1',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}
                    >
                      Project Based
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const newStart = item.startDate || today();
                        const newCycle = item.billingCycle || 'monthly';
                        handleItemChange(index, {
                          billingType: 'subscription',
                          startDate: newStart,
                          billingCycle: newCycle,
                          nextDueDate: calculateNextDueDate(newStart, newCycle),
                          autoRenewal: item.autoRenewal !== false,
                          autoGenerateInvoice: item.autoGenerateInvoice !== false,
                          reminderDays: item.reminderDays ?? 7,
                          deliveryMethod: item.deliveryMethod || 'whatsapp'
                        });
                        if (showToast) showToast('Switched to Subscription Based');
                      }}
                      style={{
                        padding: '2px 8px',
                        fontSize: '10.5px',
                        fontWeight: isSubscription ? '700' : '500',
                        background: isSubscription ? '#047857' : '#ffffff',
                        color: isSubscription ? '#ffffff' : '#475569',
                        border: isSubscription ? '1px solid #047857' : '1px solid #cbd5e1',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}
                    >
                      Subscription Based (Recurring)
                    </button>
                  </div>
                </div>
                <div>
                  <input
                    className="input"
                    style={{ height: '38px' }}
                    type="number"
                    min="1"
                    value={item.qty ?? 1}
                    onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <input
                    className="input"
                    style={{ height: '38px' }}
                    type="number"
                    min="0"
                    placeholder="0"
                    value={item.price ?? ''}
                    onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="amount-box" style={{ height: '38px', minHeight: '38px', display: 'flex', alignItems: 'center' }}>
                  {money(rowAmount, currency)}
                </div>
                <div>
                  <Button
                    variant="danger"
                    size="xs"
                    style={{ height: '38px', padding: '0 10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => handleRemoveItem(index)}
                  >
                    Remove
                  </Button>
                </div>
              </div>

              {/* Expandable Subscription Settings Drawer */}
              {isSubscription && (
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  margin: '0 10px 10px 10px',
                  padding: '10px 12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                        Subscription Recurring Parameters
                      </span>
                    </div>
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: '600',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: daysLeft !== null && daysLeft <= 7 ? '#fef3c7' : '#f1f5f9',
                      color: daysLeft !== null && daysLeft <= 7 ? '#92400e' : '#334155',
                      border: daysLeft !== null && daysLeft <= 7 ? '1px solid #fde68a' : '1px solid #cbd5e1'
                    }}>
                      {daysLeft !== null && daysLeft <= 0 ? 'Due Today / Overdue' : `Due in ${daysLeft} days (${calculatedDue})`}
                    </span>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '8px 10px',
                    marginBottom: '10px'
                  }}>
                    {/* Subscription Start Date */}
                    <div>
                      <label style={{ fontSize: '10.5px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '2px' }}>
                        Start Date <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        type="date"
                        className="input"
                        style={{ height: '28px', fontSize: '11.5px', padding: '0 6px' }}
                        value={itemStartDate}
                        onChange={(e) => {
                          const newStart = e.target.value;
                          const newDue = calculateNextDueDate(newStart, itemCycle);
                          handleItemChange(index, {
                            startDate: newStart,
                            nextDueDate: newDue
                          });
                        }}
                      />
                    </div>

                    {/* Billing Cycle */}
                    <div>
                      <label style={{ fontSize: '10.5px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '2px' }}>
                        Billing Cycle <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <select
                        className="select"
                        style={{ height: '28px', fontSize: '11.5px', padding: '0 6px' }}
                        value={itemCycle}
                        onChange={(e) => {
                          const newCycle = e.target.value;
                          const newDue = calculateNextDueDate(itemStartDate, newCycle);
                          handleItemChange(index, {
                            billingCycle: newCycle,
                            nextDueDate: newDue
                          });
                        }}
                      >
                        {BILLING_CYCLES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label} ({c.desc})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Next Due Date (Auto-calculated, user adjustable) */}
                    <div>
                      <label style={{ fontSize: '10.5px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '2px' }}>
                        Next Due Date <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        type="date"
                        className="input"
                        style={{ height: '28px', fontSize: '11.5px', padding: '0 6px', fontWeight: '700', color: '#047857' }}
                        value={calculatedDue}
                        onChange={(e) => handleItemChange(index, 'nextDueDate', e.target.value)}
                      />
                    </div>

                    {/* Reminder Days */}
                    <div>
                      <label style={{ fontSize: '10.5px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '2px' }}>
                        Reminder Days Before Due
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        className="input"
                        style={{ height: '28px', fontSize: '11.5px', padding: '0 6px' }}
                        placeholder="7"
                        value={item.reminderDays ?? 7}
                        onChange={(e) => handleItemChange(index, 'reminderDays', Math.max(1, Number(e.target.value || 7)))}
                      />
                    </div>

                    {/* Digital Delivery Method */}
                    <div>
                      <label style={{ fontSize: '10.5px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '2px' }}>
                        Digital Delivery
                      </label>
                      <select
                        className="select"
                        style={{ height: '28px', fontSize: '11.5px', padding: '0 6px' }}
                        value={item.deliveryMethod || 'whatsapp'}
                        onChange={(e) => handleItemChange(index, 'deliveryMethod', e.target.value)}
                      >
                        {DELIVERY_METHODS.map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Toggles & Info Banner */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', paddingTop: '6px', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '600', color: '#1e293b', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={item.autoGenerateInvoice !== false}
                          onChange={(e) => handleItemChange(index, 'autoGenerateInvoice', e.target.checked)}
                          style={{ width: '14px', height: '14px', accentColor: '#16a34a' }}
                        />
                        <span>Auto-Generate Invoice ({item.reminderDays ?? 7} Days Before Due)</span>
                      </label>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '600', color: '#1e293b', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={item.autoRenewal !== false}
                          onChange={(e) => handleItemChange(index, 'autoRenewal', e.target.checked)}
                          style={{ width: '14px', height: '14px', accentColor: '#16a34a' }}
                        />
                        <span>Auto-Renewal Cycle</span>
                      </label>
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#475569', fontWeight: '600' }}>
                      Recurring Schedule: Starts <strong>{itemStartDate}</strong> → Next Due <strong>{calculatedDue}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Expandable Project Based Settings & Milestones Drawer */}
              {!isSubscription && (
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  margin: '0 10px 10px 10px',
                  padding: '10px 12px'
                }}>
                  {/* Top Bar: Title, Mode Tabs, and Status Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                        Project Billing Parameters
                      </span>

                      {/* Billing Mode Switcher (Clean Segmented Pill) */}
                      <div style={{ display: 'inline-flex', background: '#e2e8f0', padding: '2px', borderRadius: '5px', gap: '2px' }}>
                        <button
                          type="button"
                          onClick={() => handleItemChange(index, 'projectBillingMode', 'one_time')}
                          style={{
                            padding: '3px 10px',
                            fontSize: '11px',
                            fontWeight: !isMilestone ? '700' : '500',
                            background: !isMilestone ? '#ffffff' : 'transparent',
                            color: !isMilestone ? '#0f172a' : '#64748b',
                            border: !isMilestone ? '1px solid #cbd5e1' : 'none',
                            borderRadius: '4px',
                            boxShadow: 'none',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>1. One-Time Project</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const currentMilestones = Array.isArray(item.milestones) && item.milestones.length > 0
                              ? item.milestones
                              : [createNewMilestone(1, rowAmount, rowAmount)];
                            handleItemChange(index, {
                              projectBillingMode: 'milestone',
                              milestones: currentMilestones
                            });
                          }}
                          style={{
                            padding: '3px 10px',
                            fontSize: '11px',
                            fontWeight: isMilestone ? '700' : '500',
                            background: isMilestone ? '#ffffff' : 'transparent',
                            color: isMilestone ? '#0f172a' : '#64748b',
                            border: isMilestone ? '1px solid #cbd5e1' : 'none',
                            borderRadius: '4px',
                            boxShadow: 'none',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>2. Milestone Based</span>
                        </button>
                      </div>
                    </div>

                    {/* Status Badge */}
                    {!isMilestone ? (
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: '600',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: '#f1f5f9',
                        color: '#334155',
                        border: '1px solid #cbd5e1'
                      }}>
                        Single Invoice • Non-Recurring
                      </span>
                    ) : (
                      (() => {
                        const milestones = Array.isArray(item.milestones) ? item.milestones : [];
                        const validation = validateMilestonesTotal(rowAmount, milestones);
                        if (validation.isExceeded) {
                          return (
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: '700',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: '#fef2f2',
                              color: '#b91c1c',
                              border: '1px solid #fecaca'
                            }}>
                              ⚠️ Exceeds by {money(validation.excess, currency)} ({validation.totalPct}%)
                            </span>
                          );
                        }
                        if (validation.isComplete) {
                          return (
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: '700',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: '#f0fdf4',
                              color: '#15803d',
                              border: '1px solid #bbf7d0'
                            }}>
                              ✅ 100% Allocated ({money(validation.totalAmount, currency)})
                            </span>
                          );
                        }
                        return (
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: '600',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: '#fffbeb',
                            color: '#b45309',
                            border: '1px solid #fde68a'
                          }}>
                            Allocated: {validation.totalPct}% | Remaining: {money(validation.remaining, currency)}
                          </span>
                        );
                      })()
                    )}
                  </div>

                  {/* -----------------------------------------------------------------
                      VIEW A: ONE-TIME PROJECT PARAMETERS (Matches Subscription Layout)
                     ----------------------------------------------------------------- */}
                  {!isMilestone && (
                    <>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: '8px 10px',
                        marginBottom: '10px'
                      }}>
                        {/* Target Delivery / Completion Date */}
                        <div>
                          <label style={{ fontSize: '10.5px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '2px' }}>
                            Delivery / Due Date
                          </label>
                          <input
                            type="date"
                            className="input"
                            style={{ height: '28px', fontSize: '11.5px', padding: '0 6px' }}
                            value={item.dueDate || today()}
                            onChange={(e) => handleItemChange(index, 'dueDate', e.target.value)}
                          />
                        </div>

                        {/* Payment Terms */}
                        <div>
                          <label style={{ fontSize: '10.5px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '2px' }}>
                            Payment Terms
                          </label>
                          <select
                            className="select"
                            style={{ height: '28px', fontSize: '11.5px', padding: '0 6px' }}
                            value={item.paymentTerms || 'completion'}
                            onChange={(e) => handleItemChange(index, 'paymentTerms', e.target.value)}
                          >
                            <option value="completion">Due on Completion / Handover</option>
                            <option value="advance">100% Upfront Advance</option>
                            <option value="split_50">50% Advance / 50% Completion</option>
                            <option value="net_15">Net 15 Days</option>
                            <option value="net_30">Net 30 Days</option>
                          </select>
                        </div>

                        {/* Invoice Status Trigger */}
                        <div>
                          <label style={{ fontSize: '10.5px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '2px' }}>
                            Billing Trigger
                          </label>
                          <select
                            className="select"
                            style={{ height: '28px', fontSize: '11.5px', padding: '0 6px' }}
                            value={item.billingTrigger || 'ready'}
                            onChange={(e) => handleItemChange(index, 'billingTrigger', e.target.value)}
                          >
                            <option value="ready">Ready to Invoice Now</option>
                            <option value="upon_delivery">Invoice Upon Delivery</option>
                            <option value="manual">Manual Invoice Only</option>
                          </select>
                        </div>

                        {/* Digital Delivery */}
                        <div>
                          <label style={{ fontSize: '10.5px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '2px' }}>
                            Digital Delivery
                          </label>
                          <select
                            className="select"
                            style={{ height: '28px', fontSize: '11.5px', padding: '0 6px' }}
                            value={item.deliveryMethod || 'whatsapp'}
                            onChange={(e) => handleItemChange(index, 'deliveryMethod', e.target.value)}
                          >
                            {DELIVERY_METHODS.map((d) => (
                              <option key={d.value} value={d.value}>
                                {d.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Info Footer Banner */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px',
                        paddingTop: '6px',
                        borderTop: '1px solid #e2e8f0',
                        fontSize: '10.5px',
                        color: '#475569'
                      }}>
                        <div>
                          Single Project Invoice: Total <strong>{money(rowAmount, currency)}</strong>. Does not renew or repeat.
                        </div>
                        <div style={{ fontWeight: '600', color: '#0369a1' }}>
                          💡 Need phased stage payments? Switch to <strong>Milestone Based</strong> above.
                        </div>
                      </div>
                    </>
                  )}

                  {/* -----------------------------------------------------------------
                      VIEW B: MILESTONE BASED SCHEDULE & BILLING (Matches Slate Styling)
                     ----------------------------------------------------------------- */}
                  {isMilestone && (
                    <>
                      {/* Validation Warning Alert if Exceeded */}
                      {(() => {
                        const milestones = Array.isArray(item.milestones) ? item.milestones : [];
                        const validation = validateMilestonesTotal(rowAmount, milestones);
                        if (validation.isExceeded) {
                          return (
                            <div style={{
                              padding: '8px 12px',
                              background: '#fef2f2',
                              border: '1px solid #f87171',
                              borderRadius: '6px',
                              marginBottom: '10px',
                              fontSize: '11.5px',
                              color: '#991b1b',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <span>⚠️</span>
                              <span>
                                <strong>Milestone Total Exceeded:</strong> Total milestone amount is {money(validation.totalAmount, currency)} ({validation.totalPct}%), which exceeds the project total of {money(rowAmount, currency)}. Please reduce milestone amounts.
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Milestones Table */}
                      <div style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        marginBottom: '10px'
                      }}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '32px 1fr 125px 125px 95px 115px 120px 36px',
                          gap: '6px',
                          padding: '8px 10px',
                          background: '#f8fafc',
                          fontSize: '10.5px',
                          fontWeight: '700',
                          color: '#475569',
                          borderBottom: '1px solid #e2e8f0',
                          alignItems: 'center'
                        }}>
                          <div style={{ textAlign: 'center' }}>#</div>
                          <div>Milestone Description *</div>
                          <div>Start Date</div>
                          <div>Due Date</div>
                          <div>Alloc Type</div>
                          <div>Amount / %</div>
                          <div>Status / Ref</div>
                          <div style={{ textAlign: 'center' }}></div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {(Array.isArray(item.milestones) ? item.milestones : []).map((ms, mIdx) => {
                            const metrics = getMilestoneLiveMetrics(ms, state.invoices);
                            const isInvoiced = metrics.hasInvoice;
                            const isPct = ms.amountType === 'percentage';

                            return (
                              <div
                                key={ms.id || mIdx}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '32px 1fr 125px 125px 95px 115px 120px 36px',
                                  gap: '6px',
                                  padding: '8px 10px',
                                  borderBottom: mIdx < (item.milestones?.length || 0) - 1 ? '1px solid #f1f5f9' : 'none',
                                  alignItems: 'center',
                                  background: mIdx % 2 === 0 ? '#ffffff' : '#fafafa'
                                }}
                              >
                                {/* # */}
                                <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#64748b' }}>
                                  {mIdx + 1}
                                </div>

                                {/* Name */}
                                <div>
                                  <input
                                    className="input"
                                    style={{ height: '30px', fontSize: '11.5px', padding: '0 8px' }}
                                    placeholder={`e.g. Milestone ${mIdx + 1} - Deliverable Phase`}
                                    value={ms.name || ''}
                                    onChange={(e) => handleMilestoneChange(index, mIdx, 'name', e.target.value)}
                                    disabled={isInvoiced}
                                    autoComplete="off"
                                  />
                                </div>

                                {/* Start Date */}
                                <div>
                                  <input
                                    type="date"
                                    className="input"
                                    style={{ height: '30px', fontSize: '11px', padding: '0 4px' }}
                                    value={ms.startDate || ''}
                                    onChange={(e) => handleMilestoneChange(index, mIdx, 'startDate', e.target.value)}
                                    disabled={isInvoiced}
                                    title="Milestone Start Date"
                                  />
                                </div>

                                {/* Due Date */}
                                <div>
                                  <input
                                    type="date"
                                    className="input"
                                    style={{ height: '30px', fontSize: '11px', padding: '0 4px' }}
                                    value={ms.dueDate || ''}
                                    onChange={(e) => handleMilestoneChange(index, mIdx, 'dueDate', e.target.value)}
                                    disabled={isInvoiced}
                                    title="Milestone Due Date"
                                  />
                                </div>

                                {/* Alloc Type */}
                                <div>
                                  <select
                                    className="select"
                                    style={{ height: '30px', fontSize: '11px', padding: '0 6px' }}
                                    value={ms.amountType || 'percentage'}
                                    onChange={(e) => handleMilestoneChange(index, mIdx, 'amountType', e.target.value)}
                                    disabled={isInvoiced}
                                  >
                                    <option value="percentage">% Percent</option>
                                    <option value="fixed">Fixed ({currency})</option>
                                  </select>
                                </div>

                                {/* Amount / % Input */}
                                <div>
                                  {isPct ? (
                                    <div style={{ position: 'relative' }}>
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        className="input"
                                        style={{ height: '30px', fontSize: '11.5px', padding: '0 24px 0 8px' }}
                                        placeholder="30"
                                        value={ms.percentage ?? ''}
                                        onChange={(e) => handleMilestoneChange(index, mIdx, 'percentage', e.target.value)}
                                        disabled={isInvoiced}
                                      />
                                      <span style={{ position: 'absolute', right: '8px', top: '7px', fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>%</span>
                                    </div>
                                  ) : (
                                    <input
                                      type="number"
                                      min="0"
                                      className="input"
                                      style={{ height: '30px', fontSize: '11.5px', padding: '0 8px' }}
                                      placeholder="30000"
                                      value={ms.amount ?? ''}
                                      onChange={(e) => handleMilestoneChange(index, mIdx, 'amount', e.target.value)}
                                      disabled={isInvoiced}
                                    />
                                  )}
                                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', paddingLeft: '2px' }}>
                                    {isPct ? money(ms.amount || 0, currency) : `${ms.percentage || 0}% of total`}
                                  </div>
                                </div>

                                {/* Status / Invoice Ref */}
                                <div>
                                  {isInvoiced ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      <span style={{
                                        fontSize: '10px',
                                        fontWeight: '700',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: metrics.status === 'Paid' ? '#dcfce7' : metrics.status === 'Partially Paid' ? '#fef3c7' : '#e0e7ff',
                                        color: metrics.status === 'Paid' ? '#166534' : metrics.status === 'Partially Paid' ? '#92400e' : '#3730a3',
                                        textAlign: 'center'
                                      }}>
                                        {metrics.status}
                                      </span>
                                      <span style={{ fontSize: '9.5px', color: '#64748b', textAlign: 'center', fontWeight: '600' }}>
                                        {metrics.invoiceNo}
                                      </span>
                                    </div>
                                  ) : (
                                    <select
                                      className="select"
                                      style={{ height: '30px', fontSize: '11px', padding: '0 4px', fontWeight: ms.status === 'Ready to Invoice' ? '700' : 'normal', color: ms.status === 'Ready to Invoice' ? '#15803d' : 'inherit' }}
                                      value={ms.status || 'Pending'}
                                      onChange={(e) => handleMilestoneChange(index, mIdx, 'status', e.target.value)}
                                    >
                                      <option value="Pending">Pending</option>
                                      <option value="Ready to Invoice">Ready to Invoice</option>
                                    </select>
                                  )}
                                </div>

                                {/* Remove Button */}
                                <div style={{ textAlign: 'center' }}>
                                  {!isInvoiced && (item.milestones?.length || 0) > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveMilestone(index, mIdx)}
                                      title="Remove Milestone"
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#ef4444',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        padding: '2px 4px',
                                        lineHeight: 1
                                      }}
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Add Milestone Button & Action Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleAddMilestone(index)}
                          style={{
                            height: '28px',
                            fontSize: '11px',
                            padding: '0 12px',
                            background: '#f8fafc',
                            border: '1px dashed #94a3b8',
                            borderRadius: '5px',
                            color: '#334155',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>+</span>
                          <span>Add Milestone</span>
                        </button>
                        <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                          Total: <strong>{money(rowAmount, currency)}</strong> | Milestones: <strong>{item.milestones?.length || 0}</strong>
                        </div>
                      </div>

                      {/* Financial Milestone Summary Card */}
                      <div style={{ marginTop: '6px' }}>
                        <MilestoneSummaryCard
                          summary={calculateProjectMilestoneSummary(item, state.invoices)}
                          currency={currency}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="item-help">
        Product, service, rent, repair, consultancy, spare parts — kisi bhi business ka item likh sakte ho. <strong>Subscription Based</strong> select karne se automatic recurring due dates aur reminders set ho jate hain.
      </div>
    </div>
  );
}
