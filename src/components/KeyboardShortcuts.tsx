'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function KeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Ensure we're mounted before rendering portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent background scroll
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const shortcuts = [
    { key: 'Ctrl + B', action: 'Bold text' },
    { key: 'Ctrl + I', action: 'Italic text' },
    { key: 'Ctrl + Z', action: 'Undo' },
    { key: 'Ctrl + Y', action: 'Redo' },
    { key: 'Ctrl + S', action: 'Save document' },
    { key: 'Ctrl + ?', action: 'Show shortcuts' },
    { key: 'Escape', action: 'Close dialogs' },
  ];

  const closeModal = () => setIsOpen(false);

  const Modal = () => (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)' }}
      onClick={closeModal}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={closeModal}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-3">
            {shortcuts.map((shortcut, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {shortcut.action}
                </span>
                <kbd className="px-2 py-1 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-xs font-mono text-gray-600 dark:text-gray-300 shadow-sm">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0">
          <button
            onClick={closeModal}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-105"
        title="Show keyboard shortcuts (Ctrl + ?)"
        aria-label="Show keyboard shortcuts"
      >
        <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="2" y="3" width="20" height="14" rx="2" strokeWidth={2} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21h8M12 17v4" />
          <rect x="5" y="6" width="2" height="2" rx="0.5" strokeWidth={1} />
          <rect x="9" y="6" width="2" height="2" rx="0.5" strokeWidth={1} />
          <rect x="13" y="6" width="2" height="2" rx="0.5" strokeWidth={1} />
          <rect x="7" y="10" width="10" height="2" rx="1" strokeWidth={1} />
        </svg>
      </button>

      {mounted && isOpen && createPortal(<Modal />, document.body)}
    </>
  );
} 