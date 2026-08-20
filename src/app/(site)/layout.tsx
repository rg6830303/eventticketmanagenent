import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { PageTransition } from '@/components/site/PageTransition';

/**
 * Chrome for every public page. The admin console and the standalone ticket
 * view sit outside this group on purpose — neither wants a marketing nav bar
 * over it.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main id="main" className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer />
    </div>
  );
}
