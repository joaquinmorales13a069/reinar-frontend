'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socket } from '@/lib/socket';

// Suscribe al usuario autenticado a la sala 'actas' e invalida queries cuando
// el backend emite cambios. Sin toasts: si vos disparaste la acción ya viste el
// toast de éxito; si fue otro usuario, el refresh silencioso es lo correcto en
// un equipo operativo (5-10 personas) para no fatigarlos con notificaciones.
export function useActasRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    if (!socket.connected) socket.connect();
    socket.emit('join', 'actas');

    const onDespachada = ({ actaId, facturaId }: { actaId: string; facturaId: string }) => {
      qc.invalidateQueries({ queryKey: ['acta', actaId] });
      qc.invalidateQueries({ queryKey: ['actas'] });
      qc.invalidateQueries({ queryKey: ['actas-de-factura', facturaId] });
    };
    const onEntregada = ({ actaId, facturaId }: { actaId: string; facturaId: string }) => {
      qc.invalidateQueries({ queryKey: ['acta', actaId] });
      qc.invalidateQueries({ queryKey: ['actas'] });
      qc.invalidateQueries({ queryKey: ['actas-de-factura', facturaId] });
      qc.invalidateQueries({ queryKey: ['items-pendientes-devolucion', facturaId] });
    };
    const onRecepcion = ({ facturaId }: { recepcionId: string; facturaId: string }) => {
      qc.invalidateQueries({ queryKey: ['recepciones'] });
      qc.invalidateQueries({ queryKey: ['recepciones-de-factura', facturaId] });
      qc.invalidateQueries({ queryKey: ['items-pendientes-devolucion', facturaId] });
      qc.invalidateQueries({ queryKey: ['acta'] });
      qc.invalidateQueries({ queryKey: ['actas'] });
    };

    socket.on('acta:despachada', onDespachada);
    socket.on('acta:entregada', onEntregada);
    socket.on('recepcion:registrada', onRecepcion);

    return () => {
      socket.off('acta:despachada', onDespachada);
      socket.off('acta:entregada', onEntregada);
      socket.off('recepcion:registrada', onRecepcion);
      socket.emit('leave', 'actas');
    };
  }, [qc]);
}
