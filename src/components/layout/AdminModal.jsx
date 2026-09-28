import React from 'react';
import { useApp } from '../../context/AppContext';
import Modal from '../common/Modal';
import Button from '../common/Button';

export default function AdminModal() {
  const { state, isAdminModalOpen, setIsAdminModalOpen, setCurrentPage } = useApp();
  const adminName = state.settings?.admin || 'Admin';

  const handleEditProfile = () => {
    setIsAdminModalOpen(false);
    setCurrentPage('settings');
  };

  return (
    <Modal
      isOpen={isAdminModalOpen}
      onClose={() => setIsAdminModalOpen(false)}
      title="Admin Profile"
      maxWidth="500px"
    >
      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '18px' }}>
        <div className="avatar" style={{ width: '60px', height: '60px', fontSize: '20px' }}>
          {adminName.charAt(0).toUpperCase() || 'A'}
        </div>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '16px' }}>{adminName}</h3>
          <div className="sub">Administrator</div>
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: '14px' }}>
        <div className="stat">
          <div className="label">Businesses</div>
          <div className="value">{state.businesses.length}</div>
        </div>
        <div className="stat">
          <div className="label">Invoices</div>
          <div className="value">{state.invoices.length}</div>
        </div>
      </div>

      <div className="actions">
        <Button variant="light" onClick={() => setIsAdminModalOpen(false)}>
          Close
        </Button>
        <Button variant="primary" onClick={handleEditProfile}>
          Edit Profile
        </Button>
      </div>
    </Modal>
  );
}
