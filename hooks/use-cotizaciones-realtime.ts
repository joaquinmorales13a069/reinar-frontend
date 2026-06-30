'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socket } from '@/lib/socket';

// Variante del realtime de equipos pensada para el wizard de cotizaciones:
// escucha equipo:disponibilidad (emitido cuando otra cotización es aprobada)
// y refresca tanto el cache de equipos como el de la cotización activa para
// que la UI refleje el estado real sin que el usuario tenga que recargar.
export function useCotizacionesRealtime(cotizacionId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!socket.connected) socket.connect();
    socket.emit('join', 'equipos');

    // equipo:disponibilidad se emite al aprobar o cancelar una cotización.
    // Invalidamos equipos (para la lista del modal) y la cotización activa
    // (para reflejar que otro cliente ya tomó un equipo).
    const onDisponibilidad = () => {
      qc.invalidateQueries({ queryKey: ['equipos'] });
      if (cotizacionId) qc.invalidateQueries({ queryKey: ['cotizacion', cotizacionId] });
    };

    socket.on('equipo:disponibilidad', onDisponibilidad);
    return () => {
      socket.off('equipo:disponibilidad', onDisponibilidad);
    };
  }, [qc, cotizacionId]);
}
