import React, { useState } from 'react';
import Modal from './Modal';

export default function ConfirmDialog({ isOpen, onClose, title, message, confirmText = 'Confirm', onConfirm, isDanger = false }) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button onClick={onClose} className="btn btn-ghost" disabled={loading}>
            Cancel
          </button>
          <button 
            onClick={handleConfirm} 
            className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`} 
            disabled={loading}
          >
            {loading ? 'Confirming...' : confirmText}
          </button>
        </>
      }
    >
      <div className="text-steel text-[13px] leading-relaxed">
        {message}
      </div>
    </Modal>
  );
}
