'use client';
import type { Cotizacion } from '@/types/api';
type Props = { cotizacion: Cotizacion; onBack: () => void; onNext: () => void };
export function Step3Terminos(_: Props) {
  return <div className="p-4 bg-bg border border-bd rounded-md text-sm text-tx-3">Step 3 stub</div>;
}
