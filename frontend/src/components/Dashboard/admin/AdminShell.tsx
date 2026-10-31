'use client';

/**
 * Admin chrome: brand rail, grouped section nav and the toast outlet every
 * admin screen writes to. Members use MemberShell instead.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/lib/auth-context';
import { ADMIN_SECTIONS, adminHref, type AdminTab } from '@/lib/admin-sections';
import { useAdminTab } from '@/lib/use-admin-tab';
import { cn } from '@/lib/utils';
import { ToastProvider } from './AdminUI';
import styles from './admin.module.css';

const COLLAPSE_KEY = 'vaceup:admin-sidebar-collapsed';

/** Groups follow the registry, in the order each group is first reached. */
function groupSections() {
  const groups = new Map<string, (typeof ADMIN_SECTIONS)[number][]>();
  for (const section of ADMIN_SECTIONS) {
    const members = groups.get(section.group);
    if (members) members.push(section);
    else groups.set(section.group, [section]);
  }
  return [...groups].map(([name, sections]) => ({ name, sections }));
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const tab = useAdminTab();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const groups = useMemo(groupSections, []);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === 'true'); } catch { /* Navigation still works without storage. */ }
  }, []);

  const toggleCollapsed = () => setCollapsed((current) => {
    const next = !current;
    try { localStorage.setItem(COLLAPSE_KEY, String(next)); } catch { /* The preference just will not survive a reload. */ }
    return next;
  });

  useEffect(() => { setOpen(false); }, [tab, searchParams]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const initials = (user?.full_name ?? 'A').trim().charAt(0).toUpperCase();

  return (
    <ToastProvider>
      <div className={styles.shell}>
        {open && <button type="button" className={styles.scrim} aria-label="Close section menu" onClick={() => setOpen(false)} />}

        <aside
          className={styles.side}
          data-collapsed={collapsed ? 'true' : 'false'}
          data-open={open ? 'true' : 'false'}
        >
          <div className={styles.sideHead}>
            <Link href="/" className={styles.brand} aria-label="VaceUp home">
              <img src="/logo.webp" alt="" />
              {!collapsed && (
                <span>
                  <span className={styles.brandName}>VACEUP</span>
                  <span className={styles.brandRole}>Administrator</span>
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand section menu' : 'Collapse section menu'}
              className={styles.iconBtn}
            >
              <i className={cn('bi', collapsed ? 'bi-chevron-right' : 'bi-chevron-left')} aria-hidden="true" />
            </button>
          </div>

          <div className={styles.profile}>
            <Avatar src={(user as { avatar?: string } | null)?.avatar} alt={user?.full_name ?? 'Administrator'} size="lg" fallback={initials} />
            {!collapsed && (
              <div className={styles.profileText}>
                <p className={styles.profileName}>{user?.full_name || 'Administrator'}</p>
                <p className={styles.profileEmail}>{user?.email}</p>
              </div>
            )}
          </div>

          <nav aria-label="Administrator sections" className={styles.nav}>
            {groups.map((group) => (
              <div key={group.name} className={styles.navGroup}>
                <p className={styles.navLabel}>{group.name}</p>
                {group.sections.map((section) => {
                  const active = section.id === tab;
                  return (
                    <Link
                      key={section.id}
                      href={adminHref(section.id as AdminTab)}
                      title={collapsed ? section.name : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={styles.navItem}
                    >
                      <i className={cn('bi', `bi-${section.icon}`, styles.navIcon)} aria-hidden="true" />
                      <span className={styles.navName}>{section.name}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className={styles.sideFoot}>
            <button type="button" onClick={() => logout()} className={styles.signOut} title="Sign out">
              <i className="bi bi-box-arrow-right" aria-hidden="true" />
              <span className={styles.signOutName}>Sign out</span>
            </button>
          </div>
        </aside>

        <main className={styles.main} data-collapsed={collapsed ? 'true' : 'false'}>
          <div className={styles.pageWrap}>{children}</div>
        </main>

        {!open && (
          <button type="button" className={styles.menuFab} onClick={() => setOpen(true)} aria-label="Open section menu">
            <i className="bi bi-list text-xl" aria-hidden="true" />
          </button>
        )}
      </div>
    </ToastProvider>
  );
}
