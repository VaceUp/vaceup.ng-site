import { LegalPage } from '@/components/legal/LegalPage';

export const metadata = { title: 'Terms & Conditions | VaceUp Digital Academy' };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      updated="6 September 2026"
      intro="These Terms govern your use of vaceup.ng and every service VaceUp Digital Academy ('VaceUp', 'we', 'us') provides through it — including courses, live classes, learning materials, assessments, certificates and community features. By creating an account, enrolling in a course or using the platform, you accept these Terms. If you do not agree, please do not use the platform."
      sections={[
        {
          heading: 'Who we are',
          body: [
            'VaceUp Digital Academy is a practical technology training academy registered and operating in Lagos, Nigeria, with a physical campus at 669 Abeokuta Expressway, Ahmadiya Bus-stop, Ijaiye Ojokoro, Lagos State. We deliver instructor-led cohorts, live classes and self-paced digital skills training online and on-site.',
          ],
        },
        {
          heading: 'Accounts and eligibility',
          body: ['To enroll you must create an account with accurate, current information. You are responsible for keeping your login credentials confidential and for all activity under your account.'],
          bullets: [
            'You must be at least 13 years old to create an account independently. Learners under 13 may only use the platform through a parent or guardian, including our Kids Tech Academy programs.',
            'One person per account — account sharing is not permitted and may result in suspension.',
            'Notify us immediately at info@vaceup.ng if you suspect unauthorised access to your account.',
          ],
        },
        {
          heading: 'Enrollment, fees and payment',
          body: [
            'Course fees are quoted in Nigerian Naira (₦) and are payable in full before a cohort begins, unless an instalment plan is explicitly offered on the course page. Payments are processed by Paystack; we never see or store your card details.',
            'Your enrollment is confirmed only after payment is successfully verified. Access to course content, live classes and materials begins from the confirmed start date of your cohort.',
          ],
          bullets: [
            'Prices, schedules and course content may be updated before a cohort starts; enrolled students are never charged extra for a cohort they have already paid for.',
            'Promotional or scholarship pricing applies only to the cohorts stated in the offer.',
          ],
        },
        {
          heading: 'Refunds',
          body: [
            'Our Refund Policy (available at /refund-policy) forms part of these Terms and explains when refunds are available and how to request one.',
          ],
        },
        {
          heading: 'Course access and materials',
          body: [
            'When you enroll, we grant you a personal, non-transferable licence to access the course materials for the duration of your cohort and any stated access window. Materials are provided for your own learning.',
          ],
          bullets: [
            'Do not copy, record, redistribute, resell or publicly share course videos, documents, source files or live-class access links.',
            'Recordings of live classes are provided for personal revision and may not be re-uploaded anywhere.',
            'We may revoke access for accounts that violate these Terms, without refund where the violation is material.',
          ],
        },
        {
          heading: 'Live classes and conduct',
          body: [
            'Live classes are core to the VaceUp experience. We expect respectful, professional behaviour in every class, chat, review and community space.',
          ],
          bullets: [
            'Do not disrupt classes, harass, insult or discriminate against tutors or fellow students.',
            'Do not share class links or recordings with non-enrolled persons.',
            'Tutors may remove disruptive participants from a live session; repeated misconduct may lead to suspension without refund.',
          ],
        },
        {
          heading: 'Certificates',
          body: [
            'Certificates are issued when you complete the stated requirements of a course — including attendance, assignments and final assessment. Certificates carry a unique verification code that anyone can check on our verification page. We may decline to issue a certificate where completion requirements are not genuinely met.',
          ],
        },
        {
          heading: 'Community content and reviews',
          body: [
            'You may post reviews, testimonials and other content on the platform. You keep ownership of what you write but grant VaceUp a non-exclusive licence to display it on the platform and in our marketing.',
          ],
          bullets: [
            'Only post content that is truthful, lawful and yours to share. Do not post another person’s photo without their permission.',
            'We may remove content that is defamatory, spam, offensive or infringes others’ rights.',
          ],
        },
        {
          heading: 'Intellectual property',
          body: [
            'All platform content — including curricula, videos, slides, templates, brand assets and software — belongs to VaceUp or its licensors and is protected by copyright and other laws. Except for the personal learning licence above, no rights are transferred to you.',
          ],
        },
        {
          heading: 'Availability and service changes',
          body: [
            'We work hard to keep the platform available, including tools designed to keep working on unreliable networks, but we do not guarantee uninterrupted service. Live classes may occasionally be rescheduled; material changes are communicated to enrolled students by email and in-app announcement. Features may be added, modified or retired over time as the academy grows.',
          ],
        },
        {
          heading: 'Limitation of liability',
          body: [
            'To the fullest extent permitted by Nigerian law, VaceUp is not liable for indirect or consequential losses — including lost income or missed job opportunities — arising from use of the platform. Our total liability for any claim relating to a course is limited to the fee you paid for that course.',
          ],
        },
        {
          heading: 'Governing law and disputes',
          body: [
            'These Terms are governed by the laws of the Federal Republic of Nigeria. Disputes will first be addressed through good-faith discussion with our support team; unresolved disputes are subject to the courts of Lagos State, Nigeria.',
          ],
        },
        {
          heading: 'Changes to these Terms',
          body: [
            'We may update these Terms from time to time. The “Last updated” date above changes with each revision, and material changes are announced on the platform. Continuing to use the platform after an update means you accept the revised Terms.',
          ],
        },
      ]}
    />
  );
}
