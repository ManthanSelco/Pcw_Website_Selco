import { useState } from 'react';
import { ytThumb } from '../api.js';

// YouTube video that plays right here on the website.
// Shows a light thumbnail first; the real player loads only when someone presses play.
export default function YouTube({ id, title, poster = '', autoPlay = false }) {
  const [on, setOn] = useState(autoPlay);
  const [img, setImg] = useState(ytThumb(id));
  if (!id) return null;
  return (
    <div className="pcw-yt">
      {on ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`}
          title={title || 'Video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <button className="pcw-yt-cover" onClick={() => setOn(true)} aria-label={`Play video: ${title || ''}`}>
          {img && <img src={img} alt="" loading="lazy" onError={() => setImg(img !== poster ? poster : '')} />}
          <span className="pcw-yt-play" aria-hidden="true">
            <svg viewBox="0 0 68 48" width="68" height="48">
              <rect width="68" height="48" rx="14" fill="#ff5c39" />
              <path d="M27 15l17 9-17 9z" fill="#feffe8" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
