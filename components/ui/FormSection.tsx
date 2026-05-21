type FormSectionProps = { title: string; children: React.ReactNode; className?: string };

export function FormSection({ title, children, className = '' }: FormSectionProps) {
  return (
    <div className={`card mb-4 ${className}`}>
      <h3 className="card__title mb-3">{title}</h3>
      {children}
    </div>
  );
}
