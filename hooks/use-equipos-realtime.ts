'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socket } from '@/lib/socket';
import type { EstadoEquipo } from '@/types/api';

type EquipoDisponibilidadPayload = {
  equipoId: string;
  estado: EstadoEquipo;
  updatedAt: string;
};

// Se suscribe a la sala 'equipos' del socket.io y al recibir cambios de
// disponibilidad invalida los queries de equipos. Montar este hook en cualquier
// pantalla que muestre estados de equipos garantiza UI fresca sin polling.
export function useEquiposRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    // Si el socket aún no está conectado (typicamente lo hace el AuthHydrator
    // tras login), lo conectamos aquí. autoConnect es false por seguridad.
    if (!socket.connected) socket.connect();
    socket.emit('join', 'equipos');

    const handler = (payload: EquipoDisponibilidadPayload) => {
      qc.invalidateQueries({ queryKey: ['equipos'] });
      qc.invalidateQueries({ queryKey: ['equipos', payload.equipoId] });
    };

    socket.on('equipo:disponibilidad', handler);
    return () => {
      socket.off('equipo:disponibilidad', handler);
    };
  }, [qc]);
}
