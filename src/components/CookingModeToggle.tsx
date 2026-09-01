"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Eye } from 'lucide-react';
import { useCookingMode } from '@/context/CookingModeContext';
import styles from './CookingModeToggle.module.css';

export const CookingModeToggle: React.FC = () => {
  const { isCookingMode, toggleCookingMode } = useCookingMode();

  return (
    <div className={styles.toggleContainer} onClick={toggleCookingMode}>
      <span className={styles.toggleLabel}>🍳 調理モード（画面キープ）</span>
      <div className={`${styles.switch} ${isCookingMode ? styles.switchActive : ''}`}>
        <motion.div 
          className={styles.handle}
          animate={{ x: isCookingMode ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          {isCookingMode ? (
            <Sun size={12} className={styles.handleActive} fill="currentColor" />
          ) : (
            <Eye size={12} />
          )}
        </motion.div>
      </div>
    </div>
  );
};
