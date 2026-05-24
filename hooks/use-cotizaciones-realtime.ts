'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socket } from '@/lib/socket';

// Variante del realtime de equipos pensada para el wizard de cotizaciones:
// además de equipo:disponibilidad, escucha equipo:rentado (emitido cuando
// otra cotización es aprobada) y refresca tanto el cache de equipos como
// el de la cotización activa para que la fila de un item de equipo no
// quede mostrando una reserva fantasma.
export function useCotizacionesRealtime(cotizacionId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!socket.connected) socket.connect();
    socket.emit('join', 'equipos');

    const onDisponibilidad = () => {
      qc.invalidateQueries({ queryKey: ['equipos'] });
    };
    const onRentado = () => {
      qc.invalidateQueries({ queryKey: ['equipos'] });
      if (cotizacionId) qc.invalidateQueries({ queryKey: ['cotizacion', cotizacionId] });
    };

    socket.on('equipo:disponibilidad', onDisponibilidad);
    socket.on('equipo:rentado', onRentado);
    return () => {
      socket.off('equipo:disponibilidad', onDisponibilidad);
      socket.off('equipo:rentado', onRentado);
    };
  }, [qc, cotizacionId]);
}
