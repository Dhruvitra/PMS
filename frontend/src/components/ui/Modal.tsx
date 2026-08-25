import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  closeOnEscape?: boolean;
}

/**
 * Premium glassmorphism Modal component using React createPortal.
 */
export function Modal({ open, onClose, children, className, closeOnEscape = true }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    
    // Prevent background scrolling when modal is open
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = 'unset';
    };
  }, [open, onClose, closeOnEscape]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop (Glassmorphism Blur) */}
      <div 
        className="absolute inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      
      {/* Modal Content container */}
      <div className={cn(
        "relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 mx-4 w-full max-w-md animate-scale-in max-h-[90vh] overflow-y-auto z-10",
        className
      )}>
        {children}
      </div>
    </div>,
    document.body
  );
}
