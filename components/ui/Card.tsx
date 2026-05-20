type CardProps = {
  children: React.ReactNode;
  flush?: boolean;
  className?: string;
};

type CardHeadProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

export function Card({ children, flush, className = '' }: CardProps) {
  return (
    <div className={`card ${flush ? 'card--flush' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function CardHead({ title, subtitle, actions }: CardHeadProps) {
  return (
    <div className="card__head">
      <div>
        <h2 className="card__title">{title}</h2>
        {subtitle && <p className="card__sub">{subtitle}</p>}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );
}

export function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="card__body">{children}</div>;
}
