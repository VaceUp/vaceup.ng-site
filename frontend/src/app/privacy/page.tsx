import { LegalPage } from '@/components/legal/LegalPage';

export const metadata = { title: 'Privacy Policy | VaceUp Digital Academy' };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="3 November 2026"
      intro="VaceUp Digital Academy ('VaceUp', 'we', 'us') respects your privacy and handles personal data under the Nigeria Data Protection Act 2023 (NDPA) and applicable regulations. This policy explains what we collect, why, how we protect it and the rights you have."
      sections={[
        {
          heading: 'Data we collect',
          body: ['We collect only what we need to run the academy:'],
          bullets: [
            'Account data: full name, email address, phone number and password (stored only as a secure hash).',
            'Enrollment data: courses applied for and paid, payment status, attendance, assignments, quiz results and certificates.',
            'Community content: reviews, testimonials and photos you choose to publish, and messages you send in platform chats.',
            'Technical data: browser type, device, pages visited and basic analytics — used to improve performance and security.',
            'Advertising measurement (public pages only): the public pages you visit and whether you registered for an event, collected through the Meta pixel. It does not receive the name, email, phone or other answers you enter into a form.',
            'Kids Tech Academy: for learners under 13 we collect only what is necessary, with parent/guardian consent, and parents control the account.',
          ],
        },
        {
          heading: 'Why we use your data',
          body: ['We process personal data to:'],
          bullets: [
            'Run your enrollment: admissions, payments, course access, live classes, assignments, grading and certificates.',
            'Communicate with you: verification emails, class reminders, announcements and support.',
            'Keep the platform safe: detect fraud, prevent account sharing and enforce our Terms.',
            'Improve the academy: aggregated analytics on which courses and features are used most.',
            'Measure our adverts: on public pages only, so we can see which adverts lead to event registrations. We do not use it to build our own profile of you across other websites.',
            'Market to you only with your consent — every marketing email includes an unsubscribe link.',
          ],
        },
        {
          heading: 'Payments',
          body: [
            'Card and bank payments are processed by Paystack (PCI-DSS compliant). We receive only your name, email and payment status/reference — never your card number or bank credentials.',
          ],
        },
        {
          heading: 'Sharing your data',
          body: ['We do not sell your personal data. We share it only with:'],
          bullets: [
            'Paystack, solely to process payments you initiate.',
            'Cloud hosting, email and storage providers that help us run the platform, under contract and confidentiality.',
            'Meta (Facebook), solely to measure advertising on our public pages. No name, email, phone number or form answer is shared; Meta processes the measurement data under its own privacy terms.',
            'Authorities, where Nigerian law requires it.',
          ],
        },
        {
          heading: 'Storage and retention',
          body: [
            'Data is stored on secured cloud infrastructure with encryption in transit and access restricted to authorised staff. Account and enrollment records are kept for as long as your account is active and for the period required by Nigerian tax and education record-keeping rules after that. You can request deletion at any time — see your rights below.',
          ],
        },
        {
          heading: 'Your rights under the NDPA',
          body: ['You have the right to:'],
          bullets: [
            'Access the personal data we hold about you.',
            'Correct inaccurate data.',
            'Request deletion of your data (subject to legal retention duties).',
            'Withdraw consent for marketing at any time.',
            'Lodge a complaint with the Nigeria Data Protection Commission (NDPC).',
          ],
        },
        {
          heading: 'Cookies and local storage',
          body: [
            'We use essential cookies and browser local storage to keep you signed in and remember preferences. On public pages only, we also use the Meta pixel to measure our adverts; it sets Meta’s _fbp and _fbc cookies and is not loaded in the dashboard, classroom or meeting rooms. Analytics and community-feature storage are described in our Cookie Policy.',
          ],
        },
        {
          heading: 'Children’s privacy',
          body: [
            'For Kids Tech Academy students under 13, we collect only the child’s first name and learning progress, require verified parent/guardian consent at registration, and give parents full control — including review and deletion of the child’s data.',
          ],
        },
        {
          heading: 'Contact our data team',
          body: [
            'To exercise any right or ask a privacy question, email vaceupacademy@gmail.com with the subject “Data Request”. We respond within 14 days.',
          ],
        },
      ]}
    />
  );
}
