// Diccionario de paths SVG portado desde icons.jsx del prototipo.
// Usar un diccionario estático evita dependencias externas y garantiza
// que el conjunto de íconos sea idéntico al diseño de referencia.
const ICONS: Record<string, string> = {
  home:         'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-8.5Z',
  users:        'M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 0a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 1.79-8 4v3h10v-3c0-1.39.6-2.62 1.61-3.5A11.3 11.3 0 0 0 8 13Zm8 0c-.83 0-1.6.07-2.3.2 1.41 1.06 2.3 2.57 2.3 4.3v3h8v-3c0-2.21-3.58-4.5-8-4.5Z',
  building:     'M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M15 9h3a2 2 0 0 1 2 2v10M3 21h18M8 7h2M8 11h2M8 15h2M18 13h-1M18 17h-1',
  fileText:     'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M8 13h8M8 17h6',
  receipt:      'M5 2v20l3-2 2 2 2-2 2 2 2-2 3 2V2l-3 2-2-2-2 2-2-2-2 2-3-2Zm3 6h8M8 12h8M8 16h4',
  clipboard:    'M9 3h6a2 2 0 0 1 2 2v0h2a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2v0a2 2 0 0 1 2-2Zm0 2v2h6V5M8 12h8M8 16h5',
  package:      'M21 8 12 3 3 8m18 0v8l-9 5-9-5V8m18 0-9 5m0 0L3 8m9 5v8',
  list:         'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  grid:         'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
  wrench:       'M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6a1.5 1.5 0 0 0 2.1 2.1l6-6a4 4 0 0 0 5.4-5.4l-2.5 2.5L13 9.6l.8-2.8 1-.5Z',
  box:          'M3 7l9-4 9 4v10l-9 4-9-4V7Zm9-4v18M3 7l9 4 9-4',
  warehouse:    'M2 21V9l10-5 10 5v12H2Zm4 0v-9h12v9M9 21v-5h6v5',
  hammer:       'M13 4l4 4-2 2-4-4 2-2Zm4 4 4 4-4 4-1-1 1-1-3-3 1-1-1-1 3-2Zm-7 5 4 4-9 5-4-4 9-5Z',
  layers:       'M12 2 2 7l10 5 10-5-10-5Zm-10 12 10 5 10-5M2 11l10 5 10-5',
  chartBar:     'M3 21V3m18 18H3m4-4V11m4 6V7m4 10v-4m4 4V9',
  gear:         'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm8.5 4-.7-2.4 2-1.6-2-3.4-2.4.7-2-1.5L14.7 2H9.3l-.7 2.4-2 1.5-2.4-.7-2 3.4 2 1.6L3.5 12l.7 2.4-2 1.6 2 3.4 2.4-.7 2 1.5.7 2.4h5.4l.7-2.4 2-1.5 2.4.7 2-3.4-2-1.6.7-2.4Z',
  search:       'M11 4a7 7 0 1 1-7 7 7 7 0 0 1 7-7Zm5.5 12.5L21 21',
  bell:         'M18 16v-5a6 6 0 0 0-12 0v5l-2 3h16l-2-3Zm-6 6a3 3 0 0 0 3-3H9a3 3 0 0 0 3 3Z',
  chevronDown:  'm6 9 6 6 6-6',
  chevronUp:    'm6 15 6-6 6 6',
  chevronLeft:  'm15 6-6 6 6 6',
  chevronRight: 'm9 6 6 6-6 6',
  arrowLeft:    'M19 12H5m7-7-7 7 7 7',
  arrowRight:   'M5 12h14m-7-7 7 7-7 7',
  arrowUpRight: 'M7 17 17 7M7 7h10v10',
  plus:         'M12 5v14M5 12h14',
  minus:        'M5 12h14',
  edit:         'M16 3l5 5-12 12H4v-5L16 3Zm-2 2 5 5',
  trash:        'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6h12ZM10 11v6M14 11v6',
  download:     'M12 4v12m-6-6 6 6 6-6M4 20h16',
  upload:       'M12 20V8m-6 6 6-6 6 6M4 4h16',
  eye:          'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Zm11 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  check:        'M5 12l5 5L20 7',
  x:            'M6 6l12 12M6 18 18 6',
  filter:       'M3 5h18l-7 9v6l-4-2v-4L3 5Z',
  calendar:     'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm0 4h18M8 2v4M16 2v4',
  clock:        'M12 21a9 9 0 1 0-9-9 9 9 0 0 0 9 9Zm0-13v4l3 3',
  dollar:       'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  tool:         'M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6a1.5 1.5 0 0 0 2.1 2.1l6-6a4 4 0 0 0 5.4-5.4l-2.5 2.5L13 9.6l.8-2.8 1-.5Z',
  alertTriangle:'M12 3 2 21h20L12 3Zm0 6v5m0 3v.5',
  info:         'M12 21a9 9 0 1 0-9-9 9 9 0 0 0 9 9Zm0-13v4m0 4v.5',
  menu:         'M3 6h18M3 12h18M3 18h18',
  moreH:        'M5 12h.01M12 12h.01M19 12h.01',
  moreV:        'M12 5h.01M12 12h.01M12 19h.01',
  logout:       'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  user:         'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm-9 9c0-4 4-7 9-7s9 3 9 7v1H3v-1Z',
  sun:          'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0-5v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8 5.6 18.4M18.4 5.6l1.4-1.4',
  moon:         'M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10Z',
  shield:       'M12 22s8-4 8-12V5l-8-3-8 3v5c0 8 8 12 8 12Z',
  idCard:       'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm6 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-3 6c0-1.5 1.5-3 3-3s3 1.5 3 3M14 9h5M14 13h4M14 17h3',
  refresh:      'M3 12a9 9 0 0 1 15-6.7L21 8m0-5v5h-5M21 12a9 9 0 0 1-15 6.7L3 16m0 5v-5h5',
  send:         'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z',
  copy:         'M9 9h11v11H9V9Zm-5-5h11v11H4V4Z',
};

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
};

export function Icon({ name, size = 16, strokeWidth = 1.75, color, className = '' }: IconProps) {
  const d = ICONS[name];
  // Si el ícono no existe en el diccionario no renderizamos nada en vez de romper el layout.
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
