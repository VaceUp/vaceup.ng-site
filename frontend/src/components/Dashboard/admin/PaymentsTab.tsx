'use client';

import { useMemo, useState } from 'react';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { formatWorkspaceDate } from '@/lib/workspace-api';
import {
  Action,
  AdminList,
  AdminRow,
  AdminSection,
  EmptyState,
  Pill,
  Skeleton,
  StatusNote,
  TextInput,
  Toolbar,
  adminStyles,
  controlClass,
  useToast,
} from './AdminUI';

/**
 * Payments ledger: who paid, for what, and whether the money actually landed.
 * Read-only — a payment is only changed by Paystack confirming a transaction.
 */

interface PaymentItem {
  course: number;
  course_title: string;
  amount: string;
}

interface Payment {
  reference: string;
  student: number;
  student_name: string;
  student_email: string;
  course: number;
  course_title: string;
  amount: string;
  currency: string;
  status: 'pending' | 'success' | 'failed' | 'abandoned';
  paid_at: string | null;
  created_at: string;
  items: PaymentItem[];
}

const STATUS: Record<Payment['status'], { label: string; tone: 'live' | 'draft' | 'danger' | 'muted' }> = {
  success: { label: 'Successful', tone: 'live' },
  pending: { label: 'Awaiting payment', tone: 'draft' },
  failed: { label: 'Failed', tone: 'danger' },
  abandoned: { label: 'Abandoned', tone: 'muted' },
};

function money(value: number | string, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(parseFloat(String(value)) || 0);
}

export default function PaymentsTab() {
  const toast = useToast();
  const resource = useWorkspaceResource<Payment[] | { results: Payment[] }>('/admin/dashboard/payments/');
  const payments = useMemo(() => {
    const data = resource.data;
    if (Array.isArray(data)) return data;
    return data?.results ?? [];
  }, [resource.data]);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const totals = useMemo(() => {
    let collected = 0;
    let successful = 0;
    let pending = 0;
    let unsuccessful = 0;
    for (const payment of payments) {
      if (payment.status === 'success') {
        collected += parseFloat(String(payment.amount)) || 0;
        successful += 1;
      } else if (payment.status === 'pending') pending += 1;
      else unsuccessful += 1;
    }
    return { collected, successful, pending, unsuccessful };
  }, [payments]);

  const rows = useMemo(() => payments.filter((payment) => {
    if (status && payment.status !== status) return false;
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return `${payment.student_name} ${payment.student_email} ${payment.course_title} ${payment.reference}`.toLowerCase().includes(needle);
  }), [payments, search, status]);

  async function copy(reference: string) {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(reference);
      window.setTimeout(() => setCopied((current) => (current === reference ? null : current)), 3000);
    } catch {
      toast.push('The reference could not be copied. Select it in the row and copy it manually.', 'error');
    }
  }

  return (
    <AdminSection
      title="Payments"
      description="Every checkout on the platform, newest first — the latest 200 records. Only Paystack confirming a transaction moves a payment to successful."
      actions={<Action onClick={resource.refresh} disabled={resource.loading}>Refresh</Action>}
    >
      <div className={adminStyles.stats}>
        <div className={`${adminStyles.stat} ${adminStyles.statWide}`}>
          <p className={adminStyles.statLabel}>Collected</p>
          <p className={`${adminStyles.statValue} ${adminStyles.statValueMoney}`}>{money(totals.collected)}</p>
          <p className={adminStyles.statNote}>Successful payments in this list</p>
        </div>
        <div className={adminStyles.stat}>
          <p className={adminStyles.statLabel}>Successful</p>
          <p className={adminStyles.statValue}>{totals.successful}</p>
          <p className={adminStyles.statNote}>Access is granted</p>
        </div>
        <div className={adminStyles.stat}>
          <p className={adminStyles.statLabel}>Awaiting payment</p>
          <p className={adminStyles.statValue}>{totals.pending}</p>
          <p className={adminStyles.statNote}>Checkout started, not confirmed</p>
        </div>
        <div className={adminStyles.stat}>
          <p className={adminStyles.statLabel}>Not completed</p>
          <p className={adminStyles.statValue}>{totals.unsuccessful}</p>
          <p className={adminStyles.statNote}>Failed or abandoned</p>
        </div>
      </div>

      <Toolbar label="Filter payments">
        <TextInput
          type="search"
          placeholder="Search student, course or reference"
          aria-label="Search payments"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className={controlClass}
          aria-label="Filter by payment status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">Every status</option>
          <option value="success">Successful</option>
          <option value="pending">Awaiting payment</option>
          <option value="failed">Failed</option>
          <option value="abandoned">Abandoned</option>
        </select>
      </Toolbar>

      {resource.error && (
        <StatusNote tone="error">
          {resource.error}
          <span className={adminStyles.inlineActions}><Action onClick={resource.refresh}>Retry</Action></span>
        </StatusNote>
      )}

      {resource.loading && !resource.data && <Skeleton rows={6} />}

      {!resource.loading && !resource.error && payments.length === 0 && (
        <EmptyState
          icon="bi-credit-card"
          title="No payments yet"
          description="A checkout appears here as soon as a learner starts paying for a course, even before the money is confirmed."
        />
      )}

      {payments.length > 0 && rows.length === 0 && (
        <EmptyState
          icon="bi-funnel"
          title="No payment matches that filter"
          description="Clear the status filter or shorten the search."
        />
      )}

      {rows.length > 0 && (
        <AdminList label="Payments">
          {rows.map((payment) => {
            const detail = payment.items.length > 1
              ? payment.items.map((item) => item.course_title).join(' + ')
              : payment.course_title;
            return (
              <AdminRow
                key={payment.reference}
                round
                placeholder="bi-credit-card"
                title={payment.student_name || 'Account removed'}
                badges={<>
                  <Pill tone={STATUS[payment.status].tone}>{STATUS[payment.status].label}</Pill>
                  <span className={adminStyles.amount}>{money(payment.amount, payment.currency || 'NGN')}</span>
                </>}
                meta={`${payment.student_email || 'No email on record'} · ${detail || 'Course removed'} · ${payment.paid_at ? `paid ${formatWorkspaceDate(payment.paid_at, true)}` : `started ${formatWorkspaceDate(payment.created_at, true)}`}`}
                description={`Reference ${payment.reference}`}
                actions={<Action onClick={() => void copy(payment.reference)}>
                  {copied === payment.reference ? 'Copied' : 'Copy reference'}
                </Action>}
              />
            );
          })}
        </AdminList>
      )}
    </AdminSection>
  );
}
