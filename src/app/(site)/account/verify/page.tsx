import type { Metadata } from 'next';
import { AuthShell } from '@/components/account/AuthShell';
import { VerifyClient } from '@/components/account/VerifyClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Confirm your email',
  robots: { index: false, follow: false },
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthShell eyebrow="Your account" title="Confirming your email.">
      <VerifyClient token={token ?? ''} />
    </AuthShell>
  );
}
