'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { BookOpen, LayoutDashboard, Video, Users, Award, CreditCard, Settings, MessageSquare, Code, Menu, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { NativeDialog } from '@/components/ui/Modal';
import { WorkspaceButton, styles } from './WorkspaceUI';

const ThemeContext = createContext({ theme: 'light', toggle: () => {} });
export const useWorkspaceTheme = () => useContext(ThemeContext);

export default function MemberShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname().replace(/\/$/, '') || '/';
  const [theme, setTheme] = useState('light');
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const instructor = user?.role === 'instructor';
  useEffect(() => { try { setTheme(localStorage.getItem('vaceup:workspace-theme') === 'dark' ? 'dark' : 'light'); } catch {} }, []);
  useEffect(() => { dialog.current?.close(); setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    const moveLegacyHash = () => {
      const section = window.location.hash.slice(1);
      if (pathname === '/dashboard' && ['courses', 'billing', 'students'].includes(section)) router.replace(`/dashboard/${section}`);
    };
    moveLegacyHash(); window.addEventListener('hashchange', moveLegacyHash);
    return () => window.removeEventListener('hashchange', moveLegacyHash);
  }, [pathname, router]);
  const toggle = () => setTheme(current => {
    const next = current === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('vaceup:workspace-theme', next); } catch {}
    return next;
  });
  const items = [
    { title: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { title: 'My courses', href: '/dashboard/courses', icon: BookOpen },
    { title: 'Live classes', href: '/dashboard/live-classes', icon: Video },
    ...(instructor ? [{ title: 'My students', href: '/dashboard/students', icon: Users }] : [
      { title: 'Certificates', href: '/dashboard/certificates', icon: Award },
      { title: 'Payment history', href: '/dashboard/billing', icon: CreditCard },
    ]),
    { title: 'Messages', href: '/messaging', icon: MessageSquare },
    { title: 'Code editor', href: '/codeeditor', icon: Code },
    { title: 'Account & appearance', href: '/dashboard/account', icon: Settings },
  ];
  const navigation = <aside className={styles.sidebar}>
    <Link href="/" className={styles.brand}><img src="/logo.webp" alt="" /><span>VaceUp</span></Link>
    <nav aria-label="Workspace navigation">{items.map(({ title, href, icon: Icon }) => <Link key={href} href={href} className={styles.navLink}
      aria-current={pathname === href || (href.endsWith('/courses') && pathname === '/dashboard/learn') ? 'page' : undefined}
      onClick={() => dialog.current?.close()}><Icon aria-hidden="true" /><span>{title}</span></Link>)}</nav>
    <div className={styles.profile}><p>{user?.full_name}</p><p>{instructor ? 'Tutor workspace' : 'Student workspace'}</p></div>
    <WorkspaceButton loading={signingOut} onClick={async () => { setSigningOut(true); try { await logout(); } catch {} finally { router.replace('/login'); setSigningOut(false); } }}>Sign out</WorkspaceButton>
  </aside>;
  return <ThemeContext.Provider value={{ theme, toggle }}><div className={styles.shell} data-workspace-theme={theme}>
    <a href="#workspace-content" className={`${styles.action} ${styles.skipLink}`}>Skip to content</a>
    <div className={styles.desktopSidebar}>{navigation}</div>
    <div><div className={styles.mobileBar}><Link href="/dashboard">VaceUp / {instructor ? 'Tutor' : 'Student'}</Link>
      <WorkspaceButton ref={menuButton} aria-expanded={menuOpen} aria-controls="workspace-menu" onClick={() => { dialog.current?.showModal(); setMenuOpen(true); }}><Menu aria-hidden="true" />Menu</WorkspaceButton></div>
      <main id="workspace-content" tabIndex={-1} className={styles.content}>{children}
        <footer className={styles.footer}>Your workspace refreshes while this page is open. Use Refresh to check for updates now.</footer>
      </main></div>
    <NativeDialog ref={dialog} id="workspace-menu" aria-label="Workspace menu" className={styles.drawer} onClose={() => { setMenuOpen(false); menuButton.current?.focus(); }}>
      <WorkspaceButton className={styles.closeMenu} onClick={() => dialog.current?.close()}><X aria-hidden="true" />Close menu</WorkspaceButton>{navigation}
    </NativeDialog>
  </div></ThemeContext.Provider>;
}
