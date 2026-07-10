import { redirect } from 'next/navigation';
export default function AssinaturaSettingsPage() {
  redirect('/settings?tab=billing');
}
