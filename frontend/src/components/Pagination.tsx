type PaginationProps = {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, limit, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
      <p className="text-muted">
        {total} registro{total === 1 ? '' : 's'} · página {page} de {totalPages}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded px-3 py-1 text-ink hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded px-3 py-1 text-ink hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
