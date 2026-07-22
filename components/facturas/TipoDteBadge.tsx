import { Badge } from '@/components/ui/Badge';
import type { TipoDTE } from '@/types/api';

const META: Record<TipoDTE, { label: string; kind: 'neutral' | 'info' | 'accent' }> = {
  FC:              { label: 'FC',  kind: 'info' },
  CCF:             { label: 'CCF', kind: 'neutral' },
  SUJETO_EXCLUIDO: { label: 'FSE', kind: 'neutral' },
  FEX:             { label: 'FEX', kind: 'accent' },
};

export function TipoDteBadge({ tipo }: { tipo: TipoDTE }) {
  const { label, kind } = META[tipo];
  return <Badge status={label} kind={kind} />;
}
