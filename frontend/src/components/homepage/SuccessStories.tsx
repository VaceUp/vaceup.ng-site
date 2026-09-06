'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';

const testimonials = [
  {
    name: 'Adaeze Okonkwo',
    role: 'Data Analyst at Flutterwave',
    course: 'Data Analysis',
    image: '/testimonials/adaeze.jpg',
    text: 'VaceUp transformed my career. The hands-on projects gave me a portfolio that got me hired within 2 months of graduating. The instructors genuinely care about your success.',
    rating: 5,
  },
  {
    name: 'Chinedu Eze',
    role: 'UI/UX Designer at Andela',
    course: 'UI/UX Design',
    image: '/testimonials/chinedu.jpg',
    text: 'The live classes made all the difference. Being able to ask questions in real-time and get feedback on my designs in real-time accelerated my learning tremendously.',
    rating: 5,
  },
  {
    name: 'Fatima Yusuf',
    role: 'Virtual Assistant (Freelance)',
    course: 'Virtual Assistant',
    image: '/testimonials/fatima.jpg',
    text: 'As a stay-at-home mom, the flexible schedule was perfect. I now earn in dollars working with international clients. The career support team helped me land my first 3 clients.',
    rating: 5,
  },
  {
    name: 'Ibrahim Musa',
    role: 'Frontend Developer at Paystack',
    course: 'Web Development',
    image: '/testimonials/ibrahim.jpg',
    text: 'The project-based approach meant I graduated with 5 real projects in my portfolio. The mock interviews and resume review were crucial for landing my role.',
    rating: 5,
  },
];

function TestimonialCard({ testimonial }: { testimonial: typeof testimonials[0] }) {
  return (
    <div className={cn(
      'flex flex-col h-full p-8 rounded-2xl bg-white border border-gray-100 hover:shadow-xl transition-all duration-300'
    )}>
      <div className="flex items-center gap-1 mb-4">
        {[...Array(testimonial.rating)].map((_, i) => (
          <LordIconComponent key={i} src={LordIcons.star} colors="primary:#FFC72C" size={20} />
        ))}
      </div>
      <LordIconComponent src={LordIcons.quote} size={40} colors="primary:#00088A" className="opacity-10 mb-4" />
      <p className="text-navy-900 leading-relaxed mb-6 flex-1">"{testimonial.text}"</p>
      <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-navy-900 to-teal-brand flex items-center justify-center text-white font-bold text-lg">
          {testimonial.name.split(' ').map(n => n[0]).join('')}
        </div>
        <div>
          <div className="font-bold text-navy-950">{testimonial.name}</div>
          <div className="text-sm text-navy-700">{testimonial.role}</div>
          <div className="text-xs text-gold-brand font-medium">{testimonial.course} Graduate</div>
        </div>
      </div>
    </div>
  );
}

export function SuccessStories() {
  return (
    <section className="py-20 bg-white" aria-labelledby="stories-heading">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 id="stories-heading" className="text-3xl sm:text-4xl font-black text-navy-950 mb-4">
            Success Stories
          </h2>
          <p className="text-navy-700 max-w-3xl mx-auto text-lg">
            Real students. Real results. See how VaceUp alumni are building careers in tech across the globe.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial) => (
            <TestimonialCard key={testimonial.name} testimonial={testimonial} />
          ))}
        </div>

        <div className="text-center mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/testimonials"
            className="inline-flex items-center gap-2 rounded-xl border-2 border-navy-900 px-6 py-3 text-sm font-bold text-navy-900 transition-colors hover:bg-navy-50"
          >
            View All Success Stories
            <LordIconComponent src={LordIcons.arrowRight} size={20} colors="primary:#00088A,secondary:#FFC72C" />
          </Link>
          <Link
            href="/testimonials#share"
            className="inline-flex items-center gap-2 rounded-xl bg-gold-brand px-6 py-3 text-sm font-bold text-navy-950 shadow-md transition-all hover:bg-gold-hover active:scale-95"
          >
            <i className="bi bi-pencil-square" aria-hidden="true" />
            Share Your Story
          </Link>
        </div>
      </div>
    </section>
  );
}