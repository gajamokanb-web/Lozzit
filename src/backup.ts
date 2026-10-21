import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

const stamp = () => new Date().toISOString().slice(0, 10);

/** Save the backup as a .json file and open the share sheet (Drive, Files, mail…). */
export async function exportBackup(json: string): Promise<'shared' | 'saved' | 'unavailable'> {
  const name = `lozzit-backup-${stamp()}.json`;
  if (Platform.OS === 'web') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = name;
    a.click();
    return 'saved';
  }
  const uri = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.writeAsStringAsync(uri, json);
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: name, UTI: 'public.json' });
  return 'shared';
}

/** Let the user pick a backup file; returns its text, or null if cancelled. */
export async function pickBackup(): Promise<string | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  if (Platform.OS === 'web') return (a as unknown as { file?: File }).file ? await (a as unknown as { file: File }).file.text() : null;
  return await FileSystem.readAsStringAsync(a.uri);
}
