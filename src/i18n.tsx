import React from 'react';
import { Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps } from 'react-native';
import { FR, FR_PATTERNS } from './fr';

export type Lang = 'en' | 'fr';
let lang: Lang = 'en';
export const setLang = (l: Lang) => { lang = l; };
export const getLang = () => lang;

/** Translate an English UI string. Unknown strings come back unchanged. */
export function tr(s: string): string {
  if (lang === 'en' || !s) return s;
  const hit = FR[s];
  if (hit != null) return hit;
  const t = s.trim();
  if (!t) return s;
  const inner = FR[t];
  if (inner != null) return s.slice(0, s.indexOf(t)) + inner + s.slice(s.indexOf(t) + t.length);
  for (const [re, fn] of FR_PATTERNS) {
    const m = t.match(re);
    if (m) return s.slice(0, s.indexOf(t)) + fn(...m.slice(1)) + s.slice(s.indexOf(t) + t.length);
  }
  return s;
}

const walk = (n: React.ReactNode): React.ReactNode => {
  if (typeof n === 'string') return tr(n);
  if (Array.isArray(n)) return n.map((x) => walk(x));
  if (React.isValidElement(n) && n.type === React.Fragment) {
    const kids = (n.props as { children?: React.ReactNode }).children;
    return React.cloneElement(n as React.ReactElement<{ children?: React.ReactNode }>, undefined, walk(kids));
  }
  return n;
};

/** Drop-in for react-native Text that translates string children. */
export function Text({ children, ...rest }: TextProps) {
  return <RNText {...rest}>{walk(children)}</RNText>;
}

/** Drop-in for react-native TextInput that translates the placeholder. */
export const TextInput = React.forwardRef<RNTextInput, TextInputProps>(function TextInput({ placeholder, ...rest }, ref) {
  return <RNTextInput ref={ref} placeholder={placeholder ? tr(placeholder) : placeholder} {...rest} />;
});
