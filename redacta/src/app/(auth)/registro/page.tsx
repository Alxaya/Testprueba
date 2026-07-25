import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AuthForm } from '@/components/auth/AuthForm';
import { registerAction, googleSignInAction } from '@/app/actions/auth';
import { features } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Crear cuenta gratis',
  description:
    'Crea tu cuenta de Redacta y genera fichas de producto, articulos SEO y guiones para redes con el tono de tu marca. 5 generaciones gratis al mes, sin tarjeta.',
  alternates: { canonical: '/registro' },
};

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect('/app');

  return (
    <AuthForm
      mode="register"
      action={registerAction}
      googleEnabled={features.googleAuth}
      googleAction={googleSignInAction}
    />
  );
}
