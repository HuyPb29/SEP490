import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './AppLayouts.module.css';

export default function NavigationDrawer({ label, left = false, onClose, children }) {
  const dialog = useRef(null);

  useLayoutEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  return createPortal(
    <dialog
      ref={dialog}
      aria-label={label}
      className={`${styles.drawerBackdrop} ${left ? styles.drawerBackdropLeft : ''}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`${styles.drawerPanel} ${left ? styles.drawerPanelDark : ''}`}>
        {children}
      </div>
    </dialog>,
    document.body
  );
}
