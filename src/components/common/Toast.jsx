import React from 'react';
import { useApp } from '../../context/AppContext';

export default function Toast() {
  const { toast } = useApp();

  return (
    <div id="appToast" className={`toast ${toast.show ? 'show' : ''}`}>
      {toast.message}
    </div>
  );
}
