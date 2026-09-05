'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { Code, Brain, Globe, Palette, MousePointer, Laptop } from 'lucide-react';

const kidsPrograms = [
  { icon: Code, title: 'Coding for Kids', age: 'Ages 8-14', duration: '8 weeks', color: 'from-blue-500 to-blue-600' },
  { icon: Brain, title: 'AI & Robotics', age: 'Ages 10-16', duration: '10 weeks', color: 'from-purple-500 to-purple-600' },
  { icon: Globe, title: 'Digital Literacy', age: 'Ages 6-12', duration: '6 weeks', color: 'from-green-500 to-green-600' },
  { icon: Palette, title: 'Creative Design', age: 'Ages 9-15', duration: '8 weeks', color: 'from-pink-500 to-pink-600' },
  { icon: MousePointer, title: 'Game Development', age: 'Ages 10-16', duration: '10 weeks', color: 'from-orange-500 to-orange-600' },
  { icon: Laptop, title: 'Web Design Basics', age: 'Ages 12-17', duration: '8 weeks', color: 'from-teal-500 to-teal-600' },
];

export function KidsAcademy() {
  return (
    <section className="py-20 bg-navy-950" aria-labelledby="kids-heading">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 rounded-full bg-gold-brand/10 text-gold-brand text-sm font-semibold mb-6">
            VaceUp Kids Tech Academy
          </span>
          <h2 id="kids-heading" className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Preparing Young Minds for the Future
          </h2>
          <p className="text-navy-300 max-w-3xl mx-auto text-lg">
            Fun, engaging technology programs designed specifically for children and teenagers. 
            Building the next generation of African tech innovators.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {kidsPrograms.map((program) => (
            <Card 
              key={program.title} 
              variant="glass" 
              className="bg-navy-900/50 border-navy-800 h-full"
            >
              <CardContent className="p-6">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br {program.color} flex items-center justify-center mb-4">
                  <program.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{program.title}</h3>
                <div className="flex items-center gap-4 text-sm text-navy-300 mb-4">
                  <span>{program.age}</span>
                  <span>•</span>
                  <span>{program.duration}</span>
                </div>
                <p className="text-navy-400 text-sm mb-6">
                  Hands-on, age-appropriate curriculum designed by educators and tech professionals.
                </p>
                <Link href="/kids-academy">
                  <Button variant="outline" size="sm" className="w-full border-navy-700 text-navy-300 hover:bg-navy-800 hover:border-gold-brand hover:text-gold-brand">
                    Learn More
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="text-center p-6">
            <div className="w-16 h-16 rounded-full bg-gold-brand/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🛡️</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Safe Learning Environment</h3>
            <p className="text-navy-400">Moderated classes, background-checked instructors, and secure platform.</p>
          </div>
          <div className="text-center p-6">
            <div className="w-16 h-16 rounded-full bg-gold-brand/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📜</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Certificates of Completion</h3>
            <p className="text-navy-400">Every child receives a verified certificate to celebrate their achievement.</p>
          </div>
          <div className="text-center p-6">
            <div className="w-16 h-16 rounded-full bg-gold-brand/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">👨‍👩‍👧‍👦</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Parent Dashboard</h3>
            <p className="text-navy-400">Track progress, view projects, and communicate with instructors.</p>
          </div>
        </div>

        <div className="text-center">
          <Link href="/kids-academy">
            <Button size="lg" variant="primary" className="bg-gold-brand text-navy-950 hover:bg-gold-hover">
              Explore Kids Academy
              <span className="w-5 h-5 ml-2">→</span>
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}