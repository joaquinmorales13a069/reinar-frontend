import { DEPARTAMENTOS_SV, MUNICIPIOS_SV, getDistritosByDept } from '@/lib/sv-geo';

const SEP = ', ';

// La ubicación de un Proyecto es "detalle, distrito, departamento" (3 niveles,
// compuesta por UbicacionInput — sin municipio). La dirección de entrega del
// acta usa 4 niveles ("calle, distrito, municipio, departamento", el formato
// de DireccionCompleta). Convertimos best-effort resolviendo el municipio a
// partir del distrito; si algo no matchea los catálogos MH devolvemos el
// string original, que DireccionCompleta deja completo en el campo de calle.
export function ubicacionProyectoADireccionEntrega(ubicacion: string): string {
  const tokens = ubicacion.split(SEP).map((t) => t.trim()).filter(Boolean);
  if (tokens.length < 3) return ubicacion;

  const deptLabel = tokens[tokens.length - 1];
  const distLabel = tokens[tokens.length - 2];
  const detalle = tokens.slice(0, -2).join(SEP);

  const dept = DEPARTAMENTOS_SV.find((d) => d.label === deptLabel);
  if (!dept || !detalle) return ubicacion;

  const dist = getDistritosByDept(dept.value).find((d) => d.label === distLabel);
  if (!dist) return ubicacion;

  const muni = MUNICIPIOS_SV.find(
    (m) => m.value === dist.municipality && m.department === dept.value,
  );
  if (!muni) return ubicacion;

  return `${detalle}${SEP}${dist.label}${SEP}${muni.label}${SEP}${dept.label}`;
}

// Anexa los detalles extra DENTRO de la porción de calle (no al final del
// string) para que el formato de 4 niveles siga siendo parseable por
// DireccionCompleta al editar el acta después.
export function anexarDetalleExtra(direccion: string, extra: string): string {
  const extraTrim = extra.trim();
  if (!extraTrim) return direccion;
  if (!direccion) return extraTrim;

  const tokens = direccion.split(SEP);
  if (tokens.length < 4) return `${direccion} — ${extraTrim}`;

  const calle = tokens.slice(0, -3).join(SEP);
  return [`${calle} — ${extraTrim}`, ...tokens.slice(-3)].join(SEP);
}
