import { useEffect, useRef, useState } from 'react';
import connector from '../sections/space-connector.html?raw';
import { api } from '../api.js';

const ROPE = '/assets/68fdf5d05c02b3bda0b9694b_Group 48254.svg';
const SIDE = '/assets/690c303ae83199ef77960c30_Group 48259.svg';
const STITCH = ['green', 'pink', 'yellow'];

// "A Space to Connect in Person" for a city, in the same design as the home page.
// Content and photos come from Admin > City spaces.
export default function CitySpace({ cityKey, cityName }) {
  const [space, setSpace] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    api(`/api/spaces/${cityKey}`).then(setSpace).catch(() => setSpace(null));
  }, [cityKey]);

  // the thread fades in when the section scrolls into view (same as home page)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) return el.classList.add('visible-line');
    const io = new IntersectionObserver(([e]) => e.isIntersecting && el.classList.add('visible-line'), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [space]);

  if (!space) return null;
  return (
    <section className="vertical_card_section pcw-space" id="the-space" ref={ref} aria-label={`The ${cityName} space`}>
      <div dangerouslySetInnerHTML={{ __html: connector }} style={{ display: 'contents' }} />
      <div className="w-layout-blockcontainer container w-container">
        <div className="centered_image d-sm-none">
          <img alt="" loading="lazy" src={ROPE} />
        </div>
        <div className="bannerwrapper maxwidth948 flex-center padding_54 marginzero">
          <h2 className="heading-2 color_green marginzero max-width_80">{space.title}</h2>
          {space.intro && <p className="body_regular color_green maxwidth512 marginzero">{space.intro}</p>}
        </div>
        <div className="poistion_abs_left-zero d-md-none">
          <img alt="" className="d-md-none tabv-show" loading="lazy" src={SIDE} />
        </div>
        <div className="maxwidth1075">
          <div className="left_right_content">
            {space.cards.map((c, i) => {
              const own = c.image && !c.image.startsWith('/assets/'); // uploaded photo -> add stitch decoration
              return (
                <div className="vertical_cards gridtwo_col" key={i}>
                  <div className={`imagewrapper pt_52-56 pcw-space-img ${own ? `pcw-stitched pcw-stitch-${STITCH[i % 3]}` : ''}`}>
                    {c.image ? (
                      <img alt={`${c.title}, ${cityName} space`} className="image" loading="lazy" src={c.image} />
                    ) : (
                      <div className={`pcw-space-soon pcw-stitch-${STITCH[i % 3]}`}>
                        <span className="pcw-tag-dark">PHOTO COMING SOON</span>
                        <span>{cityName} space</span>
                      </div>
                    )}
                  </div>
                  <div className="contentwrapper">
                    <div className="simple_text w-richtext">
                      <p>
                        <strong>{c.title}</strong>
                      </p>
                      <p>{c.text}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
