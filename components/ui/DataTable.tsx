type DataTableProps = {
  children: React.ReactNode;
  className?: string;
};

export function DataTable({ children, className = '' }: DataTableProps) {
  return (
    <div className={`table-wrap ${className}`} style={{ borderTop: 0, borderRadius: '0 0 4px 4px' }}>
      <div className="overflow-x-auto">
        <table className="table">{children}</table>
      </div>
    </div>
  );
}
