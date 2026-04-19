import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const previousActiveElement = useRef(null);

  const togglePalette = () => setIsOpen((prev) => !prev);

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      togglePalette();
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    previousActiveElement.current = document.activeElement;
    inputRef.current?.focus();

    const trapFocus = (event) => {
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll(
          'button, input, textarea, select, [href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('disabled'));

      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialogRef.current.addEventListener('keydown', trapFocus);
    return () => {
      dialogRef.current?.removeEventListener('keydown', trapFocus);
      previousActiveElement.current?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] bg-black/40 backdrop-blur-sm p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="bg-white w-full max-w-xl rounded-[12px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden border border-[#e3e8ee] flex flex-col relative z-10 animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center px-4 py-4 border-b border-[#e3e8ee]">
          <span className="material-symbols-outlined text-[#6B7C93] mr-3 text-[22px]">search</span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-[#0A2540] outline-none placeholder:text-[#6B7C93] text-[16px]"
            placeholder="Search commands or jump to..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Command palette search"
          />
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-[10px] font-bold bg-[#f6f9fc] text-[#6B7C93] hover:text-[#0A2540] border border-[#e3e8ee] rounded px-2 py-1 ml-2 transition-colors"
            aria-label="Close command palette"
          >
            ESC
          </button>
        </div>

        <div className="p-3 space-y-1 bg-[#f6f9fc]">
          <p className="px-3 py-2 text-[11px] font-bold text-[#6B7C93] uppercase tracking-wider">Quick Navigation</p>

          <button
            type="button"
            onClick={() => { navigate('/transfer'); setIsOpen(false); }}
            className="w-full text-left px-3 py-3 text-[13px] font-medium text-[#0A2540] hover:bg-white rounded-[6px] flex items-center gap-3 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] text-[#635BFF]">swap_horiz</span>
            Execute New Transfer
          </button>

          <button
            type="button"
            onClick={() => { navigate('/ledger'); setIsOpen(false); }}
            className="w-full text-left px-3 py-3 text-[13px] font-medium text-[#0A2540] hover:bg-white rounded-[6px] flex items-center gap-3 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] text-[#6B7C93]">menu_book</span>
            Access Sentinel Ledger
          </button>

          <button
            type="button"
            onClick={() => { navigate('/analytics'); setIsOpen(false); }}
            className="w-full text-left px-3 py-3 text-[13px] font-medium text-[#0A2540] hover:bg-white rounded-[6px] flex items-center gap-3 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] text-[#df1b41]">shield_locked</span>
            Review Threat Intel
          </button>
        </div>
      </div>

      <div className="absolute inset-0 z-0" onClick={() => setIsOpen(false)} />
    </div>
  );
}
