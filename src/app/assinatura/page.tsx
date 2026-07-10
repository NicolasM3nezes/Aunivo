import { redirect } from 'next/navigation';
export default function AssinaturaPage() {
  redirect('/settings?tab=billing');
}
