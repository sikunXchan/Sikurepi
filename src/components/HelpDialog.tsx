"use client";

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { guideCopy } from '@/lib/i18n/guides';
import styles from './HelpDialog.module.css';

/** Native dialog provides a top layer, focus trap, Escape and focus restoration. */
export default function HelpDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const trigger = useRef(typeof document !== 'undefined' ? document.activeElement as HTMLElement | null : null);
  const { language } = useLanguage();
  useEffect(() => {
    const dialog = ref.current;
    const returnFocus = trigger.current;
    const previous = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previous;
      queueMicrotask(() => { if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true }); });
    };
  }, []);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <dialog ref={ref} className={styles.dialog} aria-label={title} onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => e.stopPropagation()}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h2>{title}</h2>
          <button type="button" autoFocus onClick={onClose} aria-label={guideCopy[language].close}><X size={22} /></button>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </dialog>, document.body,
  );
}
