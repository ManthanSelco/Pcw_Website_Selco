// Small field validator for the public forms.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validate(body, fields) {
  const data = {};
  const errors = {};
  for (const [name, rule] of Object.entries(fields)) {
    let v = body?.[name];
    v = v == null ? '' : String(v).trim();
    if (!v) {
      if (rule.required) errors[name] = 'This field is required';
      data[name] = rule.type === 'number' ? null : '';
      continue;
    }
    if (v.length > (rule.max || 300)) errors[name] = `Maximum ${rule.max || 300} characters`;
    if (rule.type === 'email') {
      v = v.toLowerCase();
      if (!EMAIL_RE.test(v)) errors[name] = 'Please enter a valid email';
    }
    if (rule.type === 'tel' && !/^[0-9+\-()\s]{6,20}$/.test(v)) errors[name] = 'Please enter a valid phone number';
    if (rule.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) errors[name] = 'Please choose a valid date';
    if (rule.type === 'number') {
      const n = Number(v);
      if (!Number.isInteger(n) || n < (rule.min ?? 0) || n > (rule.maxValue ?? 100000)) errors[name] = 'Please enter a valid number';
      else v = n;
    }
    if (rule.options && !rule.options.includes(v)) errors[name] = 'Please choose an option';
    data[name] = v;
  }
  return { data, errors, ok: Object.keys(errors).length === 0 };
}
