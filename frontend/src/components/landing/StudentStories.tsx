'use client';

import React from 'react';

interface Testimonial {
  id: string;
  name: string;
  role: string;
  avatar: string;
  rating: number;
  date: string;
  quote: string;
}

const testimonials: Testimonial[] = [
  {
    id: '1',
    name: 'Mike Obasunjo',
    role: 'UI/UX Designer, remote',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
    rating: 5,
    date: '8/18/25',
    quote: '"I joined with zero design experience. Twelve weeks later I had three case studies and my first international client."',
  },
  {
    id: '2',
    name: 'Samuel Otieno',
    role: 'Data Analyst, fintech',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
    rating: 5,
    date: '8/18/25',
    quote: '"The projects were real, not toy exercises. My interview panel spent most of the call on the dashboard I built at VaceUp."',
  },
  {
    id: '3',
    name: 'Mrs. Adeyemi',
    role: 'Parent, Kids Tech Academy',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200',
    rating: 5,
    date: '8/18/25',
    quote: '"My daughter now explains loops to me at dinner. The weekly parent report made me trust the programme immediately."',
  },
];

export const StudentStories: React.FC = () => {
  return (
    <section className="bg-white py-20 text-[#00088A]">
      <div className="mx-auto max-w-7xl px-6">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-[#008B8B]">
            STUDENT STORIES
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#00088A] tracking-tight">
            The proof is in what our graduates go on to do
          </h2>
        </div>

        {/* Testimonial Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((item) => (
            <div
              key={item.id}
              className="bg-[#EBF7F7] rounded-3xl p-8 flex flex-col justify-between space-y-6 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Profile Header */}
              <div className="flex items-center gap-4">
                <img
                  src={item.avatar}
                  alt={item.name}
                  className="w-12 h-12 rounded-full object-cover border border-gray-200"
                />
                <div>
                  <h3 className="font-bold text-base text-[#00088A] leading-tight">
                    {item.name}
                  </h3>
                  <p className="text-xs text-gray-600 font-medium mt-0.5">
                    {item.role}
                  </p>
                </div>
              </div>

              {/* Rating & Date */}
              <div className="flex items-center gap-2">
                <div className="flex text-amber-400 text-sm">
                  {Array.from({ length: item.rating }).map((_, i) => (
                    <span key={i}>★</span>
                  ))}
                </div>
                <span className="text-xs text-gray-500 font-medium">
                  {item.date}
                </span>
              </div>

              {/* Quote */}
              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed font-normal">
                {item.quote}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};