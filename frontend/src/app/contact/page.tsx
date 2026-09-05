'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  MessageCircle, 
  Globe, 
  Shield, 
  CheckCircle,
  Send,
  MapPinIcon
} from 'lucide-react';

const contactInfo = [
  { icon: Mail, title: 'Email Us', value: 'hello@vaceup.ng', desc: 'We respond within 24 hours', href: 'mailto:hello@vaceup.ng' },
  { icon: Phone, title: 'Call Us', value: '+234 800 123 4567', desc: 'Mon-Fri 9AM-6PM WAT', href: 'tel:+2348001234567' },
  { icon: MapPin, title: 'Visit Us', value: 'Victoria Island, Lagos', desc: 'By appointment only', href: '#' },
  { icon: Clock, title: 'Office Hours', value: 'Mon-Fri 9AM-6PM', desc: 'Weekends by appointment', href: '#' },
];

const faqs = [
  { q: 'What age groups do you accept?', a: 'We offer programs for children ages 6-17, grouped by age and skill level.' },
  { q: 'Do you offer trial classes?', a: 'Yes! We offer a free 1-hour trial class so your child can experience our teaching style before enrolling.' },
  { q: 'What equipment is needed?', a: 'A laptop or desktop with internet connection. We provide all software licenses and learning materials.' },
  { q: 'Are classes recorded?', a: 'Yes, all live sessions are recorded and available for review in the parent dashboard for 30 days.' },
  { q: 'What is your refund policy?', a: 'Full refund within 14 days of enrollment if your child doesn\'t enjoy the program. No questions asked.' },
  { q: 'Do you offer sibling discounts?', a: 'Yes! 10% off for the second child, 15% off for the third and subsequent children.' },
];

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    childAge: '',
    interest: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    // Simulate form submission
    await new Promise(r => setTimeout(r, 2000));
    
    setSubmitted(true);
    setFormData({ name: '', email: '', phone: '', childAge: '', interest: '', message: '' });
    setSubmitting(false);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="mb-8 inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-100">
            <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-navy-950 mb-4">Message Sent Successfully!</h1>
          <p className="text-gray-600 mb-8">
            Thank you for reaching out to VaceUp Digital Academy. We'll get back to you within 24 hours.
          </p>
          <Link href="/">
            <Button className="bg-gold-brand hover:bg-[#ebd024] text-navy-950 font-bold px-8 py-4">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-br from-navy-950 via-navy-900 to-purple-900/20 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md px-4 py-1.5 text-xs sm:text-sm font-semibold text-white mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              Contact Us
            </span>
            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white leading-[1.1] tracking-tight">
              Let&apos;s Start a Conversation
            </h1>
            <p className="mt-8 max-w-3xl mx-auto text-lg text-navy-200 leading-relaxed">
              Have questions about our programs, pricing, or partnership opportunities?
              Our team is here to help you find the perfect educational path for your child or your organization.
            </p>
          </div>
        </div>
      </div>

      <section className="py-16 bg-gray-50">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
            <div>
              <div className="space-y-6 mb-12">
                {contactInfo.map((info) => (
                  <a
                    key={info.title}
                    href={info.href}
                    className="flex items-start gap-5 p-6 rounded-2xl bg-white hover:shadow-lg transition-all duration-300 group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-teal-brand/10 flex items-center justify-center group-hover:bg-teal-brand group-hover:text-white transition-all duration-300">
                      <info.icon className="w-6 h-6 text-teal-brand group-hover:text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-navy-950 mb-1">{info.title}</h3>
                      <p className="text-teal-brand font-medium">{info.value}</p>
                      <p className="text-gray-500 text-sm">{info.desc}</p>
                    </div>
                  </a>
                ))}
              </div>

              <div className="bg-navy-900/50 border-navy-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Quick Facts</h3>
                <div className="space-y-3 text-navy-200 text-sm">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-gold-brand flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>500+ successful placements</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-gold-brand flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>98% student satisfaction rate</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-gold-brand flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>3 countries served</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-gold-brand flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>ISO-certified curriculum</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Send us a Message</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      Your Name *
                    </label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="John Doe"
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-brand focus:border-teal-brand transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="john@example.com"
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-brand focus:border-teal-brand transition-all"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <Input
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+234 800 123 4567"
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-brand focus:border-teal-brand transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="childAge" className="block text-sm font-medium text-gray-700 mb-2">
                      Child's Age (if applicable)
                    </label>
                    <select
                      id="childAge"
                      name="childAge"
                      value={formData.childAge}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-brand focus:border-teal-brand transition-all bg-white"
                    >
                      <option value="">Select age</option>
                      <option value="6-9">6-9 years</option>
                      <option value="10-13">10-13 years</option>
                      <option value="14-17">14-17 years</option>
                      <option value="not-applicable">Not applicable</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="interest" className="block text-sm font-medium text-gray-700 mb-2">
                    Program of Interest *
                  </label>
                  <select
                    id="interest"
                    name="interest"
                    value={formData.interest}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-brand focus:border-teal-brand transition-all bg-white"
                  >
                    <option value="">Select a program</option>
                    <option value="virtual-assistant">Virtual Assistant</option>
                    <option value="data-analysis">Data Analysis</option>
                    <option value="ui-ux">UI/UX Design</option>
                    <option value="graphic-design">Graphic Design</option>
                    <option value="web-development">Web Development</option>
                    <option value="kids-academy">VaceUp Kids Tech Academy</option>
                    <option value="general">General Inquiry</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    rows={6}
                    placeholder="Tell us about your goals, or ask a question..."
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-brand focus:border-teal-brand transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-gold-brand hover:bg-[#ebd024] text-navy-950 font-bold px-8 py-4 text-lg gap-3"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin rounded-full h-4 w-4 border-2 border-navy-950 border-t-transparent" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending Message...
                    </>
                  ) : (
                    <>
                      Send Message
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2m0 0l-5-5m5-5h-12" />
                      </svg>
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="mx-auto max-w-7xl px-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">Frequently Asked Questions</h3>
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
              {faqs.map((faq) => (
                <div
                  key={faq.q}
                  className="p-6 rounded-2xl border border-gray-200 hover:border-teal-brand hover:shadow-md transition-all duration-300"
                >
                  <h4 className="font-bold text-gray-900 mb-3 flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-teal-brand/10 flex items-center justify-center">
                      <span className="text-teal-brand font-black text-sm">Q</span>
                    </span>
                    {faq.q}
                  </h4>
                  <p className="text-gray-600 mt-3">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 bg-navy-950">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to Start Your Learning Journey?
            </h2>
            <p className="text-navy-300 max-w-3xl mx-auto text-lg mb-8">
              Join thousands of students worldwide who have transformed their careers with VaceUp Digital Academy.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/apply" className="w-full sm:w-auto">
                <Button size="lg" variant="kids" className="w-full sm:w-auto gap-2 text-lg px-8 py-4">
                  <span>Apply Now</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </Button>
              </Link>
              <Link href="/courses" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto border-2 border-white text-white hover:bg-white/10 gap-2 text-lg px-8 py-4">
                  Explore Courses
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </>
    );
  };
}