import { ClienteForm } from '@/components/clientes/ClienteForm';

type Props = { params: Promise<{ id: string }> };

export default async function EditarClientePage({ params }: Props) {
  const { id } = await params;
  return <ClienteForm id={id} />;
}
