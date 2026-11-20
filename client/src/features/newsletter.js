// The footer newsletter was a Webflow form (only works on Webflow hosting).
// Here it is saved to our own backend (MongoDB) instead, showing the same
// Webflow success / error messages.
export function connectNewsletter() {
  const form = document.getElementById('email-form');
  if (!form) return;
  const wrap = form.parentElement;
  const done = wrap.querySelector('.w-form-done');
  const fail = wrap.querySelector('.w-form-fail');
  const btn = form.querySelector('[type=submit]');
  const input = form.querySelector('input[name=name], input[type=email], input[type=text]');

  const enable = () => {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('w-form-loading');
    }
  };
  enable();
  setTimeout(enable, 1500); // Webflow's captcha script may disable it again

  // capture phase: runs before Webflow's own handler, which we stop
  document.addEventListener(
    'submit',
    async (e) => {
      if (e.target !== form) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const email = (input?.value || '').trim();
      if (fail) {
        fail.style.display = 'none';
        fail.firstElementChild && (fail.firstElementChild.textContent = 'Oops! Something went wrong while submitting the form.');
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        if (fail) {
          fail.firstElementChild && (fail.firstElementChild.textContent = 'Please enter a valid email address.');
          fail.style.display = 'block';
        }
        input?.focus();
        return;
      }
      const label = btn?.value;
      if (btn) btn.value = btn.dataset.wait || 'Please wait...';
      try {
        const r = await fetch('/api/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, source: 'footer' }),
        });
        if (!r.ok) throw new Error(String(r.status));
        form.style.display = 'none';
        if (done) done.style.display = 'block';
      } catch {
        if (fail) fail.style.display = 'block';
      } finally {
        if (btn) btn.value = label ?? '';
      }
    },
    true
  );
}
