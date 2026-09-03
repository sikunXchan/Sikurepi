"use client";

import { X } from "lucide-react";
import SettingsPanel from "./SettingsPanel";
import styles from "./ProfileSettingsModal.module.css";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export default function ProfileSettingsModal({ isOpen, onClose, onSaved }: Props) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <span>⚙️</span>
            <h2>設定・自炊データ</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <SettingsPanel onCloseRequest={onClose} onSaved={onSaved} />
      </div>
    </div>
  );
}
