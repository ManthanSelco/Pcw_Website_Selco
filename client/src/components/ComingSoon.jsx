import { useEffect, useRef } from 'react';

export default function ComingSoon({ title, text, onClose }) {
  const btn = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    btn.current?.focus();
    document.body.classList.add('pcw-modal-open');
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => {
      document.body.classList.remove('pcw-modal-open');
      window.removeEventListener('keydown', esc);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="pcw-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pcw-modal pcw-soon" role="dialog" aria-modal="true" aria-labelledby="pcw-soon-title">
        <span className="pcw-tag-dark">COMING SOON</span>
        <h2 id="pcw-soon-title">{title}</h2>
        <p className="pcw-modal-intro">{text}</p>
        <button ref={btn} className="pcw-pill pcw-pill-pink" onClick={onClose}>
          Okay
        </button>
      </div>
    </div>
  );
}
