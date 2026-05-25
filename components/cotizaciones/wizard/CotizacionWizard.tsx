'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { useCotizacion } from '@/hooks/use-cotizaciones';
import { useCotizacionesRealtime } from '@/hooks/use-cotizaciones-realtime';
import { Step1Cliente } from './Step1Cliente';
import { Step2Items } from './Step2Items';
import { Step3Terminos } from './Step3Terminos';
import { Step4Resumen } from './Step4Resumen';
import type { Cotizacion, EstadoCotizacion } from '@/types/api';

type StepId = 0 | 1 | 2 | 3;

const STEPS: { id: StepId; label: string }[] = [
  { id: 0, label: 'Cliente y proyecto' },
  { id: 1, label: 'Ítems' },
  { id: 2, label: 'Términos' },
  { id: 3, label: 'Resumen' },
];

// Estados en los que la cotización ya no es editable y debemos enviar al
// usuario al detalle solo-lectura.
const ESTADOS_NO_EDITABLES: EstadoCotizacion[] = ['ENVIADA', 'APROBADA', 'RECHAZADA'];

type Props = {
  // Si viene id, estamos en modo editar; si no, en modo crear.
  cotizacionId?: string;
  // Paso inicial — al editar arrancamos en 0 (cliente) por defecto, pero el
  // caller puede saltar al paso que desee.
  initialStep?: StepId;
};

export function CotizacionWizard({ cotizacionId, initialStep = 0 }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<StepId>(initialStep);
  const [activeId, setActiveId] = useState<string | undefined>(cotizacionId);

  // Suscribe al socket para que el picker de equipos del Paso 2 vea cambios
  // de disponibilidad en vivo sin polling.
  useCotizacionesRealtime(activeId);

  const cotizacionQ = useCotizacion(activeId);
  const cot = cotizacionQ.data;

  // Si la cotizacion paso a un estado no editable, redirigimos al detalle.
  // Comprobacion explicita contra la lista (no negacion de BORRADOR) para
  // evitar falsos positivos cuando cot.estado fuera undefined por algun
  // shape parcial transitorio en el cache.
  useEffect(() => {
    if (cot && cot.estado && ESTADOS_NO_EDITABLES.includes(cot.estado)) {
      router.replace(`/cotizaciones/${cot.id}`);
    }
  }, [cot, router]);

  // Al crear la cotizacion en el paso 1, solo seteamos el activeId y avanzamos
  // al paso 2. NO seedeamos el cache de React Query con la respuesta del POST:
  // si por alguna razon (backend desactualizado, version vieja en memoria,
  // codigo mid-deploy) la respuesta no es shape completo, el cache queda
  // contaminado con un objeto invalido (numeroCotizacion undefined, items
  // undefined, etc.) y la UI se rompe en cascada.
  //
  // Dejamos que useCotizacion(id) haga el GET y traiga la cotizacion completa.
  // El spinner intermedio (esperandoCotizacion) cubre los milisegundos de
  // latencia. Trade-off: un round-trip extra a cambio de robustez total
  // contra inconsistencias del servidor.
  function handleCotizacionCreated(created: Cotizacion) {
    setActiveId(created.id);
    setStep(1);
  }

  // Defensa contra cache contaminado: si llegamos a un cot que falta campos
  // obligatorios (numeroCotizacion, items), lo tratamos como invalido y
  // forzamos re-fetch. Indicador de que el shape recibido era parcial.
  const cotValido = cot && cot.numeroCotizacion && Array.isArray(cot.items);

  function goTo(next: StepId) {
    // Solo permitimos volver hacia atrás libremente; avanzar requiere el botón
    // "Siguiente" de cada paso (que valida y persiste).
    if (next < step) setStep(next);
  }

  // Spinner inicial cuando entramos al wizard en modo editar y aun no llego
  // el GET del detalle.
  if (cotizacionId && cotizacionQ.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  // Si estamos en step > 0 pero el cache aun no tiene cot valido (GET en vuelo
  // tras la creacion, o cache contaminado en proceso de re-fetch), mostramos
  // spinner en vez de dejar el contenido vacio o caer en TypeError por
  // cot.items o cot.numeroCotizacion undefined.
  const esperandoCotizacion = step > 0 && !cotValido;

  // cotPlanoSeguro: solo lo usamos en lugares que requieren cot definido.
  // Cuando cotValido es false, los steps 1+ caen al spinner antes de leerlo.
  const cotSeguro = cotValido ? cot : null;

  return (
    <div>
      <PageHeader
        title={cotSeguro ? `Editar ${cotSeguro.numeroCotizacion}` : 'Nueva cotización'}
        subtitle={cotSeguro ? 'Solo se pueden editar borradores.' : 'Completá los 4 pasos para emitir una cotización.'}
        back
        backLabel="Cancelar"
        onBack={() => router.push('/cotizaciones')}
      />

      <Stepper current={step} onClick={goTo} />

      <div className="mt-6">
        {esperandoCotizacion ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <>
            {step === 0 && (
              <Step1Cliente
                cotizacion={cotSeguro}
                onCreated={handleCotizacionCreated}
                onUpdated={() => setStep(1)}
              />
            )}
            {step === 1 && cotSeguro && (
              <Step2Items
                cotizacion={cotSeguro}
                onBack={() => setStep(0)}
                onNext={() => setStep(2)}
              />
            )}
            {step === 2 && cotSeguro && (
              <Step3Terminos
                cotizacion={cotSeguro}
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
              />
            )}
            {step === 3 && cotSeguro && (
              <Step4Resumen
                cotizacion={cotSeguro}
                onBack={() => setStep(2)}
              />
            )}
          </>
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
