import { TabsHerramientas } from '@/components/herramientas/TabsHerramientas';

type Props = { searchParams: Promise<{ tab?: string }> };

export default async function HerramientasPage({ searchParams }: Props) {
  // En Next 19 searchParams es async; lo desempaquetamos antes de usarlo
  // para evitar warnings de "sync access to async params".
  const sp = await searchParams;
  const tab = sp.tab === 'consumibles' ? 'consumibles' : 'tipos';
  return <TabsHerramientas activeTab={tab} />;
}
