'use client';

import Link from 'next/link';

export default function AboutPage() {
  return (
    <div>
      <section className="py-20 bg-gradient-to-b from-navy-950 via-navy-900 to-purple-900/20">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <span className="inline-block px-4 py-2 rounded-full bg-gold-brand/10 text-gold-brand text-sm font-semibold mb-6">
            Our Story
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-navy-950 mb-6">
            Building Africa&apos;s Next Generation of <span className="text-gold-brand">Tech Innovators</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
            VaceUp Digital Academy was born from a simple belief: every African deserves access to world-class technology education that leads to real careers.
          </p>
          <Link href="/apply" className="inline-block mt-8 bg-gold-brand text-navy-950 font-bold px-8 py-3 rounded-xl hover:bg-yellow-600 transition-colors">
            Join Our Community
          </Link>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <h2 className="text-3xl font-bold text-navy-950 mb-4">Our Values</h2>
          <p className="text-gray-600 max-w-3xl mx-auto mb-12">Our principles guide everything we do.</p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 bg-gray-50 rounded-2xl">
              <h3 className="text-xl font-bold mb-2">Excellence First</h3>
              <p className="text-gray-600">Highest standards in curriculum design and instruction.</p>
            </div>
            <div className="p-6 bg-gray-50 rounded-2xl">
              <h3 className="font-bold mb-2">Community Driven</h3>
              <p className="text-gray-600">Supportive communities where students grow together.</p>
            </div>
            <div className="p-6 bg-gray-50 rounded-2xl">
              <h3 className="font-bold mb-2">Continuous Innovation</h3>
              <p className="text-gray-600">Evolving curriculum matching tech pace.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}