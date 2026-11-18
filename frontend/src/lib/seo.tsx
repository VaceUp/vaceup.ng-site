/** Structured data so the challenge and public events surface in Google with
 * dates, locations and free-entry offers. Googlebot renders client JavaScript,
 * so the payloads attach once the real API data is on the page. */
import { SITE } from '@/lib/site-config';
import type { ChallengeRound } from '@/lib/challenge-api';
import type { WebsiteEvent } from '@/lib/website-api';

const ORGANIZER = { '@type': 'Organization', name: 'VaceUp Digital Academy', url: SITE.url };

export function challengeEventJsonLd(round: ChallengeRound) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: round.title,
    description: (round.description || 'VaceUp monthly digital skills challenge').slice(0, 300),
    url: `${SITE.url}/challenge/?round=${encodeURIComponent(round.slug)}`,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    startDate: round.registration_opens_at,
    endDate: round.results_publish_at,
    location: { '@type': 'VirtualLocation', url: `${SITE.url}/challenge/` },
    organizer: ORGANIZER,
    offers: {
      '@type': 'Offer', price: 0, priceCurrency: 'NGN',
      url: `${SITE.url}/challenge/?round=${encodeURIComponent(round.slug)}`,
      availability: 'https://schema.org/InStock', validFrom: round.registration_opens_at,
    },
    keywords: round.hashtag || undefined,
  };
}

export function eventJsonLd(event: WebsiteEvent) {
  const url = `${SITE.url}/events/?slug=${encodeURIComponent(event.slug)}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: (event.summary || event.description || '').slice(0, 300),
    url,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: event.is_online
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    startDate: event.starts_at,
    endDate: event.ends_at || undefined,
    location: event.is_online
      ? { '@type': 'VirtualLocation', url }
      : { '@type': 'Place', name: event.location || 'VaceUp Digital Academy', address: event.location || undefined },
    organizer: ORGANIZER,
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'NGN', url, availability: 'https://schema.org/InStock' },
  };
}

export function eventsItemListJsonLd(events: WebsiteEvent[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: events.map((event, index) => ({
      '@type': 'ListItem', position: index + 1, item: eventJsonLd(event),
    })),
  };
}

/** Client-side JSON-LD injector for components that load their data from the API. */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
