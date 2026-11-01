'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { WebsiteEvent } from '@/lib/website-api';
import RsvpModal from './RsvpModal';

interface Props {
  event: WebsiteEvent;
  block?: string;
  onRegistered?: (seatsTaken: number, isFull: boolean) => void;
}

/** The one register control an event can show: external page, closed, or RSVP. */
export default function RegisterButton({ event, block = 'w-full', onRegistered }: Props) {
  const [open, setOpen] = useState(false);
  const [seats, setSeats] = useState({ taken: event.seats_taken, full: event.is_full });

  if (event.registration_url) {
    return (
      <a
        href={event.registration_url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex min-h-[44px] items-center justify-center rounded-xl bg-gold-brand px-5 font-bold text-navy-950 hover:bg-gold-hover transition-colors',
          block,
        )}
      >
        Register
      </a>
    );
  }
  if (event.is_past) {
    return (
      <Button variant="outline" disabled className={block}>
        Already held
      </Button>
    );
  }
  if (seats.full) {
    return (
      <Button variant="outline" disabled className={block}>
        Fully booked
      </Button>
    );
  }
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className={cn('bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold', block)}
      >
        Register
      </Button>
      {open && (
        <RsvpModal
          event={{ ...event, seats_taken: seats.taken, is_full: seats.full }}
          onClose={() => setOpen(false)}
          onRegistered={(taken, full) => {
            setSeats({ taken, full });
            onRegistered?.(taken, full);
          }}
        />
      )}
    </>
  );
}
