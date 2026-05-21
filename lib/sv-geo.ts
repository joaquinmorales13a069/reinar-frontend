export const DEPARTAMENTOS_SV = [
  'Ahuachapán', 'Santa Ana', 'Sonsonate', 'Chalatenango',
  'La Libertad', 'San Salvador', 'Cuscatlán', 'La Paz',
  'Cabañas', 'San Vicente', 'Usulután', 'San Miguel',
  'Morazán', 'La Unión',
] as const;

export const MUNICIPIOS_SV: Record<string, string[]> = {
  'San Salvador': ['San Salvador', 'Soyapango', 'Mejicanos', 'Apopa', 'Ciudad Delgado', 'San Marcos', 'Cuscatancingo', 'Ilopango'],
  'La Libertad': ['Santa Tecla', 'Antiguo Cuscatlán', 'Colón', 'Quezaltepeque', 'San Juan Opico', 'Zaragoza', 'La Libertad'],
  'Santa Ana': ['Santa Ana', 'Chalchuapa', 'Texistepeque', 'Metapán', 'Santiago de la Frontera'],
  'Ahuachapán': ['Ahuachapán', 'Atiquizaya', 'San Francisco Menéndez', 'Tacuba'],
  'Sonsonate': ['Sonsonate', 'Nahuizalco', 'Izalco', 'San Antonio del Monte', 'Acajutla'],
  'Chalatenango': ['Chalatenango', 'La Palma', 'San Ignacio', 'Nueva Concepción', 'Tejutla'],
  'Cuscatlán': ['Suchitoto', 'Cojutepeque', 'San Pedro Perulapán', 'Oratorio de Concepción'],
  'La Paz': ['Zacatecoluca', 'San Luis Talpa', 'Olocuilta', 'San Pedro Masahuat', 'Rosario de Mora'],
  'Cabañas': ['Sensuntepeque', 'Ilobasco', 'San Isidro', 'Victoria'],
  'San Vicente': ['San Vicente', 'Apastepeque', 'Tepetitán', 'San Cayetano Istepeque'],
  'Usulután': ['Usulután', 'Jiquilisco', 'Santiago de María', 'El Triunfo', 'Berlín'],
  'San Miguel': ['San Miguel', 'Moncagua', 'Chinameca', 'El Tránsito', 'San Rafael Oriente'],
  'Morazán': ['San Francisco Gotera', 'Jocoaitique', 'Osicala', 'Perquín'],
  'La Unión': ['La Unión', 'Conchagua', 'El Carmen', 'Santa Rosa de Lima'],
};

export const SECTORES = [
  'Construcción', 'Minería', 'Manufactura', 'Electricidad y gas',
  'Agua y saneamiento', 'Comercio', 'Transporte',
  'Alojamiento y restaurantes', 'Información y comunicación',
  'Servicios financieros', 'Bienes raíces', 'Servicios profesionales',
  'Administración pública', 'Educación', 'Salud',
  'Cultura y entretenimiento', 'Otros servicios',
];
