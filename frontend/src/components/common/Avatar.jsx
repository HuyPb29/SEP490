import styles from './Avatar.module.css';

export function Avatar({ name = '', className = '' }) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? [words[0], words.at(-1)] : words)
    .map(word => Array.from(word)[0]).join('').toLocaleUpperCase('vi-VN');
  return <span aria-hidden="true" className={[styles.avatar, className].filter(Boolean).join(' ')}>{initials || '•'}</span>;
}

export default Avatar;
