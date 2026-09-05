'use client';

import { cn } from '@/lib/utils';
import { 
  LaptopCode, 
  Users, 
  Award, 
  Briefcase, 
  Globe, 
  Clock, 
  BookOpen, 
  Shield 
} from 'lucide-react';

const features = [
  {
    icon: LaptopCode,
    title: 'Practical Training',
    description: 'Students work on real-world projects that simulate actual industry challenges. Every module includes hands-on exercises.',
  },
  {
    icon: Users,
    title: 'Live & Interactive Classes',
    description: 'Learn directly from instructors in real-time. Ask questions, participate in discussions, and get immediate feedback.',
  },
  {
    icon: Award,
    title: 'Expert Mentors',
    description: 'Industry professionals with 10+ years experience guide your learning journey. They\'ve built products you use daily.',
  },
  {
    icon: Briefcase,
    title: 'Career Support',
    description: 'Resume reviews, mock interviews, portfolio building, and job referrals. We\'re invested in your career success.',
  },
  {
    icon: Globe,
    title: 'Global Certification',
    description: 'Earn verifiable digital certificates recognized by employers worldwide. Each certificate has a unique verification code.',
  },
  {
    icon: Clock,
    title: 'Flexible Learning',
    description: 'Evening and weekend classes accommodate working professionals. Recorded sessions available for review anytime.',
  },
  {
    icon: BookOpen,
    title: 'Community Access',
    description: 'Join 30,000+ alumni in our exclusive community. Network, collaborate, and grow with peers across Africa.',
  },
  {
    icon: Shield,
    title: 'Project-Based Learning',
    description: 'Graduate with a portfolio of real projects. Show employers what you can do, not just what you know.',
  },
];

export function WhyVaceUp() {
  return (
    <section className="py-20 bg-white" aria-labelledby="why-heading">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 id="why-heading" className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Why Choose VaceUp?
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-3xl mx-auto text-lg">
            We don\'t just teach technology—we prepare you for a career in it. Every aspect of our academy 
            is designed around your success.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={cn(
                'group p-8 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-xl transition-all duration-500 border border-gray-100',
                index % 2 === 0 ? 'border-navy-100' : 'border-transparent'
              )}
            >
              <div className="w-14 h-14 rounded-xl bg-navy-100 flex items-center justify-center mb-6 group-hover:bg-navy-900 group-hover:text-white transition-all duration-300">
                <feature.icon className="w-7 h-7 text-navy-900 group-hover:text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{feature.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}