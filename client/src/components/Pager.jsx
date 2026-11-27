// Page numbers under a list of cards: ‹ 1 2 3 … 9 ›
export const PER_PAGE = 8;

function pageList(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pages - 1, page + 1);
  if (from > 2) out.push('…');
  for (let i = from; i <= to; i++) out.push(i);
  if (to < pages - 1) out.push('…');
  out.push(pages);
  return out;
}

export default function Pager({ page, total, perPage = PER_PAGE, onPage, label }) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  const first = (page - 1) * perPage + 1;
  const last = Math.min(total, page * perPage);
  return (
    <nav className="pcw-pager" aria-label={`${label} pages`}>
      <p className="pcw-pager-count">
        Showing {first}–{last} of {total}
      </p>
      <div className="pcw-pager-btns">
        <button className="pcw-pager-arrow" onClick={() => onPage(page - 1)} disabled={page === 1} aria-label="Previous page">
          ‹
        </button>
        {pageList(page, pages).map((p, i) =>
          p === '…' ? (
            <span key={`gap${i}`} className="pcw-pager-gap" aria-hidden="true">
              …
            </span>
          ) : (
            <button key={p} className={p === page ? 'is-on' : ''} aria-current={p === page ? 'page' : undefined} aria-label={`Page ${p}`} onClick={() => onPage(p)}>
              {p}
            </button>
          )
        )}
        <button className="pcw-pager-arrow" onClick={() => onPage(page + 1)} disabled={page === pages} aria-label="Next page">
          ›
        </button>
      </div>
    </nav>
  );
}
