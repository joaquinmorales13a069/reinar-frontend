import { ClienteDetalle } from '@/components/clientes/ClienteDetalle';

type Props = { params: Promise<{ id: string }> };

export default async function ClienteDetallePage({ params }: Props) {
  const { id } = await params;
  return <ClienteDetalle id={id} />;
}
