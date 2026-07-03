import { redirect } from 'next/navigation';

/** Legacy static sports slugs → hub. */
export default function LegacySportsStreamPage() {
  redirect('/sports');
}
