import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AuthForm } from '@/components/auth/AuthForm';
import { loginAction, googleSignInAction } from '@/app/actions/auth';
import { features } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Entrar',
  description: 'Accede a tu cuenta de Redacta.',
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect('/app');

  return (
    <AuthForm
      mode="login"
      action={loginAction}
      googleEnabled={features.googleAuth}
      googleAction={googleSignInAction}
    />
  );
}
