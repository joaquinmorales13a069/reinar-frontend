type FormSectionProps = { title: string; children: React.ReactNode; className?: string };

export function FormSection({ title, children, className = '' }: FormSectionProps) {
  return (
    <div className={`rounded-lg border border-bd bg-surface p-4 mb-4 ${className}`}>
      <h3 className="text-sm font-semibold text-tx mb-3">{title}</h3>
      {children}
    </div>
  );
}
