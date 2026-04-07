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
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] bg-black/80 backdrop-blur-sm p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden border border-zinc-200 dark:border-white/10 flex flex-col relative z-10 animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center px-4 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <span className="material-symbols-outlined text-zinc-400 mr-3 text-2xl">search</span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-zinc-900 dark:text-white outline-none placeholder:text-zinc-500 text-lg"
            placeholder="Search commands or jump to..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Command palette search"
          />
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 ml-2 transition-colors"
            aria-label="Close command palette"
          >
            ESC
          </button>
        </div>

        <div className="p-3 space-y-1 bg-zinc-50 dark:bg-zinc-900/50">
          <p className="px-3 py-2 text-xs font-bold text-zinc-500 uppercase tracking-widest">Quick Navigation</p>

          <button
            type="button"
            onClick={() => { navigate('/transfer'); setIsOpen(false); }}
            className="w-full text-left px-3 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg flex items-center gap-3 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] text-indigo-500">swap_horiz</span>
            Execute New Transfer
          </button>

          <button
            type="button"
            onClick={() => { navigate('/ledger'); setIsOpen(false); }}
            className="w-full text-left px-3 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg flex items-center gap-3 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] text-zinc-500">menu_book</span>
            Access Sentinel Ledger
          </button>

          <button
            type="button"
            onClick={() => { navigate('/analytics'); setIsOpen(false); }}
            className="w-full text-left px-3 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg flex items-center gap-3 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] text-red-500">shield_locked</span>
            Review Threat Intel
          </button>
        </div>
      </div>

      <div className="absolute inset-0 z-0" onClick={() => setIsOpen(false)} />
    </div>
  );
}
