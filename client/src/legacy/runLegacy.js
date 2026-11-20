// Runs the original Webflow page scripts, in the same order as on the Webflow site,
// after React has put the page markup on the screen.
import order from './order.json';

const code = import.meta.glob('./*.js', { query: '?raw', import: 'default', eager: true });
const src = (name) => code[`./${name}.js`];

function runInline(name) {
  const s = document.createElement('script');
  s.dataset.pcw = name;
  s.textContent = src(name);
  document.body.appendChild(s);
}

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.async = false;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load ' + url));
    document.body.appendChild(s);
  });
}

let started = null;
export function runLegacyScripts() {
  if (started) return started;
  // The page's loader script waits for window "load"; it may already have fired.
  window.__pcwOnLoad = (fn) => {
    if (document.readyState === 'complete') setTimeout(fn, 0);
    else window.addEventListener('load', fn, { once: true });
  };
  started = (async () => {
    order.embeds.forEach(runInline); // custom code embeds inside the page
    for (const url of order.libs) await loadScript(url); // jQuery, Webflow, Lenis
    order.end.forEach(runInline); // loader, mobile menu, scroll scenes
  })().catch((e) => console.error('[pcw]', e));
  return started;
}
