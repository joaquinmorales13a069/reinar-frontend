'use client';

// Centraliza el patrón fetch-blob → createObjectURL → click → revoke
// que se repite en facturas, cotizaciones, actas y recepciones. Usar este
// helper en cualquier descarga de PDF nueva para evitar drift de estilo.
import { toast } from 'sonner';
import api from '@/lib/api';

function extractMsg(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: { message?: string } } } };
  return e?.response?.data?.error?.message ?? fallback;
}

export async function descargarPdf(opts: {
  url: string;
  filename: string;
  onStart?: () => void;
  onEnd?: () => void;
}): Promise<void> {
  const toastId = toast.loading('Generando PDF…');
  opts.onStart?.();
  try {
    const res = await api.get(opts.url, { responseType: 'blob' });
    const objectUrl = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = opts.filename;
    a.click();
    URL.revokeObjectURL(objectUrl);
    toast.dismiss(toastId);
  } catch (err) {
    toast.dismiss(toastId);
    toast.error(extractMsg(err, 'No se pudo descargar el PDF.'));
  } finally {
    opts.onEnd?.();
  }
}
