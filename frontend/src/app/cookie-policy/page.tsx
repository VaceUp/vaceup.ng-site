import { LegalPage } from '@/components/legal/LegalPage';

export const metadata = { title: 'Cookie Policy | VaceUp Digital Academy' };

export default function CookiePolicyPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      updated="6 September 2026"
      intro="This policy explains how vaceup.ng uses cookies and browser local storage, and how you can control them. We keep tracking minimal: no third-party advertising cookies, ever."
      sections={[
        {
          heading: 'What we use',
          body: ['We use only two categories:'],
          bullets: [
            'Essential cookies / local storage — keep you signed in (auth tokens), preserve your session and protect forms. The platform cannot function without these.',
            'Preference storage (browser local storage) — remembers things like your cart, your community reviews on this device, and interface settings.',
          ],
        },
        {
          heading: 'What we do NOT use',
          body: ['No advertising or cross-site tracking cookies. No social-media ad pixels. Analytics, when enabled, is aggregate and privacy-respecting — it never builds a personal profile across other websites.'],
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
