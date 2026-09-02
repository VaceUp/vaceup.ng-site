import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'VaceUp Digital Academy | Practical Tech Education',
  description: 'Empowering future tech leaders through hands-on cohorts, live masterclasses, and career training.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-white text-[#0A1128] antialiased`}>
        {children}
      </body>
    </html>
  );
}