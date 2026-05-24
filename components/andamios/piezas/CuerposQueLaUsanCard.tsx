'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useCuerpos } from '@/hooks/use-andamios';

type Props = { piezaId: string };

export function CuerposQueLaUsanCard({ piezaId }: Props) {
  // Pedimos incluyendo inactivos: si una pieza está en un cuerpo inactivo, igual
  // es información útil para el usuario que está editando el catálogo.
  const { data: cuerpos, isLoading } = useCuerpos({ incluirInactivos: true });

  const usados = (cuerpos ?? []).filter((c) =>
    c.componentes.some((comp) => comp.piezaTipo.id === piezaId),
  );

  return (
    <Card>
      <h3 className="text-sm font-semibold mb-3">
        Configuraciones que la usan ({usados.length})
      </h3>
      {isLoading && <Spinner />}
      {!isLoading && usados.length === 0 && (
        <p className="text-sm text-tx-3 m-0">
          Esta pieza no está incluida en ninguna configuración.
        </p>
      )}
      {!isLoading && usados.length > 0 && (
        <ul className="m-0 p-0 list-none divide-y divide-bd">
          {usados.map((c) => {
            const comp = c.componentes.find((x) => x.piezaTipo.id === piezaId)!;
            return (
              <li key={c.id} className="flex justify-between py-2">
                <Link
                  href={`/andamios/cuerpos/${c.id}`}
                  className="text-sm hover:text-accent"
                >
                  <div className="font-medium">{c.nombre}</div>
                  <div className="text-xs text-tx-3 font-mono mt-0.5">{c.id}</div>
                </Link>
                <div className="text-right">
                  <div className="font-mono font-semibold">×{comp.cantidad}</div>
                  <div className="text-xs text-tx-3">cant. requerida</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
