import Icon from "./Icon.jsx";

function pageNumbers(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const start = Math.min(Math.max(page - 2, 1), totalPages - 4);
  return Array.from({ length: 5 }, (_, i) => start + i);
}

export default function Pagination({ page, totalPages, total, limit, onChange }) {
  const first = total === 0 ? 0 : (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);
  return (
    <nav className="pagination" aria-label="Pagination">
      <p className="muted small">
        {first} to {last} of {total}
      </p>
      <div className="pagination__pages">
        <button type="button" className="btn btn--small" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <Icon name="chevronLeft" size={14} />
          Previous
        </button>
        {pageNumbers(page, totalPages).map((n) => (
          <button
            key={n}
            type="button"
            className={"btn btn--small pagination__page" + (n === page ? " btn--primary" : "")}
            aria-current={n === page ? "page" : undefined}
            aria-label={"Page " + n}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
        <button type="button" className="btn btn--small" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Next
          <Icon name="chevronRight" size={14} />
        </button>
      </div>
    </nav>
  );
}
