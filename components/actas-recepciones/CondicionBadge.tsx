import { Badge } from '@/components/ui/Badge';
import type { CondicionItem } from '@/types/api';

const KIND: Record<CondicionItem, 'ok' | 'warn' | 'danger'> = {
  BUENO: 'ok',
  REGULAR: 'warn',
  MALO: 'danger',
};

export function CondicionBadge({ condicion }: { condicion: CondicionItem | null | undefined }) {
  if (!condicion) return <span className="text-tx-3 text-xs">—</span>;
  return <Badge status={condicion} kind={KIND[condicion]} />;
}
