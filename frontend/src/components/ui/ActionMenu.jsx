import { useRef, useState } from 'react';
import { Button, MenuTrigger, Menu, MenuItem, Popover } from 'react-aria-components';
import styles from './Controls.module.css';

/** Presentation-only row actions; callbacks and permissions stay with the page. */
export function ActionMenu({ label, items }) {
  const trigger = useRef(null);
  const [portalContainer, setPortalContainer] = useState(undefined);
  return <MenuTrigger onOpenChange={() => setPortalContainer(trigger.current?.closest('dialog') || undefined)}>
    <Button ref={trigger} aria-label={label} className={`${styles.button} ${styles.outline} ${styles.menuTrigger}`}>⋯</Button>
    <Popover placement="bottom end" offset={6} UNSTABLE_portalContainer={portalContainer}
      className={`${styles.popover} ${styles.actionPopover} custom-scrollbar`}>
      <Menu aria-label={label} className={styles.listbox} disabledKeys={items.filter(item => item.disabled).map(item => item.id)}
        onAction={key => items.find(item => item.id === key)?.onAction?.()}>
        {items.map(item => <MenuItem key={item.id} id={item.id} textValue={item.label}
          className={styles.option} data-danger={item.danger || undefined}>{item.label}</MenuItem>)}
      </Menu>
    </Popover>
  </MenuTrigger>;
}
