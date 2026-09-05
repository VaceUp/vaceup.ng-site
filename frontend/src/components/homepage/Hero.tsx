'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { Play, ArrowRight } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden" aria-labelledby="hero-title">
      <div className="absolute inset-0 bg-gradient-to-br from-navy-950 via-navy-900 to-teal-brand/20 opacity-5" />
      
      <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] bg-center bg-cover opacity-3" />
      
      <div className="relative max-w-7xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold-brand/10 text-gold-brand text-sm font-semibold mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold-brand opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-gold-brand"></span>
              </span>
              New Cohort Starting January 15th
            </div>
            
            <h1 
              id="hero-title" 
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white leading-[1.1] tracking-tight mb-6"
            >
              Learn. Apply. Earn.{' '}
              <span className="text-gold-brand">Succeed.</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-navy-200 max-w-2xl mx-auto lg:mx-0 mb-10 leading-relaxed">
              Practical digital skills training designed to prepare you for global opportunities 
              and real-world success. Join 30,000+ students building careers in tech.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-16">
              <Link href="/apply">
                <Button size="lg" className="w-full sm:w-auto gap-2">
                  <span>Explore Courses</span>
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="/about">
                <Button variant="outline" size="lg" className="w-full sm:w-auto border-white/20 text-white hover:bg-white/10 gap-2">
                  <Play className="w-5 h-5" />
                  <span>Watch How It Works</span>
                </Button>
              </Link>
            </div>
            
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-8 text-sm">
              <div className="flex items-center gap-2 text-navy-300">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span>No prior experience needed</span>
              </div>
              <div className="flex items-center gap-2 text-navy-300">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span>Flexible payment plans</span>
              </div>
              <div className="flex items-center gap-2 text-navy-300">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span>Career support included</span>
              </div>
            </div>
          </div>
          
          <div className="relative">
            <div className="relative aspect-[4/3] lg:aspect-[16/9] rounded-3xl overflow-hidden bg-gradient-to-br from-navy-900 to-teal-brand/30 shadow-2xl shadow-navy-950/50">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-24 h-24 mx-auto mb-6 rounded-full border-4 border-gold-brand/30 flex items-center justify-center">
                    <Play className="w-10 h-10 text-gold-brand ml-1" />
                  </div>
                  <p className="text-navy-300 text-lg">Watch Our Story</p>
                  <p className="text-navy-400 text-sm mt-1">2:34 min</p>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-navy-950 to-transparent" />
            </div>
            
            <div className="absolute -bottom-6 -left-6 -right-6 grid grid-cols-3 gap-4 md:gap-6">
              <StatCard value="30,000+" label="Students Trained" />
              <StatCard value="5+" label="Expert Instructors" />
              <StatCard value="98%" label="Satisfaction Rate" />
            </div>
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <svg className="w-6 h-6 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-6 text-center hover:border-gold-brand/50 transition-all duration-300">
      <div className="text-3xl sm:text-4xl font-black text-white mb-1">{value}</div>
      <div className="text-navy-300 text-sm">{label}</div>
    </div>
  );
}