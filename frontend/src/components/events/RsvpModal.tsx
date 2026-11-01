'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/lib/auth-context';
import { downloadEventIcs } from '@/lib/calendar';
import { formatEventWindow, registerForEvent, type WebsiteEvent } from '@/lib/website-api';

interface Props {
  event: WebsiteEvent;
  onClose: () => void;
  onRegistered: (seatsTaken: number, isFull: boolean) => void;
}

export default function RsvpModal({ event, onClose, onRegistered }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone_number || '',
    note: '',
    consent_marketing: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [done, setDone] = useState('');

  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event_: FormEvent) => {
    event_.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormError('');
    try {
      const result = await registerForEvent(event.slug, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        note: form.note.trim(),
        consent_marketing: form.consent_marketing,
      });
      setDone(result.detail);
      onRegistered(result.seats_taken, result.is_full);
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Your registration could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  const seatsLeft = event.capacity === null ? null : Math.max(0, event.capacity - event.seats_taken);

  return (
    <Modal isOpen onClose={onClose} title="Reserve your seat" size="sm">
      {done ? (
        <div className="space-y-6">
          <p role="status" className="rounded-xl bg-green-50 p-4 text-sm font-semibold text-green-800">{done}</p>
          <div className="space-y-1 text-sm text-gray-600">
            <p className="font-semibold text-navy-950">{event.title}</p>
            <p>{formatEventWindow(event)}</p>
            <p>{event.is_online ? 'Online' : event.location || 'Venue to be confirmed'}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => downloadEventIcs(event)} variant="outline">Add to calendar</Button>
            <Button onClick={onClose} className="bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold">
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={(event_) => void submit(event_)} className="space-y-4">
          <div className="space-y-1 text-sm text-gray-600">
            <p className="font-semibold text-navy-950">{event.title}</p>
            <p>{formatEventWindow(event)}</p>
            <p>{event.capacity ? `${seatsLeft} ${seatsLeft === 1 ? 'seat' : 'seats'} left of ${event.capacity}` : 'Seats are unlimited for this event'}</p>
          </div>
          <Input
            label="Full name"
            required
            value={form.name}
            onChange={(event_) => set('name', event_.target.value)}
            autoComplete="name"
          />
          <Input
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(event_) => set('email', event_.target.value)}
            autoComplete="email"
          />
          <Input
            label="Phone (optional)"
            type="tel"
            value={form.phone}
            onChange={(event_) => set('phone', event_.target.value)}
            autoComplete="tel"
          />
          <div>
            <label htmlFor="event-note" className="block text-sm font-semibold text-navy-900 mb-2">
              Anything we should know? (optional)
            </label>
            <textarea
              id="event-note"
              rows={3}
              maxLength={1000}
              value={form.note}
              onChange={(event_) => set('note', event_.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 transition-colors resize-y"
            />
          </div>
          <label className="flex items-start gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.consent_marketing}
              onChange={(event_) => set('consent_marketing', event_.target.checked)}
              className="mt-0.5 size-5 flex-shrink-0 rounded border-gray-300 accent-navy-950"
            />
            <span>Email me about future VaceUp events and workshops.</span>
          </label>
          {formError && <p role="alert" className="text-sm font-semibold text-red-700">{formError}</p>}
          <Button
            type="submit"
            loading={submitting}
            className="w-full bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold"
          >
            Confirm registration
          </Button>
        </form>
      )}
    </Modal>
  );
}
