import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

// Generic popup form in the PCW theme.
// fields: [{ name, label, type, required, options, min, max }]
export default function FormModal({ title, intro, fields, submitLabel = 'Submit', endpoint, extra = {}, initial = {}, onClose }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.name, initial[f.name] ?? ''])));
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const box = useRef(null);

  useEffect(() => {
    const prev = document.activeElement;
    document.body.classList.add('pcw-modal-open');
    box.current?.querySelector('input, select, textarea')?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('pcw-modal-open');
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    for (const f of fields) if (f.required && !String(values[f.name]).trim()) errs[f.name] = 'This field is required';
    if (Object.keys(errs).length) {
      setErrors(errs);
      setMessage('Please fill the required fields');
      return;
    }
    setStatus('sending');
    setMessage('');
    try {
      const r = await api(endpoint, { ...values, ...extra });
      setStatus('done');
      setMessage(r.message || 'Thank you!');
    } catch (err) {
      setStatus('idle');
      setErrors(err.errors || {});
      setMessage(err.message);
    }
  }

  const set = (name, v) => {
    setValues((s) => ({ ...s, [name]: v }));
    if (errors[name]) setErrors((x) => ({ ...x, [name]: undefined }));
  };

  return (
    <div className="pcw-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pcw-modal" role="dialog" aria-modal="true" aria-labelledby="pcw-modal-title" ref={box}>
        <button className="pcw-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 id="pcw-modal-title">{title}</h2>
        {intro && <p className="pcw-modal-intro">{intro}</p>}
        {status === 'done' ? (
          <div className="pcw-modal-done" role="status">
            <p>{message}</p>
            <button className="pcw-pill pcw-pill-pink" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="pcw-form-grid">
              {fields.map((f) => {
                const id = `pcw-f-${f.name}`;
                const common = {
                  id,
                  value: values[f.name],
                  onChange: (e) => set(f.name, e.target.value),
                  'aria-invalid': !!errors[f.name],
                };
                return (
                  <div key={f.name} className={`pcw-field ${f.type === 'textarea' ? 'is-wide' : ''} ${errors[f.name] ? 'has-error' : ''}`}>
                    <label htmlFor={id}>
                      {f.label}
                      {f.required && <span aria-hidden="true"> *</span>}
                    </label>
                    {f.type === 'textarea' ? (
                      <textarea rows={3} maxLength={2000} {...common} />
                    ) : f.type === 'select' ? (
                      <select {...common}>
                        <option value="">Choose…</option>
                        {f.options.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input type={f.type || 'text'} min={f.min} max={f.max} {...common} />
                    )}
                    {errors[f.name] && <span className="pcw-field-error">{errors[f.name]}</span>}
                  </div>
                );
              })}
            </div>
            {message && (
              <p className="pcw-form-message" role="alert">
                {message}
              </p>
            )}
            <button className="pcw-pill pcw-pill-green pcw-submit" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending…' : submitLabel}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
