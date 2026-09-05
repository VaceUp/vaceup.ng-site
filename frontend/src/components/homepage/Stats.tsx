'use client';

import { cn } from '@/lib/utils';

const stats = [
  { value: '30,000+', label: 'Students Trained', icon: '🎓' },
  { value: '5+', label: 'Expert Instructors', icon: '👨‍🏫' },
  { value: '8+', label: 'Courses & Programs', icon: '📚' },
  { value: '98%', label: 'Student Satisfaction', icon: '⭐' },
  { value: '3', label: 'Countries Reached', icon: '🌍' },
  { value: '500+', label: 'Projects Completed', icon: '💼' },
];

export function Stats() {
  return (
    <section className="py-16 bg-white border-y border-gray-100" aria-label="Trust Statistics">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
          {stats.map((stat, index) => (
            <div
              key={label}
              className={cn(
                'text-center p-6 rounded-2xl transition-all duration-300 hover:scale-105',
                index % 2 === 0 ? 'bg-navy-50' : 'bg-gray-50'
              )}
            >
              <div className="text-4xl mb-3">{stat.icon}</div>
              <div className="text-4xl sm:text-5xl font-black text-navy-950 mb-1">{stat.value}</div>
              <div className="text-gray-600 font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}