import './globals.css';
import { Inter } from 'next/font/google';
import { KidsNavbar } from '@/components/ui/KidsNavbar';
import { KidsFooter } from '@/components/ui/KidsFooter';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'VaceUp Kids Tech Academy | Coding, AI & Digital Skills for Children',
  description: 'Fun, engaging technology programs for kids ages 6-17. Coding, AI, Robotics, Game Development, and more.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-white text-[#0A1128] antialiased`}>
        <KidsNavbar />
        <main className="pt-24 min-h-screen">{children}</main>
        <KidsFooter />
      </body>
    </html>
  );
}