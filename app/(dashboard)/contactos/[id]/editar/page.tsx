import { Suspense } from 'react';
import { ContactoForm } from '@/components/contactos/ContactoForm';
import { Spinner } from '@/components/ui/Spinner';

type Props = { params: Promise<{ id: string }> };

export default async function EditarContactoPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="flex justify-center p-12"><Spinner /></div>}>
      <ContactoForm id={id} />
    </Suspense>
  );
}
