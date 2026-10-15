import React, { createContext, useContext, useState, type ReactNode } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextType {
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 9999
      }}>
        {toasts.map((toast) => (
          <div key={toast.id} style={{
            background: toast.type === 'error' ? 'var(--danger)' : toast.type === 'success' ? 'var(--success)' : 'var(--bg-elevated)',
            color: toast.type === 'info' ? 'var(--text-primary)' : '#fff',
            padding: '12px 24px',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid rgba(255,255,255,0.1)',
            animation: 'slideIn 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            fontWeight: 500
          }}>
            {toast.type === 'success' && '✅'}
            {toast.type === 'error' && '❌'}
            {toast.type === 'info' && 'ℹ️'}
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
