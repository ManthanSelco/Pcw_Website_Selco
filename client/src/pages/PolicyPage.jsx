import SiteChrome from '../components/SiteChrome.jsx';
import contact from '../sections/policy-contact-us.html?raw';
import privacy from '../sections/policy-privacy-policy.html?raw';
import terms from '../sections/policy-terms-of-use.html?raw';
import '../styles/pages.css';

// Contact us, Privacy Policy, Terms of Use: same layout and text as the original Webflow pages,
// but inside our own site so the nav and footer links work.
export const POLICIES = {
  'contact-us': { title: 'Contact Us', html: contact, nav: 'contact-us' },
  'privacy-policy': { title: 'Privacy Policy', html: privacy },
  'terms-of-use': { title: 'Terms of Use', html: terms },
};

export default function PolicyPage({ slug }) {
  const page = POLICIES[slug];
  return (
    <SiteChrome active={page.nav} light>
      <section className="page-wrapper pcw-policy">
        <div className="w-layout-blockcontainer container w-container">
          <div className="div-block-12">
            <h1 className="heading-1 color_green">{page.title}</h1>
          </div>
          <div className="full-content w-richtext" dangerouslySetInnerHTML={{ __html: page.html }} />
        </div>
      </section>
    </SiteChrome>
  );
}
