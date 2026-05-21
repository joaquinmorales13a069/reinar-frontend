'use client';

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
};

export function Pagination({ page, pageSize, total, onPage }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const pages: (number | '…')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) pages.push(i);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-bd text-sm text-tx-2">
      <span className="hidden sm:block">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
      </span>
      <div className="flex items-center gap-1">
        <button className="btn btn--ghost btn--sm" onClick={() => onPage(page - 1)} disabled={page === 1}>
          Anterior
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e-${i}`} className="px-2 hidden sm:block">…</span>
          ) : (
            <button
              key={p}
              className={`hidden sm:flex icon-btn ${p === page ? 'is-active' : ''}`}
              onClick={() => onPage(p as number)}
            >
              {p}
            </button>
          )
        )}
        <button className="btn btn--ghost btn--sm" onClick={() => onPage(page + 1)} disabled={page === totalPages}>
          Siguiente
        </button>
      </div>
    </div>
  );
}
