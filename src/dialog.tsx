import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text, tr } from './i18n';
import { c, f, onTheme } from './theme';

type Opts = { title: string; message?: string; confirmText?: string; cancelText?: string; danger?: boolean; single?: boolean };
type Pending = Opts & { done: (ok: boolean) => void };

let show: ((p: Pending) => void) | null = null;

/** Themed replacement for Alert.alert: resolves true when the user confirms. */
export function askConfirm(o: Opts): Promise<boolean> {
  return new Promise((res) => {
    if (!show) return res(true);
    show({ ...o, done: res });
  });
}
/** Themed info box with a single OK button. */
export const notify = (title: string, message?: string) => askConfirm({ title, message, single: true, confirmText: 'OK' });

export function ConfirmHost() {
  const [p, setP] = useState<Pending | null>(null);
  useEffect(() => { show = setP; return () => { show = null; }; }, []);
  const close = (ok: boolean) => { const cur = p; setP(null); cur?.done(ok); };
  return (
    <Modal visible={!!p} transparent animationType="fade" onRequestClose={() => close(false)} statusBarTranslucent>
      <View style={s.wrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close(false)} accessibilityLabel="Close" />
        {p && (
          <View style={s.box}>
            <Text style={s.title}>{tr(p.title)}</Text>
            {p.message ? <Text style={s.msg}>{tr(p.message)}</Text> : null}
            <View style={s.row}>
              {!p.single && (
                <Pressable onPress={() => close(false)} style={[s.btn, { backgroundColor: c.page }]} accessibilityRole="button">
                  <Text style={[s.btnT, { color: c.ink }]}>{p.cancelText ?? 'Cancel'}</Text>
                </Pressable>
              )}
              <Pressable onPress={() => close(true)} style={[s.btn, { backgroundColor: p.danger ? c.red : c.btn }]} accessibilityRole="button">
                <Text style={[s.btnT, { color: p.danger ? '#fff' : c.lime }]}>{p.confirmText ?? 'OK'}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const mkStyles = () => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 },
  box: { backgroundColor: c.card, borderRadius: 28, padding: 22, borderWidth: 1, borderColor: c.line },
  title: { fontFamily: f.extra, fontSize: 19, color: c.ink, letterSpacing: -0.3 },
  msg: { fontFamily: f.medium, fontSize: 15, color: c.muted, lineHeight: 21, marginTop: 8 },
  row: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btn: { flex: 1, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  btnT: { fontFamily: f.bold, fontSize: 15 },
});
let s = mkStyles();
onTheme(() => { s = mkStyles(); });
