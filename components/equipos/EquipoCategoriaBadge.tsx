import { Badge } from '@/components/ui/Badge';
import { CATEGORIA_LABELS } from '@/lib/equipos';
import type { CategoriaEquipo } from '@/types/api';

export function EquipoCategoriaBadge({ categoria }: { categoria: CategoriaEquipo }) {
  return <Badge status={CATEGORIA_LABELS[categoria]} kind="neutral" />;
}
