import type { Metadata } from 'next';
import { AuthShell } from '@/components/account/AuthShell';
import { ResetForm } from '@/components/account/ResetForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Choose a new password',
  robots: { index: false, follow: false },
};

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthShell
      eyebrow="Your account"
      title="Choose a new password."
      lede="This link works once. After you save, you will be signed in."
    >
      <ResetForm token={token ?? ''} />
    </AuthShell>
  );
}
