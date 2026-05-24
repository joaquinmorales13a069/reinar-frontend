'use client';
import type { Cotizacion } from '@/types/api';
type Props = {
  cotizacion: Cotizacion | null;
  onCreated: (id: string) => void;
  onUpdated: () => void;
};
export function Step1Cliente(_: Props) {
  return <div className="p-4 bg-bg border border-bd rounded-md text-sm text-tx-3">Step 1 stub</div>;
}
