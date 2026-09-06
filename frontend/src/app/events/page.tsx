'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const events = [
  {
    id: '1',
    title: 'VaceUp Open Day: Explore Our Campus & Courses',
    description: 'Join us for a day of interactive workshops, campus tours, and live demos. Meet our instructors, chat with current students, and discover which course is right for you.',
    type: 'Open Day',
    date: '2024-02-10',
    time: '10:00 AM - 4:00 PM WAT',
    location: 'VaceUp Campus, Lagos',
    image: '/events/open-day.jpg',
    featured: true,
    registered: 245,
    capacity: 300,
  },
  {
    id: '2',
    title: 'Tech Career Fair 2024: Connect with Top Employers',
    description: 'Meet hiring managers from leading tech companies including Flutterwave, Paystack, Andela, and more. Bring your CV and portfolio for on-the-spot interviews.',
    type: 'Career Fair',
    date: '2024-02-24',
    time: '9:00 AM - 6:00 PM WAT',
    location: 'Landmark Event Centre, Lagos',
    image: '/events/career-fair.jpg',
    featured: false,
    registered: 890,
    capacity: 1000,
  },
  {
    id: '3',
    title: 'AI & Machine Learning Workshop: Build Your First Model',
    description: 'Hands-on workshop for beginners. Learn the fundamentals of ML, build a classification model, and deploy it. No prior ML experience required.',
    type: 'Workshop',
    date: '2024-03-02',
    time: '2:00 PM - 6:00 PM WAT',
    location: 'Virtual (Zoom)',
    image: '/events/ai-workshop.jpg',
    featured: false,
    registered: 156,
    capacity: 200,
  },
  {
    id: '4',
    title: 'Alumni Networking Mixer: Lagos Edition',
    description: 'Connect with fellow VaceUp alumni, share experiences, and build professional relationships. Featuring guest speakers from top tech companies.',
    type: 'Networking',
    date: '2024-03-15',
    time: '6:00 PM - 9:00 PM WAT',
    location: 'The Wheatbaker, Lagos',
    image: '/events/alumni-mixer.jpg',
    featured: false,
    registered: 89,
    capacity: 150,
  },
  {
    id: '5',
    title: 'Web Development Bootcamp Info Session',
    description: 'Learn about our 12-week Web Development program. Curriculum overview, career outcomes, payment options, and Q&A with instructors.',
    type: 'Info Session',
    date: '2024-03-20',
    time: '7:00 PM - 8:30 PM WAT',
    location: 'Virtual (Google Meet)',
    image: '/events/webdev-info.jpg',
    featured: false,
    registered: 234,
    capacity: 500,
  },
  {
    id: '6',
    title: 'Data Analysis Hackathon: Solve Real Business Problems',
    description: '48-hour hackathon using real datasets from partner companies. Prizes include internships, mentorship, and cash awards.',
    type: 'Hackathon',
    date: '2024-04-05',
    time: 'Starts 10:00 AM Saturday',
    location: 'VaceUp Campus, Lagos',
    image: '/events/data-hackathon.jpg',
    featured: false,
    registered: 67,
    capacity: 100,
  },
];

const eventTypes = ['All', 'Open Day', 'Career Fair', 'Workshop', 'Networking', 'Info Session', 'Hackathon'];

