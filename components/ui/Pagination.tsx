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

  const navBtn = 'inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-tx-2 border border-bd hover:bg-bg-sunken transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-bd text-sm text-tx-2">
      <span className="hidden sm:block text-xs text-tx-3">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
      </span>
      <div className="flex items-center gap-1">
        <button className={navBtn} onClick={() => onPage(page - 1)} disabled={page === 1}>
          Anterior
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e-${i}`} className="px-2 text-xs text-tx-3 hidden sm:block">…</span>
          ) : (
            <button
              key={p}
              className={`hidden sm:inline-flex items-center justify-center w-7 h-7 rounded text-xs transition-colors ${
                p === page
                  ? 'bg-accent text-navy font-semibold'
                  : 'text-tx-2 hover:bg-bg-sunken'
              }`}
              onClick={() => onPage(p as number)}
            >
              {p}
            </button>
          )
        )}
        <button className={navBtn} onClick={() => onPage(page + 1)} disabled={page === totalPages}>
          Siguiente
        </button>
      </div>
    </div>
  );
}
