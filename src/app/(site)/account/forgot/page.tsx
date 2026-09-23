import type { Metadata } from 'next';
import { AuthShell } from '@/components/account/AuthShell';
import { ForgotForm } from '@/components/account/ForgotForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Reset your password',
  robots: { index: false, follow: false },
};

export default function ForgotPage() {
  return (
    <AuthShell
      eyebrow="Your account"
      title="Forgot your password?"
      lede="Type the address you signed up with and we will send you a link to choose a new one."
    >
      <ForgotForm />
    </AuthShell>
  );
}
