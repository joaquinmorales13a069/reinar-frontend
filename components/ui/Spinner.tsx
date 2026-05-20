type SpinnerProps = { size?: number; className?: string };

// Wrapper del spinner para poder usarlo tipado en JSX sin escribir el estilo inline cada vez.
export function Spinner({ size = 14, className = '' }: SpinnerProps) {
  return (
    <span
      className={`spin ${className}`}
      style={{
        width: size,
        height: size,
        border: '2px solid currentColor',
        borderTopColor: 'transparent',
        borderRadius: '50%',
      }}
      aria-hidden="true"
    />
  );
}
