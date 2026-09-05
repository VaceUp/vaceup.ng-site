import './globals.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { Navbar } from '@/components/ui/Navbar';
import { Footer } from '@/components/ui/Footer';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'VaceUp Digital Academy | Practical Tech Education',
  description: 'Empowering future tech leaders through hands-on cohorts, live masterclasses, and career training.',
  icons: {
    icon: '/logo.webp.png',
    shortcut: '/logo.webp.png',
    apple: '/logo.webp.png',
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
          <Navbar />
          <main className="pt-28 min-h-screen">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}