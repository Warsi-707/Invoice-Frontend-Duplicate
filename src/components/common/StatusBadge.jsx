import React from 'react';

export default function StatusBadge({ status, variant }) {
  const statusStr = String(status || 'Unpaid');
  const lower = statusStr.toLowerCase();

  if (lower === 'paid') {
    return <span className="badge-solid-paid">Paid</span>;
  }

  if (lower === 'partial') {
    return <span className="badge-solid-partial">Partial</span>;
  }

  if (lower === 'reversed' || lower === 'reversal') {
    return <span className="badge-solid-reversed">Reversed</span>;
  }

  if (lower === 'cash') {
    return <span className="badge-solid-cash">Cash</span>;
  }

  if (lower === 'online') {
    return <span className="badge-solid-online">Online</span>;
  }

  // Default: Unpaid
  return <span className="badge-solid-unpaid">Unpaid</span>;
}
