import './globals.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import AppShell from '@/components/layout/AppShell';
import AuthModal from '@/components/landing/AuthModal';
import PageTransition from '@/components/ui/PageTransition';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  metadataBase: new URL('https://vaceup.ng'),
  title: 'VaceUp Digital Academy | Practical Tech Education',
  description: 'Empowering future tech leaders through hands-on cohorts, live masterclasses, and career training.',
  icons: {
    icon: '/logo.webp',
    shortcut: '/logo.webp',
    apple: '/logo.webp',
  },
  // Google Search Console — replace with the token from the GSC dashboard
  verification: {
    google: 'REPLACE_WITH_GSC_VERIFICATION_TOKEN',
  },
  openGraph: {
    siteName: 'VaceUp Digital Academy',
    type: 'website',
    locale: 'en_NG',
    url: 'https://vaceup.ng',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-white text-[#0A1128] antialiased`}>
        <AuthProvider>
          {/* Single global chrome — pages must NOT render their own Header/Footer.
              AppShell hides the marketing chrome on dashboard/tool pages. */}
          <PageTransition />
          <AppShell>
            {children}
          </AppShell>
          <AuthModal />
        </AuthProvider>
      </body>
    </html>
  );
}
