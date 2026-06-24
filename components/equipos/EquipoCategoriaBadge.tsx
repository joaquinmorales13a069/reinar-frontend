import { Badge } from '@/components/ui/Badge';

export function EquipoCategoriaBadge({ nombre }: { nombre?: string }) {
  return <Badge status={nombre ?? '—'} kind="neutral" />;
}
