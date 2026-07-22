// CAT-028 Régimen de exportación. El `value` es el código EXACTO que FacturaLlama
// acepta en `taxRegimen` del FEX: formato `EX-<N>.<código MH>` (EX-1 definitiva,
// EX-2 temporal, EX-3 reexportación). Son los 56 régimenes que admite FacturaLlama.
// Debe coincidir con server/src/lib/cat028.ts.
export type Regimen = { value: string; label: string }

export const CAT028: Regimen[] = [
  { value: 'EX-1.1000.000', label: 'Exportación Definitiva, Régimen Común' },
  { value: 'EX-1.1040.000', label: 'Exportación Definitiva Sustitución de Mercancías, Régimen Común' },
  { value: 'EX-1.1041.020', label: 'Exportación Definitiva Proveniente de Franquicia Provisional, Franq. Presidenciales exento de DAI' },
  { value: 'EX-1.1041.021', label: 'Exportación Definitiva Proveniente de Franquicia Provisional, Franq. Presidenciales exento de DAI e IVA' },
  { value: 'EX-1.1048.025', label: 'Exportación Definitiva Proveniente de Franquicia Definitiva, Maquinaria y Equipo LZF. DPA' },
  { value: 'EX-1.1048.031', label: 'Exportación Definitiva Proveniente de Franquicia Definitiva, Distribución Internacional' },
  { value: 'EX-1.1048.032', label: 'Exportación Definitiva Proveniente. de Franquicia Definitiva, Operaciones Internacionales de Logística' },
  { value: 'EX-1.1048.033', label: 'Exportación Definitiva Proveniente de Franquicia Definitiva, Centro Internacional de llamadas(Call Center)' },
  { value: 'EX-1.1048.034', label: 'Exportación Definitiva Proveniente de Franquicia Definitiva, Tecnologias de Información LSI' },
  { value: 'EX-1.1048.035', label: 'Exportación Definitiva Proveniente de Franquicia Definitiva, Investigación y Desarrollo LSI' },
  { value: 'EX-1.1048.036', label: 'Exportación Definitiva Proveniente de Franquicia Definitiva, Reparación y Mantenimiento de Embarcaciones Marítimas LSI' },
  { value: 'EX-1.1048.037', label: 'Exportación Definitiva Proveniente de Franquicia Definitiva, Reparación y Mantenimiento de Aeronaves LSI' },
  { value: 'EX-1.1048.038', label: 'Exportación Definitiva Proveniente de Franquicia Definitiva, Procesos Empresariales LSI' },
  { value: 'EX-1.1048.039', label: 'Exportación Definitiva Proveniente de Franquicia Definitiva, Servicios Medico-Hospitalarios LSI' },
  { value: 'EX-1.1048.040', label: 'Exportación Definitiva Proveniente de Franquicia Definitiva, Servicios Financieros Internacionales LSI' },
  { value: 'EX-1.1048.043', label: 'Exportación Definitiva Proveniente de Franquicia Definitiva, Reparación y Mantenimiento de Contenedores LSI' },
  { value: 'EX-1.1048.044', label: 'Exportación Definitiva Proveniente de Franquicia Definitiva, Reparación de Equipos Tecnológicos LSI' },
  { value: 'EX-1.1048.054', label: 'Exportación Definitiva Proveniente de Franquicia Definitiva, Atención Ancianos y Convalecientes LSI' },
  { value: 'EX-1.1048.055', label: 'Exportación Definitiva Proveniente de Franquicia Definitiva, Telemedicina LSI' },
  { value: 'EX-1.1048.056', label: 'Exportación Definitiva Proveniente de Franquicia Definitiva, Cinematografía LSI' },
  { value: 'EX-1.1052.000', label: 'Exportación Definitiva de DPA con origen en Compras Locales, Régimen Común' },
  { value: 'EX-1.1054.000', label: 'Exportación Definitiva de Zona Franca con origen en Compras Locales, Régimen Común' },
  { value: 'EX-1.1100.000', label: 'Exportación Definitiva de Envíos de Socorro , Régimen Común' },
  { value: 'EX-1.1200.000', label: 'Exportación Definitiva de Envíos Postales, Régimen Común' },
  { value: 'EX-1.1300.000', label: 'Exportación Definitiva Envíos que  requieren despacho urgente, Régimen Común' },
  { value: 'EX-1.1400.000', label: 'Exportación Definitiva  Courier, Régimen Común' },
  { value: 'EX-1.1400.011', label: 'Exportación Definitiva  Courier, Muestras Sin Valor Comercial' },
  { value: 'EX-1.1400.012', label: 'Exportación Definitiva  Courier, Material Publicitario' },
  { value: 'EX-1.1400.017', label: 'Exportación Definitiva  Courier, Declaración de Documentos' },
  { value: 'EX-1.1500.000', label: 'Exportación Definitiva Menaje de casa, Régimen Común' },
  { value: 'EX-2.2100.000', label: 'Exportación Temporal para Perfeccionamiento Pasivo, Régimen Común' },
  { value: 'EX-2.2200.000', label: 'Exportación Temporal con Reimportación en el mismo estado, Régimen Común' },
  { value: 'EX-2.2400.000', label: 'Traslados Definitivos' },
  { value: 'EX-3.3050.000', label: 'Reexportación Proveniente de Importación Temporal, Régimen Común' },
  { value: 'EX-3.3051.000', label: 'Reexportación Proveniente de Tiendas Libres, Régimen Común' },
  { value: 'EX-3.3052.000', label: 'Reexportación Proveniente de Admisión Temporal para Perfeccionamiento Activo, Régimen Común' },
  { value: 'EX-3.3053.000', label: 'Reexportación Proveniente de Admisión Temporal, Régimen Común' },
  { value: 'EX-3.3054.000', label: 'Reexportación Proveniente de Régimen de Zona Franca, Régimen Común' },
  { value: 'EX-3.3055.000', label: 'Reexportación Proveniente de Admisión Temporal para Perfeccionamiento Activo con Garantía, Régimen Común' },
  { value: 'EX-3.3056.000', label: 'Reexportación Proveniente de Admisión Temporal Distribución Internacional Parque de Servicios, Régimen Común' },
  { value: 'EX-3.3056.057', label: 'Reexportación Proveniente de Admisión Temporal Distribución Internacional Parque de Servicios, Remisión entre Usuarios Directos del Mismo Parque de Servicios' },
  { value: 'EX-3.3056.058', label: 'Reexportación Proveniente de Admisión Temporal Distribución Internacional Parque de Servicios, Remisión entre Usuarios Directos de Diferente Parque de Servicios' },
  { value: 'EX-3.3056.072', label: 'Reexportación Proveniente de Admisión Temporal Distribución Internacional Parque de Servicios, Decreto 738 Eléctricos e Híbridos' },
  { value: 'EX-3.3057.000', label: 'Reexportación Proveniente de Admisión Temporal Operaciones Internacional de Logística Parque de Servicios, Régimen Común' },
  { value: 'EX-3.3057.057', label: 'Reexportación Proveniente de Admisión Temporal Operaciones Internacional de Logística Parque de Servicios, Remisión entre Usuarios Directos del Mismo Parque de Servicios' },
  { value: 'EX-3.3057.058', label: 'Reexportación Proveniente de Admisión Temporal Operaciones Internacional de Logística Parque de Servicios, Remisión entre Usuarios Directos de Diferente Parque de Servicios' },
  { value: 'EX-3.3058.033', label: 'Reexportación Proveniente de Admisión Temporal Centro Servicio LSI, Centro Internacional de llamadas(Call Center)' },
  { value: 'EX-3.3058.036', label: 'Reexportación Proveniente de Admisión Temporal Centro Servicio LSI, Reparación y Mantenimiento de Embarcaciones Marítimas LSI' },
  { value: 'EX-3.3058.037', label: 'Reexportación Proveniente de Admisión Temporal Centro Servicio LSI, Reparación y Mantenimiento de Aeronaves LSI' },
  { value: 'EX-3.3058.043', label: 'Reexportación Proveniente de Admisión Temporal Centro Servicio LSI, Reparación y Mantenimiento de Contenedores LSI' },
  { value: 'EX-3.3059.000', label: 'Reexportación Proveniente de Admisión Temporal Reparación de Equipo Tecnológico Parque de Servicios, Régimen Común' },
  { value: 'EX-3.3059.057', label: 'Reexportación Proveniente de Admisión Temporal Reparación de Equipo Tecnológico Parque de Servicios, Remisión entre Usuarios Directos del Mismo Parque de Servicios' },
  { value: 'EX-3.3059.058', label: 'Reexportación Proveniente de Admisión Temporal Reparación de Equipo Tecnológico Parque de Servicios, Remisión entre Usuarios Directos de Diferente Parque de Servicios' },
  { value: 'EX-3.3070.000', label: 'Reexportación Proveniente de Depósito., Régimen Común' },
  { value: 'EX-3.3071.000', label: 'Reexp. Prov. de Deposito.' },
  { value: 'EX-3.3070.072', label: 'Reexportación Proveniente de Depósito., Decreto 738 Eléctricos e Híbridos' },
]

export const CAT028_CODIGOS: ReadonlySet<string> = new Set(CAT028.map((r) => r.value))

export function resolverRegimen(code?: string | null): string {
  if (!code) return ''
  return CAT028.find((r) => r.value === code)?.label ?? code
}
