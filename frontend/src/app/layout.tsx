import './globals.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import AuthModal from '@/components/landing/AuthModal';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'VaceUp Digital Academy | Practical Tech Education',
  description: 'Empowering future tech leaders through hands-on cohorts, live masterclasses, and career training.',
  icons: {
    icon: '/logo.webp',
    shortcut: '/logo.webp',
    apple: '/logo.webp',
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
          {/* Single global chrome — pages must NOT render their own Header/Footer */}
          <Header />
          <main className="min-h-screen">{children}</main>
          <Footer />
          <AuthModal />
        </AuthProvider>
      </body>
    </html>
  );
}