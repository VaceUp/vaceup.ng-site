'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const FALLBACK_COURSES = [
  { id: '1', title: 'Virtual Assistant', price: 80000, duration: '6 weeks' },
  { id: '2', title: 'Data Analysis', price: 150000, duration: '10 weeks' },
  { id: '3', title: 'UI/UX Design', price: 120000, duration: '8 weeks' },
  { id: '4', title: 'Graphic Design', price: 100000, duration: '8 weeks' },
  { id: '5', title: 'Web Development', price: 180000, duration: '12 weeks' },
];

const steps = [
  { number: 1, title: 'Select Course', description: 'Choose your program' },
  { number: 2, title: 'Personal Info', description: 'Tell us about yourself' },
  { number: 3, title: 'Motivation', description: 'Why this course?' },
  { number: 4, title: 'Review & Submit', description: 'Confirm your application' },
];

export default function ApplyPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [courses, setCourses] = useState(FALLBACK_COURSES);
  const [serverError, setServerError] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    country: '',
    city: '',
    education: '',
    currentRole: '',
    experience: '',
    linkedin: '',
    github: '',
    motivation: '',
    goals: '',
    heardFrom: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // BUSINESS RULE: registration comes before application/payment
  useEffect(() => {
    if (typeof window !== 'undefined' && !api.getToken()) {
      const next = encodeURIComponent('/apply' + window.location.search);
      router.replace('/register?next=' + next);
    }
  }, [router]);

  // Preselect a course when arriving via Enroll buttons (/apply?course=ID)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preset = params.get('course');
    if (preset) setSelectedCourse(preset);
  }, []);

  // Load the live course catalog; fall back to the static list if the API is unreachable
  useEffect(() => {
    let cancelled = false;
    api
      .getCourses()
      .then((res) => {
        if (cancelled || !res.results?.length) return;
        setCourses(
          res.results.map((c) => ({
            id: c.id,
            title: c.title,
            price: c.numeric_price,
            duration: c.duration,
          }))
        );
      })
      .catch(() => {
        /* backend offline — keep fallback list */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (step === 1) {
      if (!selectedCourse) newErrors.course = 'Please select a course';
    }
    if (step === 2) {
      if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
      if (!formData.email.trim()) newErrors.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Invalid email format';
      if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
      if (!formData.country.trim()) newErrors.country = 'Country is required';
      if (!formData.city.trim()) newErrors.city = 'City is required';
    }
    if (step === 3) {
      if (!formData.motivation.trim()) newErrors.motivation = 'Please tell us why you want to join';
      if (!formData.goals.trim()) newErrors.goals = 'Please share your career goals';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(4)) return;

    // BUSINESS RULE: register before paying — captures leads for admin
    // marketing campaigns and keeps payments tied to real accounts.
    if (!api.getToken()) {
      const next = encodeURIComponent('/apply' + window.location.search);
      router.push('/register?next=' + next);
      return;
    }

    setIsSubmitting(true);
    setServerError('');
    try {
      // Keep the profile in sync with what the applicant typed
      await api
        .updateProfile({
          full_name: formData.fullName.trim(),
          phone_number: formData.phone.trim(),
        })
        .catch(() => undefined);
      await api.submitApplication({
        course_id: selectedCourse,
        motivation: [
          formData.motivation.trim(),
          formData.goals.trim() ? `Career goals: ${formData.goals.trim()}` : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
      });
      setSubmitStatus('success');
    } catch (err: any) {
      setServerError(err?.message || 'Unable to submit your application right now. Please try again.');
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const selectedCourseData = courses.find(c => c.id === selectedCourse);

  if (submitStatus === 'success') {
    return (
      <div className="min-h-screen bg-white">
        <main className="py-20">
          <div className="mx-auto max-w-2xl px-6 text-center">
            <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <LordIconComponent src={LordIcons.checkCircle} size={48} colors="primary:#10b981" />
            </div>
            <h1 className="text-3xl font-black text-navy-950 mb-4">Application Submitted!</h1>
            <p className="text-gray-600 mb-8">
              Thank you for applying to <strong className="text-navy-900">{selectedCourseData?.title}</strong>. 
              Our admissions team will review your application and get back to you within 2-3 business days.
            </p>
            <div className="bg-gray-50 rounded-2xl p-6 mb-8">
              <h3 className="font-bold text-navy-950 mb-4">What happens next?</h3>
              <ul className="space-y-3 text-left text-gray-600">
                <li className="flex items-center gap-2"><LordIconComponent src={LordIcons.checkCircle} size={18} colors="primary:#10b981" /> Application received and logged</li>
                <li className="flex items-center gap-2"><LordIconComponent src={LordIcons.checkCircle} size={18} colors="primary:#10b981" /> Admissions team review (2-3 business days)</li>
                <li className="flex items-center gap-2"><LordIconComponent src={LordIcons.checkCircle} size={18} colors="primary:#10b981" /> You'll receive an email with next steps</li>
                <li className="flex items-center gap-2"><LordIconComponent src={LordIcons.checkCircle} size={18} colors="primary:#10b981" /> If approved, payment instructions will follow</li>
              </ul>
            </div>
            <Button size="lg" className="bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold" onClick={() => window.location.href = '/'}>
              Back to Home
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      
      <main className="py-12">
        <div className="mx-auto max-w-3xl px-6">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {steps.map((step, index) => (
                <React.Fragment key={step.number}>
                  <div className={cn(
                    'flex flex-col items-center',
                    index === steps.length - 1 && 'hidden'
                  )}>
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all',
                      currentStep > step.number
                        ? 'bg-gold-brand text-navy-950'
                        : currentStep === step.number
                        ? 'bg-navy-950 text-white ring-4 ring-navy-950/20'
                        : 'bg-gray-200 text-gray-500'
                    )}>
                      {currentStep > step.number ? (
                        <LordIconComponent src={LordIcons.check} size={20} colors="primary:#00088A" />
                      ) : (
                        step.number
                      )}
                    </div>
                    <span className={cn(
                      'text-xs font-medium mt-1 hidden sm:block',
                      currentStep >= step.number ? 'text-navy-950' : 'text-gray-400'
                    )}>
                      {step.title}
                    </span>
                  </div>
                  <div className={cn(
                    'flex-1 h-1 mx-2 transition-all',
                    currentStep > step.number ? 'bg-gold-brand' : 'bg-gray-200'
                  )} />
                </React.Fragment>
              ))}
            </div>
            <div className="text-center text-sm text-gray-500">
              Step {currentStep} of {steps.length}: {steps[currentStep - 1].description}
            </div>
          </div>

          {/* Course Selection - Step 1 */}
          {currentStep === 1 && (
            <Card className="bg-white border-gray-100">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-black text-navy-950 mb-2">Select Your Course</h2>
                  <p className="text-gray-600">Choose the program that aligns with your career goals</p>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {courses.map((course) => (
                    <button
                      key={course.id}
                      onClick={() => setSelectedCourse(course.id)}
                      className={cn(
                        'relative p-6 rounded-2xl border-2 transition-all text-left group',
                        selectedCourse === course.id
                          ? 'border-gold-brand bg-gold-brand/5 shadow-lg'
                          : 'border-gray-100 hover:border-navy-200 hover:shadow-md'
                      )}
                    >
                      {selectedCourse === course.id && (
                        <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-gold-brand flex items-center justify-center">
                          <LordIconComponent src={LordIcons.check} size={20} colors="primary:#00088A" />
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-gold-brand mb-2">
                        <LordIconComponent src={LordIcons.star} size={16} colors="primary:#FFC72C" />
                        <span className="font-bold">4.9</span>
                        <span className="text-gray-400 text-sm">(1,200+ reviews)</span>
                      </div>
                      <h3 className="font-bold text-navy-950 mb-1">{course.title}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                        <span className="flex items-center gap-1">
                          <LordIconComponent src={LordIcons.clock} size={14} />
                          {course.duration}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <span className="font-bold text-lg text-navy-950">{formatCurrency(course.price)}</span>
                        <Badge variant="secondary" className="text-xs">Enroll</Badge>
                      </div>
                    </button>
                  ))}
                </div>
                {errors.course && (
                  <p className="mt-4 text-center text-red-500 text-sm">{errors.course}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Personal Info - Step 2 */}
          {currentStep === 2 && (
            <Card className="bg-white border-gray-100">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-black text-navy-950 mb-2">Personal Information</h2>
                  <p className="text-gray-600">Help us get to know you better</p>
                </div>
                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="fullName" className="block text-sm font-semibold text-navy-900 mb-2">Full Name *</label>
                      <Input
                        id="fullName"
                        name="fullName"
                        placeholder="John Doe"
                        value={formData.fullName}
                        onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                        error={errors.fullName}
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-semibold text-navy-900 mb-2">Email Address *</label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        error={errors.email}
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="phone" className="block text-sm font-semibold text-navy-900 mb-2">Phone Number *</label>
                      <Input
                        id="phone"
                        name="phone"
                        placeholder="+234 800 000 0000"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        error={errors.phone}
                      />
                    </div>
                    <div>
                      <label htmlFor="country" className="block text-sm font-semibold text-navy-900 mb-2">Country *</label>
                      <Input
                        id="country"
                        name="country"
                        placeholder="Nigeria"
                        value={formData.country}
                        onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                        error={errors.country}
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="city" className="block text-sm font-semibold text-navy-900 mb-2">City *</label>
                      <Input
                        id="city"
                        name="city"
                        placeholder="Lagos"
                        value={formData.city}
                        onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                        error={errors.city}
                      />
                    </div>
                    <div>
                      <label htmlFor="education" className="block text-sm font-semibold text-navy-900 mb-2">Highest Education</label>
                      <Input
                        id="education"
                        name="education"
                        placeholder="Bachelor's in Computer Science"
                        value={formData.education}
                        onChange={(e) => setFormData(prev => ({ ...prev, education: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="currentRole" className="block text-sm font-semibold text-navy-900 mb-2">Current Role</label>
                      <Input
                        id="currentRole"
                        name="currentRole"
                        placeholder="Junior Developer / Student / Unemployed"
                        value={formData.currentRole}
                        onChange={(e) => setFormData(prev => ({ ...prev, currentRole: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label htmlFor="experience" className="block text-sm font-semibold text-navy-900 mb-2">Years of Experience</label>
                      <Input
                        id="experience"
                        name="experience"
                        placeholder="0"
                        value={formData.experience}
                        onChange={(e) => setFormData(prev => ({ ...prev, experience: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="linkedin" className="block text-sm font-semibold text-navy-900 mb-2">LinkedIn Profile</label>
                      <Input
                        id="linkedin"
                        name="linkedin"
                        placeholder="https://linkedin.com/in/yourname"
                        value={formData.linkedin}
                        onChange={(e) => setFormData(prev => ({ ...prev, linkedin: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label htmlFor="github" className="block text-sm font-semibold text-navy-900 mb-2">GitHub Profile</label>
                      <Input
                        id="github"
                        name="github"
                        placeholder="https://github.com/yourname"
                        value={formData.github}
                        onChange={(e) => setFormData(prev => ({ ...prev, github: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Motivation - Step 3 */}
          {currentStep === 3 && (
            <Card className="bg-white border-gray-100">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-black text-navy-950 mb-2">Tell Us Your Story</h2>
                  <p className="text-gray-600">Help us understand your motivation and goals</p>
                </div>
                <div className="space-y-6">
                  <div>
                    <label htmlFor="motivation" className="block text-sm font-semibold text-navy-900 mb-2">
                      Why do you want to join this program? * <span className="text-gray-400">(min 100 characters)</span>
                    </label>
                    <textarea
                      id="motivation"
                      name="motivation"
                      rows={6}
                      placeholder="I want to learn..."
                      value={formData.motivation}
                      onChange={(e) => setFormData(prev => ({ ...prev, motivation: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 transition-colors resize-y placeholder-gray-400"
                    />
                    {errors.motivation && <p className="mt-1 text-red-500 text-sm">{errors.motivation}</p>}
                    <p className="mt-2 text-sm text-gray-500">{formData.motivation.length}/500 characters</p>
                  </div>
                  <div>
                    <label htmlFor="goals" className="block text-sm font-semibold text-navy-900 mb-2">
                      What are your career goals after completing this program? * <span className="text-gray-400">(min 100 characters)</span>
                    </label>
                    <textarea
                      id="goals"
                      name="goals"
                      rows={6}
                      placeholder="After completing this program, I want to..."
                      value={formData.goals}
                      onChange={(e) => setFormData(prev => ({ ...prev, goals: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 transition-colors resize-y placeholder-gray-400"
                    />
                    {errors.goals && <p className="mt-1 text-red-500 text-sm">{errors.goals}</p>}
                    <p className="mt-2 text-sm text-gray-500">{formData.goals.length}/500 characters</p>
                  </div>
                  <div>
                    <label htmlFor="heardFrom" className="block text-sm font-semibold text-navy-900 mb-2">How did you hear about VaceUp?</label>
                    <select
                      id="heardFrom"
                      name="heardFrom"
                      value={formData.heardFrom}
                      onChange={(e) => setFormData(prev => ({ ...prev, heardFrom: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 transition-colors bg-white"
                    >
                      <option value="">Select an option</option>
                      <option value="social_media">Social Media (Instagram, Twitter, LinkedIn)</option>
                      <option value="friend">Friend or Colleague Referral</option>
                      <option value="search">Google/Search Engine</option>
                      <option value="event">VaceUp Event or Workshop</option>
                      <option value="advertisement">Online Advertisement</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Review & Submit - Step 4 */}
          {currentStep === 4 && (
            <Card className="bg-white border-gray-100">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-black text-navy-950 mb-2">Review Your Application</h2>
                  <p className="text-gray-600">Please verify all information before submitting</p>
                </div>
                
                {selectedCourseData && (
                  <div className="bg-gold-brand/10 border border-gold-brand/20 rounded-2xl p-6 mb-8">
                    <h3 className="font-bold text-navy-950 mb-4 flex items-center gap-2">
                      <LordIconComponent src={LordIcons.book} size={20} colors="primary:#00088A" />
                      Selected Course
                    </h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Course</p>
                        <p className="font-bold text-navy-950">{selectedCourseData.title}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Duration</p>
                        <p className="font-bold text-navy-950">{selectedCourseData.duration}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Tuition</p>
                        <p className="font-bold text-gold-brand">{formatCurrency(selectedCourseData.price)}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-gray-50 rounded-2xl p-6">
                    <h4 className="font-bold text-navy-950 mb-4 flex items-center gap-2">
                      <LordIconComponent src={LordIcons.user} size={20} colors="primary:#00088A" />
                      Personal Information
                    </h4>
                    <dl className="space-y-3 text-sm">
                      <div className="flex justify-between"><dt className="text-gray-500">Full Name</dt><dd className="font-medium text-navy-950">{formData.fullName}</dd></div>
                      <div className="flex justify-between"><dt className="text-gray-500">Email</dt><dd className="font-medium text-navy-950">{formData.email}</dd></div>
                      <div className="flex justify-between"><dt className="text-gray-500">Phone</dt><dd className="font-medium text-navy-950">{formData.phone}</dd></div>
                      <div className="flex justify-between"><dt className="text-gray-500">Location</dt><dd className="font-medium text-navy-950">{formData.city}, {formData.country}</dd></div>
                      <div className="flex justify-between"><dt className="text-gray-500">Education</dt><dd className="font-medium text-navy-950">{formData.education || 'Not provided'}</dd></div>
                      <div className="flex justify-between"><dt className="text-gray-500">Current Role</dt><dd className="font-medium text-navy-950">{formData.currentRole || 'Not provided'}</dd></div>
                    </dl>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-6">
                    <h4 className="font-bold text-navy-950 mb-4 flex items-center gap-2">
                      <LordIconComponent src={LordIcons.target} size={20} colors="primary:#00088A" />
                      Motivation & Goals
                    </h4>
                    <div className="space-y-4 text-sm">
                      <div>
                        <dt className="font-medium text-navy-950 mb-1">Motivation</dt>
                        <dd className="text-gray-600">{formData.motivation}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-navy-950 mb-1">Career Goals</dt>
                        <dd className="text-gray-600">{formData.goals}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-navy-950 mb-1">Heard From</dt>
                        <dd className="text-gray-600">{formData.heardFrom || 'Not specified'}</dd>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-6">
                  <p className="text-sm text-red-700">
                    <LordIconComponent src={LordIcons.alert} size={16} colors="primary:#ef4444" className="inline mr-1" />
                    <strong>By submitting, you agree to:</strong> Our Terms of Service, Privacy Policy, and consent to receive communications from VaceUp regarding your application status and course updates.
                  </p>
                </div>

                <form onSubmit={handleSubmit}>
                  {submitStatus === 'error' && serverError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
                      {serverError}
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={() => setCurrentStep(3)}
                      className="flex-1"
                    >
                      <LordIconComponent src={LordIcons.chevronLeft} size={20} className="mr-2" />
                      Back
                    </Button>
                    <Button
                      type="submit"
                      size="lg"
                      className="flex-1 bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Submitting...
                        </>
                      ) : (
                        <>
                          Submit Application
                          <LordIconComponent src={LordIcons.arrowRight} size={20} className="ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Navigation Buttons for Steps 1-3 */}
          {currentStep < 4 && currentStep > 1 && (
            <div className="flex justify-between mt-8">
              <Button
                variant="outline"
                size="lg"
                onClick={handleBack}
                className="w-full sm:w-auto"
              >
                <LordIconComponent src={LordIcons.chevronLeft} size={20} className="mr-2" />
                Back
              </Button>
              <Button
                size="lg"
                onClick={handleNext}
                className="w-full sm:w-auto bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold"
              >
                Next
                <LordIconComponent src={LordIcons.chevronRight} size={20} className="ml-2" />
              </Button>
            </div>
          )}
        </div>
      </main>

    </div>
  );
}