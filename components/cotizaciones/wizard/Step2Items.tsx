'use client';
import type { Cotizacion } from '@/types/api';
type Props = { cotizacion: Cotizacion; onBack: () => void; onNext: () => void };
export function Step2Items(_: Props) {
  return <div className="p-4 bg-bg border border-bd rounded-md text-sm text-tx-3">Step 2 stub</div>;
}
