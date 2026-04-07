import React, { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';

export function ConfirmationModal({ isOpen, onClose, onConfirm, title, description, confirmText = "DELETE" }) {
  const [input, setInput] = useState('');
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const previousActiveElement = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement;
    inputRef.current?.focus();

    const trapFocus = (event) => {
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll(
          'button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])'
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

  // Reset input when modal opens
  useEffect(() => {
    if (isOpen) {
      setInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isMatch = input === confirmText;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        aria-describedby="confirmation-modal-description"
        className="ln-elevated w-full max-w-md p-5"
      >
        <h3 id="confirmation-modal-title" className="text-base font-medium text-danger mb-1">
          ⚠ {title}
        </h3>
        <p id="confirmation-modal-description" className="text-sm text-muted mb-4">
          {description}
        </p>
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.06em] text-tertiary mb-2">
            Type <strong className="text-danger select-none">{confirmText}</strong> to confirm
          </p>
          <Input
            id="confirmation-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={confirmText}
            className="font-mono"
            aria-describedby="confirmation-modal-description"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={() => { setInput(''); onClose(); }}>
            Cancel
          </Button>
          <Button variant="danger" type="button" disabled={!isMatch} onClick={() => { setInput(''); onConfirm(); }}>
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
