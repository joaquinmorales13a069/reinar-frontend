import type { CotizacionListItem } from '@/types/api';

type Props = {
  data: CotizacionListItem[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
};

export function CotizacionesTabla(_: Props) {
  return null;
}
