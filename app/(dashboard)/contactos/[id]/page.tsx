import { ContactoDetalle } from '@/components/contactos/ContactoDetalle';

type Props = { params: Promise<{ id: string }> };

export default async function ContactoDetallePage({ params }: Props) {
  const { id } = await params;
  return <ContactoDetalle id={id} />;
}
