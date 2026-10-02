import React from 'react';
import { money } from '../../utils/formatters';

export default function MilestoneSummaryCard({
  summary,
  currency = 'PKR',
  title = 'Project / Milestone Summary'
}) {
  if (!summary) return null;

  const {
    projectTotal = 0,
    totalMilestones = 0,
    invoicedAmount = 0,
    paidAmount = 0,
    outstandingAmount = 0,
    remainingUnbilledAmount = 0
  } = summary;

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      padding: '12px 14px',
      marginBottom: '14px',
      boxShadow: 'none'
    }}>
      {title && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
          borderBottom: '1px solid #f1f5f9',
          paddingBottom: '6px'
        }}>
          <span style={{
            fontSize: '11.5px',
            fontWeight: '700',
            color: '#1e293b',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {title}
          </span>
          <span style={{
            fontSize: '11px',
            fontWeight: '600',
            color: remainingUnbilledAmount === 0 && invoicedAmount > 0 ? '#16a34a' : '#64748b',
            background: remainingUnbilledAmount === 0 && invoicedAmount > 0 ? '#f0fdf4' : '#f8fafc',
            border: `1px solid ${remainingUnbilledAmount === 0 && invoicedAmount > 0 ? '#bbf7d0' : '#e2e8f0'}`,
            padding: '2px 8px',
            borderRadius: '4px'
          }}>
            {remainingUnbilledAmount === 0 && invoicedAmount > 0 ? 'Fully Invoiced' : `${totalMilestones} Milestones Configured`}
          </span>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '8px'
      }}>
        {/* 1. Project Total */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          padding: '8px 10px'
        }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
            Project Total
          </div>
          <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
            {money(projectTotal, currency)}
          </div>
        </div>

        {/* 2. Total Milestones */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          padding: '8px 10px'
        }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
            Total Milestones
          </div>
          <div style={{ fontSize: '14px', fontWeight: '800', color: '#3b82f6', marginTop: '2px' }}>
            {totalMilestones}
          </div>
        </div>

        {/* 3. Invoiced Amount */}
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '6px',
          padding: '8px 10px'
        }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#1e40af', textTransform: 'uppercase' }}>
            Invoiced Amount
          </div>
          <div style={{ fontSize: '14px', fontWeight: '800', color: '#1d4ed8', marginTop: '2px' }}>
            {money(invoicedAmount, currency)}
          </div>
        </div>

        {/* 4. Paid Amount */}
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '6px',
          padding: '8px 10px'
        }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#15803d', textTransform: 'uppercase' }}>
            Paid Amount
          </div>
          <div style={{ fontSize: '14px', fontWeight: '800', color: '#16a34a', marginTop: '2px' }}>
            {money(paidAmount, currency)}
          </div>
        </div>

        {/* 5. Outstanding Amount */}
        <div style={{
          background: outstandingAmount > 0 ? '#fef2f2' : '#f8fafc',
          border: `1px solid ${outstandingAmount > 0 ? '#fecaca' : '#e2e8f0'}`,
          borderRadius: '6px',
          padding: '8px 10px'
        }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: outstandingAmount > 0 ? '#b91c1c' : '#64748b', textTransform: 'uppercase' }}>
            Outstanding Amount
          </div>
          <div style={{ fontSize: '14px', fontWeight: '800', color: outstandingAmount > 0 ? '#dc2626' : '#64748b', marginTop: '2px' }}>
            {money(outstandingAmount, currency)}
          </div>
        </div>

        {/* 6. Remaining Unbilled Amount */}
        <div style={{
          background: remainingUnbilledAmount > 0 ? '#fffbeb' : '#f8fafc',
          border: `1px solid ${remainingUnbilledAmount > 0 ? '#fde68a' : '#e2e8f0'}`,
          borderRadius: '6px',
          padding: '8px 10px'
        }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: remainingUnbilledAmount > 0 ? '#92400e' : '#64748b', textTransform: 'uppercase' }}>
            Remaining Unbilled
          </div>
          <div style={{ fontSize: '14px', fontWeight: '800', color: remainingUnbilledAmount > 0 ? '#d97706' : '#16a34a', marginTop: '2px' }}>
            {money(remainingUnbilledAmount, currency)}
          </div>
        </div>
      </div>
    </div>
  );
}
