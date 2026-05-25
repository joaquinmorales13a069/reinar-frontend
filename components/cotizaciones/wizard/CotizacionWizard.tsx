'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { useCotizacion } from '@/hooks/use-cotizaciones';
import { useCotizacionesRealtime } from '@/hooks/use-cotizaciones-realtime';
import { Step1Cliente } from './Step1Cliente';
import { Step2Items } from './Step2Items';
import { Step3Terminos } from './Step3Terminos';
import { Step4Resumen } from './Step4Resumen';
import type { Cotizacion } from '@/types/api';

type StepId = 0 | 1 | 2 | 3;

const STEPS: { id: StepId; label: string }[] = [
  { id: 0, label: 'Cliente y proyecto' },
  { id: 1, label: 'Ítems' },
  { id: 2, label: 'Términos' },
  { id: 3, label: 'Resumen' },
];

type Props = {
  // Si viene id, estamos en modo editar; si no, en modo crear.
  cotizacionId?: string;
  // Paso inicial — al editar arrancamos en 0 (cliente) por defecto, pero el
  // caller puede saltar al paso que desee.
  initialStep?: StepId;
};

export function CotizacionWizard({ cotizacionId, initialStep = 0 }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState<StepId>(initialStep);
  const [activeId, setActiveId] = useState<string | undefined>(cotizacionId);

  // Suscribe al socket para que el picker de equipos del Paso 2 vea cambios
  // de disponibilidad en vivo sin polling.
  useCotizacionesRealtime(activeId);

  const cotizacionQ = useCotizacion(activeId);
  const cot = cotizacionQ.data;

  // Si llegamos en modo editar y el borrador ya no está en BORRADOR, el
  // backend rechazará cualquier mutación: bloqueamos la UI antes de intentar.
  useEffect(() => {
    if (cot && cot.estado !== 'BORRADOR') {
      router.replace(`/cotizaciones/${cot.id}`);
    }
  }, [cot, router]);

  // Al crear la cotización por primera vez (al final del paso 1), actualizamos
  // la URL para que recargar el browser no pierda el borrador.
  //
  // Usamos `window.history.replaceState` en vez de `router.replace` porque
  // navegar de /cotizaciones/nueva a /cotizaciones/{id}/editar dispara remount
  // del componente (son dos page.tsx distintos): el setStep(1) se ejecutaba
  // en el componente que se desmontaba y el nuevo arrancaba en step 0,
  // obligando al usuario a hacer click en "Siguiente" dos veces.
  //
  // Además seedea el cache de React Query con la cotización recién devuelta
  // por el POST para que useCotizacion(id) tenga `data` al instante y el Step 2
  // no quede en blanco esperando el GET.
  function handleCotizacionCreated(created: Cotizacion) {
    qc.setQueryData(['cotizacion', created.id], created);
    setActiveId(created.id);
    window.history.replaceState(null, '', `/cotizaciones/${created.id}/editar`);
    setStep(1);
  }

  function goTo(next: StepId) {
    // Solo permitimos volver hacia atrás libremente; avanzar requiere el botón
    // "Siguiente" de cada paso (que valida y persiste).
    if (next < step) setStep(next);
  }

  if (cotizacionId && cotizacionQ.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={cot ? `Editar ${cot.numeroCotizacion}` : 'Nueva cotización'}
        subtitle={cot ? 'Solo se pueden editar borradores.' : 'Completá los 4 pasos para emitir una cotización.'}
        back
        backLabel="Cancelar"
        onBack={() => router.push('/cotizaciones')}
      />

      <Stepper current={step} onClick={goTo} />

      <div className="mt-6">
        {step === 0 && (
          <Step1Cliente
            cotizacion={cot ?? null}
            onCreated={handleCotizacionCreated}
            onUpdated={() => setStep(1)}
          />
        )}
        {step === 1 && cot && (
          <Step2Items
            cotizacion={cot}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && cot && (
          <Step3Terminos
            cotizacion={cot}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && cot && (
          <Step4Resumen
            cotizacion={cot}
            onBack={() => setStep(2)}
          />
        )}
      </div>
    </div>
  );
}

function Stepper({ current, onClick }: { current: StepId; onClick: (s: StepId) => void }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-4 overflow-x-auto pb-2">
      {STEPS.map((s, i) => {
        const isActive = s.id === current;
        const isDone = s.id < current;
        const dotCls = isActive
          ? 'bg-accent text-navy border-accent'
          : isDone
            ? 'bg-ok-soft text-ok border-ok-soft'
            : 'bg-bg-sunken text-tx-3 border-bd';
        return (
          <li key={s.id} className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={!isDone}
              onClick={() => onClick(s.id)}
              className={`flex items-center gap-2 text-sm ${isDone ? 'cursor-pointer' : ''}`}
            >
              <span className={`w-6 h-6 inline-flex items-center justify-center rounded-full border text-xs font-semibold ${dotCls}`}>
                {isDone ? <Icon name="check" size={12} /> : i + 1}
              </span>
              <span className={isActive ? 'text-tx font-medium' : 'text-tx-2'}>{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <span className={`w-6 sm:w-10 h-px ${isDone ? 'bg-ok' : 'bg-bd'}`} />}
          </li>
        );
      })}
    </ol>
  );
}
