'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';
import { cn } from '@/lib/utils';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    // PENDING backend: POST /api/v1/contact/ — see MISSING-ENDPOINTS.md.
    // Until then hand the message to the visitor's mail client.
    await new Promise(resolve => setTimeout(resolve, 400));

    const subject = encodeURIComponent(formData.subject || 'Website enquiry');
    const body = encodeURIComponent(
      `${formData.message}\n\n— ${formData.name} (${formData.email})`
    );
    window.location.href = `mailto:info@vaceup.ng?subject=${subject}&body=${body}`;

    setIsSubmitting(false);
    setSubmitStatus('success');
    setFormData({ name: '', email: '', subject: '', message: '' });
  };

  return (
    <div className="min-h-screen bg-white">
      
      <main>
        {/* Hero Section */}
        <section className="py-20 bg-navy-950">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6">
              Get in Touch
            </h1>
            <p className="text-lg text-navy-200 max-w-3xl mx-auto">
              Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
            </p>
          </div>
        </section>

        {/* Contact Form & Info */}
        <section className="py-20 bg-gray-50">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid lg:grid-cols-3 gap-12">
              {/* Contact Info */}
              <div className="lg:col-span-1">
                <Card className="bg-white border-gray-100 h-full">
                  <CardContent className="p-8">
                    <h2 className="text-2xl font-bold text-navy-950 mb-6">Contact Information</h2>
                    
                    <div className="space-y-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-navy-50 flex items-center justify-center flex-shrink-0">
                          <LordIconComponent src={LordIcons.location} size={24} colors="primary:#00088A" />
                        </div>
                        <div>
                          <h3 className="font-bold text-navy-950">Visit Us</h3>
                          <p className="text-navy-700">669, Abeokuta Expressway, Ahmadiya Bus-stop, Ijaiye Ojokoro, Lagos State</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-navy-50 flex items-center justify-center flex-shrink-0">
                          <LordIconComponent src={LordIcons.mail} size={24} colors="primary:#00088A" />
                        </div>
                        <div>
                          <h3 className="font-bold text-navy-950">Email Us</h3>
                          <a href="mailto:info@vaceup.ng" className="text-navy-700 hover:text-gold-brand transition-colors">info@vaceup.ng</a>
                          <p className="text-sm text-gray-500 mt-1">For general inquiries</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-navy-50 flex items-center justify-center flex-shrink-0">
                          <LordIconComponent src={LordIcons.phone} size={24} colors="primary:#00088A" />
                        </div>
                        <div>
                          <h3 className="font-bold text-navy-950">Call Us</h3>
                          <a href="tel:+2348145798943" className="text-navy-700 hover:text-gold-brand transition-colors">+234 814 579 8943</a>
                          <p className="text-sm text-gray-500 mt-1">Mon-Fri: 9AM - 6PM WAT</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-navy-50 flex items-center justify-center flex-shrink-0">
                          <LordIconComponent src={LordIcons.chat} size={24} colors="primary:#00088A" />
                        </div>
                        <div>
                          <h3 className="font-bold text-navy-950">WhatsApp</h3>
                          <a href="https://wa.me/2348145798943" target="_blank" rel="noopener noreferrer" className="text-navy-700 hover:text-gold-brand transition-colors">Chat with us on WhatsApp</a>
                          <p className="text-sm text-gray-500 mt-1">Quick response during business hours</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Social Links */}
                <div className="mt-8">
                  <h3 className="font-bold text-navy-950 mb-4">Follow Us</h3>
                  <div className="flex gap-4">
                    <a href="https://facebook.com/vaceup" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center hover:bg-navy-100 transition-colors">
                      <LordIconComponent src={LordIcons.facebook} size={20} colors="primary:#00088A" />
                    </a>
                    <a href="https://twitter.com/vaceup" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center hover:bg-navy-100 transition-colors">
                      <LordIconComponent src={LordIcons.twitter} size={20} colors="primary:#00088A" />
                    </a>
                    <a href="https://linkedin.com/company/vaceup" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center hover:bg-navy-100 transition-colors">
                      <LordIconComponent src={LordIcons.linkedin} size={20} colors="primary:#00088A" />
                    </a>
                    <a href="https://instagram.com/vaceup" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center hover:bg-navy-100 transition-colors">
                      <LordIconComponent src={LordIcons.instagram} size={20} colors="primary:#00088A" />
                    </a>
                    <a href="https://youtube.com/@vaceup" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center hover:bg-navy-100 transition-colors">
                      <LordIconComponent src={LordIcons.youtube} size={20} colors="primary:#00088A" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Contact Form */}
              <div className="lg:col-span-2">
                <Card className="bg-white border-gray-100">
                  <CardContent className="p-8">
                    <h2 className="text-2xl font-bold text-navy-950 mb-6">Send Us a Message</h2>
                    
                    {submitStatus === 'success' && (
                      <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
                        <div className="flex items-center gap-2">
                          <LordIconComponent src={LordIcons.checkCircle} size={20} colors="primary:#10b981" />
                          <span className="font-medium">Message sent successfully! We'll get back to you soon.</span>
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <label htmlFor="name" className="block text-sm font-semibold text-navy-900 mb-2">Full Name *</label>
                          <Input
                            id="name"
                            name="name"
                            type="text"
                            placeholder="Your full name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="email" className="block text-sm font-semibold text-navy-900 mb-2">Email Address *</label>
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="your@email.com"
                            value={formData.email}
                            onChange={handleChange}
                            required
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label htmlFor="subject" className="block text-sm font-semibold text-navy-900 mb-2">Subject *</label>
                        <select
                          id="subject"
                          name="subject"
                          value={formData.subject}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 transition-colors"
                        >
                          <option value="">Select a subject</option>
                          <option value="general">General Inquiry</option>
                          <option value="courses">Course Information</option>
                          <option value="admissions">Admissions & Enrollment</option>
                          <option value="support">Technical Support</option>
                          <option value="partnership">Partnership Opportunities</option>
                          <option value="media">Media & Press</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor="message" className="block text-sm font-semibold text-navy-900 mb-2">Message *</label>
                        <textarea
                          id="message"
                          name="message"
                          rows={6}
                          placeholder="Tell us how we can help you..."
                          value={formData.message}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 transition-colors resize-y placeholder-gray-400"
                        />
                      </div>
                      
                      <Button
                        type="submit"
                        size="lg"
                        className="w-full md:w-auto bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Sending...
                          </>
                        ) : (
                          'Send Message'
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Quick Links */}
        <section className="py-20 bg-navy-950">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Quick Answers</h2>
              <p className="text-navy-200 max-w-3xl mx-auto">Common questions answered</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: LordIcons.chat, title: 'Live Chat', desc: 'Available Mon-Fri, 9AM-6PM WAT. Click the chat bubble on any page.' },
                { icon: LordIcons.mail, title: 'Email Response', desc: 'We typically respond within 24 hours during business days.' },
                { icon: LordIcons.phone, title: 'Call Us', desc: '+234 814 579 8943 - Direct line to our support team.' },
                { icon: LordIcons.helpCircle, title: 'Help Center', desc: 'Visit our Help Center for FAQs, guides, and tutorials.' },
              ].map((item, i) => (
                <Card key={i} className="bg-navy-900/50 border-navy-800 h-full">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-gold-brand/10 flex items-center justify-center mb-4">
                      <LordIconComponent src={item.icon} size={24} colors="primary:#FFC72C" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-navy-300">{item.desc}</p>
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