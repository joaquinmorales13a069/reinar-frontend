import { Suspense } from 'react';
import { ContactoForm } from '@/components/contactos/ContactoForm';
import { Spinner } from '@/components/ui/Spinner';

export default function NuevoContactoPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-12"><Spinner /></div>}>
      <ContactoForm />
    </Suspense>
  );
}
