import { LegalPage } from '@/components/legal/LegalPage';

export const metadata = { title: 'Cookie Policy | VaceUp Digital Academy' };

export default function CookiePolicyPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      updated="3 November 2026"
      intro="This policy explains how vaceup.ng uses cookies and browser local storage, and how you can control them. We keep tracking minimal: essential storage to run the site, and one advertising measurement pixel on public pages."
      sections={[
        {
          heading: 'What we use',
          body: ['We use three categories:'],
          bullets: [
            'Essential cookies / local storage — keep you signed in (auth tokens), preserve your session and protect forms. The platform cannot function without these.',
            'Preference storage (browser local storage) — remembers things like your cart, your community reviews on this device, and interface settings.',
            'Advertising measurement (public pages only) — the Meta pixel (Facebook) measures the adverts that bring people to vaceup.ng. It sets Meta’s _fbp and _fbc cookies and records the public page you opened and whether you completed an event registration. It never receives the name, email, phone number or other answers you type into a form.',
          ],
        },
        {
          heading: 'Where it runs',
          body: [
            'The pixel loads only on the public website. It is not loaded inside the signed-in dashboard, the live classroom, staff meetings or any meeting room, so your learning and teaching activity is not measured by an advertising network.',
          ],
        },
        {
          heading: 'What we do NOT use',
          body: [
            'No other advertising network, no data brokers, and no sale of your data. We do not send your form answers, account details or classroom activity to Meta.',
          ],
        },
        {
          heading: 'Turning it off',
          body: [
            'You can block third-party cookies or use a tracker blocker in your browser; the public website still works, but advert measurement stops for you. Clearing cookies removes the _fbp and _fbc identifiers.',
          ],
        },
        {
          heading: 'Community reviews on your device',
          body: [
            'Reviews you publish are stored in your browser’s local storage so they appear instantly on the site. Because this storage is per-device, clearing your browser data removes locally stored reviews from view (our backend verification system, once live, stores reviews server-side instead).',
          ],
        },
        {
          heading: 'Managing cookies',
          body: [
            'You can clear or block cookies in your browser settings at any time. Blocking essential storage will sign you out and may prevent enrollment and payment from working correctly.',
          ],
        },
      ]}
    />
  );
}
