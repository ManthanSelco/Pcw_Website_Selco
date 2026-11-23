import { useEffect, useState } from 'react';
import { useAdmin } from './AdminApp.jsx';

const DEFAULT_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLScu0Rj-afE8XjFxZjLldXBF4JNQ0GywJl329n9rbpgaVySreg/viewform';

export default function Settings() {
  const { call, notify, me } = useAdmin();
  const [url, setUrl] = useState(null);
  const [seo, setSeo] = useState({ googleVerification: '', bingVerification: '' });
  const [seoErr, setSeoErr] = useState({});
  const [seoBusy, setSeoBusy] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    call('/api/admin/site')
      .then((s) => {
        setUrl(s.bookingUrl);
        setSeo({ googleVerification: s.googleVerification || '', bingVerification: s.bingVerification || '' });
      })
      .catch(() => setUrl(''));
  }, [call]);

  async function save(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const s = await call('/api/admin/site', { ...seo, bookingUrl: url.trim() }, 'PUT');
      setUrl(s.bookingUrl);
      notify('Booking form link saved');
    } catch (x) {
      setErr(x.errors?.bookingUrl || x.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveSeo(e) {
    e.preventDefault();
    setSeoErr({});
    setSeoBusy(true);
    try {
      const s = await call('/api/admin/site', { ...seo, bookingUrl: url || '' }, 'PUT');
      setSeo({ googleVerification: s.googleVerification, bingVerification: s.bingVerification });
      notify('Search settings saved');
    } catch (x) {
      setSeoErr(x.errors || { googleVerification: x.message });
    } finally {
      setSeoBusy(false);
    }
  }
  const origin = window.location.origin;

  return (
    <>
      <div className="adm-head">
        <h1>Settings</h1>
      </div>

      <form className="adm-card adm-form adm-narrow" onSubmit={save} noValidate>
        <h2>“Book the space” form</h2>
        <p className="adm-muted">Every “Book the space” button on the Bangalore and Guwahati pages opens this form in a new tab.</p>
        {url === null ? (
          <div className="adm-loading" />
        ) : (
          <>
            <div className={`adm-field is-wide ${err ? 'has-error' : ''}`}>
              <label>
                <span className="adm-label">Google Form link</span>
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/forms/…" inputMode="url" />
              </label>
              {err ? <span className="adm-field-error">{err}</span> : <span className="adm-hint">Leave empty to use the default PCW booking form.</span>}
            </div>
            <div className="adm-row">
              <button className="adm-btn adm-btn-primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save link'}
              </button>
              <a className="adm-btn adm-btn-ghost" href={url || DEFAULT_FORM} target="_blank" rel="noreferrer">
                Open form ↗
              </a>
            </div>
          </>
        )}
      </form>

      <form className="adm-card adm-form adm-narrow" onSubmit={saveSeo} noValidate>
        <h2>Google and AI search (SEO / AEO)</h2>
        <p className="adm-muted">
          Every page already sends Google and AI assistants (ChatGPT, Perplexity, Gemini, Claude) its title, description, share preview and structured data. To
          show up faster, add the website in{' '}
          <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer">
            Google Search Console
          </a>{' '}
          and{' '}
          <a href="https://www.bing.com/webmasters" target="_blank" rel="noreferrer">
            Bing Webmaster Tools
          </a>{' '}
          (Bing also feeds ChatGPT search), choose the “HTML tag” method, paste the code here, then submit the sitemap.
        </p>
        <div className={`adm-field is-wide ${seoErr.googleVerification ? 'has-error' : ''}`}>
          <label>
            <span className="adm-label">Google verification code</span>
            <input value={seo.googleVerification} onChange={(e) => setSeo((s) => ({ ...s, googleVerification: e.target.value }))} placeholder='Paste the code or the whole <meta name="google-site-verification" …> tag' />
          </label>
          {seoErr.googleVerification && <span className="adm-field-error">{seoErr.googleVerification}</span>}
        </div>
        <div className={`adm-field is-wide ${seoErr.bingVerification ? 'has-error' : ''}`}>
          <label>
            <span className="adm-label">Bing verification code</span>
            <input value={seo.bingVerification} onChange={(e) => setSeo((s) => ({ ...s, bingVerification: e.target.value }))} placeholder='Paste the code or the whole <meta name="msvalidate.01" …> tag' />
          </label>
          {seoErr.bingVerification && <span className="adm-field-error">{seoErr.bingVerification}</span>}
        </div>
        <div className="adm-row">
          <button className="adm-btn adm-btn-primary" disabled={seoBusy || url === null}>
            {seoBusy ? 'Saving…' : 'Save codes'}
          </button>
        </div>
        <p className="adm-muted">Files for search engines (they update by themselves when you add events or recordings):</p>
        <ul className="adm-links">
          <li>
            <a href="/sitemap.xml" target="_blank" rel="noreferrer">{origin}/sitemap.xml</a>: submit this in Search Console and Bing
          </li>
          <li>
            <a href="/robots.txt" target="_blank" rel="noreferrer">{origin}/robots.txt</a>: lets Google and AI crawlers in, keeps the admin panel out
          </li>
          <li>
            <a href="/llms.txt" target="_blank" rel="noreferrer">{origin}/llms.txt</a>: a short summary of PCW for AI assistants
          </li>
        </ul>
      </form>

      <section className="adm-card adm-form adm-narrow">
        <h2>Admin login</h2>
        <p className="adm-muted">
          Login ID: <b>{me.username}</b>
        </p>
        <p className="adm-muted">
          The login ID and password are set in the file <code>server/.env</code>:
        </p>
        <pre className="adm-code">{`ADMIN_USERNAME=${me.username}\nADMIN_PASSWORD=your-new-password`}</pre>
        <p className="adm-muted">Change these two lines, save the file and restart the server. The new login works right away.</p>
      </section>
    </>
  );
}
