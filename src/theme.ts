export type ThemeMode = 'light' | 'dark';

const LIGHT = {
  lime: '#9BDB3F',
  limeText: '#5E9C17',
  tint: '#E3F5C4',
  ink: '#15200F',
  onLime: '#15200F',
  btn: '#15200F',
  page: '#F6F7F3',
  card: '#FFFFFF',
  line: '#EBEDE6',
  muted: '#868D80',
  soft: '#A9AEA3',
  orange: '#FF8A3D',
  orangeTint: '#FFEBDC',
  orangeSoft: '#FFD6BA',
  blue: '#3D97F5',
  blueTint: '#E1EFFE',
  blueSoft: '#D7E8FC',
  red: '#FF4D4F',
};

const DARK: typeof LIGHT = {
  lime: '#9BDB3F',
  limeText: '#B2E86B',
  tint: '#273719',
  ink: '#EEF2E8',
  onLime: '#15200F',
  btn: '#3C4D2D',
  page: '#0E120B',
  card: '#181E13',
  line: '#262E20',
  muted: '#98A091',
  soft: '#6D7567',
  orange: '#FF9A55',
  orangeTint: '#3B2A1B',
  orangeSoft: '#5A3A22',
  blue: '#4DA3FF',
  blueTint: '#1C2B3C',
  blueSoft: '#27405B',
  red: '#FF6B6D',
};

/** Live palette: the values are swapped in place when the theme changes. */
export const c: typeof LIGHT = { ...LIGHT };

let current: ThemeMode = 'light';
const listeners: (() => void)[] = [];

/** Modules register a callback to rebuild their StyleSheet after a theme change. */
export const onTheme = (fn: () => void) => { listeners.push(fn); };
export const themeMode = () => current;
export function applyTheme(mode: ThemeMode) {
  if (mode === current) return;
  current = mode;
  Object.assign(c, mode === 'dark' ? DARK : LIGHT);
  listeners.forEach((fn) => fn());
}

export const f = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semi: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extra: 'PlusJakartaSans_800ExtraBold',
};