export default function EventsPage() {
  const [selectedType, setSelectedType] = useState('All');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const filteredEvents = events.filter(event => {
    return selectedType === 'All' || event.type === selectedType;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-white">
      
      <main>
        {/* Hero Section */}
        <section className="py-20 bg-navy-950">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6">
              Events & Workshops
            </h1>
            <p className="text-lg text-navy-200 max-w-3xl mx-auto">
              Join our community events, workshops, and networking sessions. Learn, connect, and grow with fellow tech enthusiasts.
            </p>
          </div>
        </section>

        {/* Featured Event */}
        <section className="py-12 bg-white">
          <div className="mx-auto max-w-7xl px-6">
            <article className="relative rounded-3xl overflow-hidden">
              <div className="relative aspect-[16/9] lg:aspect-[21/9]">
                <img
                  src={events[0].image}
                  alt={events[0].title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-navy-950/90 via-navy-900/50 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-12">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap gap-3 mb-4">
                      <Badge variant="secondary" className="text-sm">{events[0].type}</Badge>
                      <Badge className="bg-gold-brand text-navy-950 text-sm">{events[0].registered}/{events[0].capacity} Registered</Badge>
                    </div>
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4">{events[0].title}</h2>
                    <p className="text-navy-100 text-lg mb-8 max-w-2xl">{events[0].description}</p>
                    <div className="flex flex-wrap gap-6 text-navy-200 mb-8">
                      <div className="flex items-center gap-2">
                        <LordIconComponent src={LordIcons.calendar} size={20} />
                        <div>
                          <p className="text-sm">Date</p>
                          <p className="font-medium">{formatDate(events[0].date)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <LordIconComponent src={LordIcons.clock} size={20} />
                        <div>
                          <p className="text-sm">Time</p>
                          <p className="font-medium">{events[0].time}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <LordIconComponent src={LordIcons.location} size={20} />
                        <div>
                          <p className="text-sm">Location</p>
                          <p className="font-medium">{events[0].location}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <Button size="lg" className="bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold">
                        Register Now
                        <LordIconComponent src={LordIcons.arrowRight} size={20} className="ml-2" />
                      </Button>
                      <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10">
                        Add to Calendar
                        <LordIconComponent src={LordIcons.calendar} size={20} className="ml-2" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* Filter & View Controls */}
        <section className="py-8 bg-gray-50 border-y border-gray-100">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {eventTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                      selectedType === type
                        ? 'bg-navy-950 text-white shadow-md'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-100'
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">View:</span>
                <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-100">
                  <button
                    onClick={() => setView('grid')}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      view === 'grid' ? 'bg-navy-950 text-white' : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    <LordIconComponent src={LordIcons.grid} size={20} />
                  </button>
                  <button
                    onClick={() => setView('list')}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      view === 'list' ? 'bg-navy-950 text-white' : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    <LordIconComponent src={LordIcons.list} size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Events Grid/List */}
        <section className="py-12 bg-white">
          <div className="mx-auto max-w-7xl px-6">
            {view === 'grid' ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEvents.slice(1).map((event) => (
                  <Link key={event.id} href={`/events/${event.id}`}>
                    <Card className="h-full hover:shadow-xl transition-all duration-300 border-gray-100">
                      <div className="relative aspect-video overflow-hidden rounded-t-xl">
                        <img
                          src={event.image}
                          alt={event.title}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-3 right-3">
                          <Badge variant="secondary" className="text-xs">{event.type}</Badge>
                        </div>
                        <div className="absolute bottom-3 left-3 right-3 flex justify-between">
                          <Badge className="bg-gold-brand text-navy-950">{event.registered}/{event.capacity}</Badge>
                        </div>
                      </div>
                      <CardContent className="p-6">
                        <Badge variant="outline" className="text-xs mb-3 text-navy-700 border-navy-200 bg-navy-50">{event.type}</Badge>
                        <h3 className="font-bold text-navy-950 mb-2 group-hover:text-gold-brand transition-colors line-clamp-2">{event.title}</h3>
                        <p className="text-gray-600 mb-4 line-clamp-2">{event.description}</p>
                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex items-center gap-2 text-navy-700">
                            <LordIconComponent src={LordIcons.calendar} size={16} />
                            <span>{formatDate(event.date)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-navy-700">
                            <LordIconComponent src={LordIcons.clock} size={16} />
                            <span>{event.time}</span>
                          </div>
                          <div className="flex items-center gap-2 text-navy-700">
                            <LordIconComponent src={LordIcons.location} size={16} />
                            <span>{event.location}</span>
                          </div>
                        </div>
                        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                          <span className="font-medium text-navy-900">{event.registered}/{event.capacity} seats filled</span>
                          <Button size="sm" className="bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold">
                            Register
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEvents.slice(1).map((event) => (
                  <Link key={event.id} href={`/events/${event.id}`}>
                    <Card className="hover:shadow-lg transition-all duration-300 border-gray-100">
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row md:items-center gap-6">
                          <div className="relative w-32 h-32 md:w-40 md:h-40 flex-shrink-0 rounded-xl overflow-hidden">
                            <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
                            <Badge variant="secondary" className="absolute top-2 right-2 text-xs">{event.type}</Badge>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap gap-2 mb-2">
                              <Badge variant="outline" className="text-xs text-navy-700 border-navy-200 bg-navy-50">{event.type}</Badge>
                              <Badge className="bg-gold-brand text-navy-950 text-xs">{event.registered}/{event.capacity}</Badge>
                            </div>
                            <h3 className="font-bold text-navy-950 mb-2">{event.title}</h3>
                            <p className="text-gray-600 mb-4 line-clamp-2">{event.description}</p>
                            <div className="flex flex-wrap gap-6 text-sm text-gray-600">
                              <div className="flex items-center gap-2 text-navy-700">
                                <LordIconComponent src={LordIcons.calendar} size={16} />
                                <span>{formatDate(event.date)}</span>
                              </div>
                              <div className="flex items-center gap-2 text-navy-700">
                                <LordIconComponent src={LordIcons.clock} size={16} />
                                <span>{event.time}</span>
                              </div>
                              <div className="flex items-center gap-2 text-navy-700">
                                <LordIconComponent src={LordIcons.location} size={16} />
                                <span>{event.location}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 md:w-48">
                            <Button className="w-full bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold">
                              Register
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Upcoming Cohorts */}
        <section className="py-16 bg-navy-950">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Upcoming Cohort Starts</h2>
              <p className="text-navy-200 max-w-3xl mx-auto">Next intake dates for our flagship programs</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { course: 'Frontend Engineering & React', start: 'Feb 12, 2024', spots: 12, color: 'from-blue-500 to-blue-600' },
                { course: 'Data Analysis & Python', start: 'Feb 19, 2024', spots: 8, color: 'from-green-500 to-green-600' },
                { course: 'UI/UX Design Fundamentals', start: 'Mar 4, 2024', spots: 15, color: 'from-purple-500 to-purple-600' },
              ].map((cohort, i) => (
                <Card key={i} className="bg-navy-900/50 border-navy-800 h-full">
                  <CardContent className="p-8 text-center">
                    <div className={cn('w-20 h-20 rounded-2xl bg-gradient-to-br flex items-center justify-center mx-auto mb-6', cohort.color)}>
                      <LordIconComponent src={LordIcons.graduation} size={40} colors="primary:#ffffff" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{cohort.course}</h3>
                    <div className="flex items-center justify-center gap-2 text-navy-300 mb-4">
                      <LordIconComponent src={LordIcons.calendar} size={20} />
                      <span className="font-medium text-white">{cohort.start}</span>
                    </div>
                    <p className="text-navy-300 mb-6">{cohort.spots} spots remaining</p>
                    <Button className="bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold w-full">
                      Reserve Your Spot
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

    </div>
  );
}