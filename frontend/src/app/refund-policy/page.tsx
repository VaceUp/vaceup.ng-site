import { LegalPage } from '@/components/legal/LegalPage';

export const metadata = { title: 'Refund Policy | VaceUp Digital Academy' };

export default function RefundPage() {
  return (
    <LegalPage
      title="Refund Policy"
      updated="6 September 2026"
      intro="We want every student to get real value from their cohort. If a course isn't right for you, this policy explains exactly when and how refunds work. Refunds are returned through the original payment channel (Paystack) within 10 business days of approval."
      sections={[
        {
          heading: 'Full refund window (before class starts)',
          body: ['You may cancel and receive a 100% refund if you request it in writing up to 3 days before your cohort’s first live class. No reason is required.'],
        },
        {
          heading: 'First-week guarantee',
          body: [
            'Attend the first week and decide it is not for you? Request a refund within 48 hours after the first live class and we will refund 70% of your fee. The deduction covers the live session, materials and platform access already delivered.',
          ],
        },
        {
          heading: 'After the first week',
          body: [
            'From the second live class onward, fees are non-refundable because your seat, tutor time and materials have been fully committed. You may however:',
          ],
          bullets: [
            'Defer once, free of charge, to the next cohort of the same course (written request before the third class).',
            'Transfer your seat to another person before the second class, subject to our approval.',
          ],
        },
        {
          heading: 'When we refund in full, any time',
          body: ['A full refund is due — regardless of timing — if:'],
          bullets: [
            'We cancel or fundamentally reschedule a cohort and you cannot attend the new schedule.',
            'You were charged twice for the same course.',
            'You paid but were never given course access, and we failed to fix it within 5 business days of your report.',
          ],
        },
        {
          heading: 'Non-refundable items',
          body: ['For clarity, refunds do not apply to:'],
          bullets: [
            'Completed courses or issued certificates.',
            'Accounts suspended for breach of our Terms (e.g. sharing course content or disrupting classes).',
            'Free resources, or courses marked non-refundable at checkout.',
          ],
        },
        {
          heading: 'How to request a refund',
          body: [
            'Email info@vaceup.ng from your registered address with the subject “Refund Request”, including your full name, course and payment reference. We acknowledge within 2 business days and decide within 5. Approved refunds are processed back to your original payment method within 10 business days of approval.',
          ],
        },
      ]}
    />
  );
}
