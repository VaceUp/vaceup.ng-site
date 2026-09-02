'use client';

import React, { useState } from 'react';

export interface Course {
  title: string;
  price?: string | number;
  duration?: string;
}

interface UserProfile {
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
}

interface DashboardProps {
  user: UserProfile | null;
  selectedCourse?: Course | null;
  onJoinLiveClass?: () => void;
  onLogout: () => void;
}

export const StudentDashboard: React.FC<DashboardProps> = ({
  user,
  selectedCourse,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'my-courses' | 'materials' | 'assignments' | 'announcements' | 'payment' | 'account'
  >('dashboard');

  const [hasPaid, setHasPaid] = useState<boolean>(false);
  const [filterState, setFilterState] = useState<string>('All');
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);

  // Mock User Fallback
  const currentUser: UserProfile = user || {
    name: 'Amaka Obi',
    email: 'amaka.obi@example.com',
    phone: '+234 803 555 0192',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
  };

  const handleSimulatePayment = () => {
    setHasPaid(true);
  };

  return (
    <div className="min-h-screen bg-[#EFEFF6] text-[#0A1128] flex font-sans">
      {/* ---------------- SIDEBAR ---------------- */}
      <aside className="w-64 bg-[#00088A] text-white hidden md:flex flex-col justify-between p-6 flex-shrink-0">
        <div className="space-y-8">
          {/* Logo Badge */}
          <div className="bg-white px-3 py-2 rounded-xl inline-flex items-center gap-2 shadow-sm">
            <svg className="h-7 w-7 flex-shrink-0" viewBox="0 0 100 100" fill="none">
              <path d="M15 30 L40 80 L70 10 L50 10 L38 60 L28 30 Z" fill="#008B8B" />
              <path d="M30 30 L45 60 L80 10 L95 25 L55 90 L30 30 Z" fill="#F4C430" />
            </svg>
            <div className="flex flex-col">
              <span className="text-lg font-black text-[#00088A] leading-none">VACEUP</span>
              <span className="text-[9px] font-bold text-[#008B8B] tracking-wider uppercase">
                Digital Academy
              </span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-2">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: '🎛️' },
              { id: 'my-courses', label: 'My Courses', icon: '📚' },
              { id: 'materials', label: 'Learning Materials', icon: '📑' },
              { id: 'assignments', label: 'Assignments', icon: '📝' },
              {
                id: 'announcements',
                label: 'Announcement',
                icon: '📢',
                badge: '2',
              },
              { id: 'payment', label: 'Payment', icon: '💳' },
              { id: 'account', label: 'Account', icon: '👤' },
            ].map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    setFilterState('All');
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 text-xs font-semibold rounded-xl transition-all ${
                    isActive
                      ? 'bg-white/20 text-white shadow-inner font-bold border-l-4 border-[#F4C430]'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="bg-[#F4C430] text-[#00088A] text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Help Center Box */}
        <div className="relative bg-[#1A2199] border border-white/10 rounded-2xl p-4 text-center mt-6">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#2A31B0] flex items-center justify-center text-xs font-bold text-white shadow">
            ?
          </div>
          <h4 className="mt-2 text-xs font-bold text-white">Help Centre</h4>
          <p className="text-[10px] text-white/70 mt-1 leading-snug">
            Having troubles? Please contact us for more information.
          </p>
          <button className="mt-3 w-full py-2 bg-white text-[#00088A] text-[11px] font-bold rounded-lg shadow hover:bg-gray-100 transition-colors">
            Go To Help Centre
          </button>
        </div>
      </aside>

      {/* ---------------- MAIN CONTENT AREA ---------------- */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between gap-4">
          <div className="relative w-72">
            <input
              type="text"
              placeholder="Search.."
              className="w-full bg-[#F4F4F9] rounded-full px-4 py-2 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#00088A]"
            />
            <span className="absolute right-3 top-2.5 text-xs text-gray-400">🔍</span>
          </div>

          <div className="flex items-center gap-4 relative">
            <button className="relative p-2 rounded-full hover:bg-gray-100">
              <span className="text-base">🔔</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500"></span>
            </button>

            {/* Profile Dropdown Toggle */}
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
            >
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="w-8 h-8 rounded-full object-cover border border-gray-300"
              />
              <span className="text-xs font-bold text-gray-800">{currentUser.name.split(' ')[0]}</span>
              <span className="text-xs text-gray-400">▾</span>
            </div>

            {/* Profile Menu Overlay */}
            {showProfileMenu && (
              <div className="absolute right-0 top-12 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50 text-xs">
                <p className="font-bold text-gray-900">{currentUser.name}</p>
                <p className="text-gray-400 text-[11px] truncate mb-3">{currentUser.email}</p>
                <div className="border-t border-gray-100 pt-2 space-y-2">
                  <button
                    onClick={() => {
                      setActiveTab('account');
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left font-medium text-gray-700 hover:text-[#00088A]"
                  >
                    ⚙️ Edit profile
                  </button>
                  <button className="w-full text-left font-medium text-gray-700 hover:text-[#00088A]">
                    ❓ Support
                  </button>
                  <button
                    onClick={onLogout}
                    className="w-full text-left font-bold text-red-500 hover:text-red-600 pt-1"
                  >
                    ↳ Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Main Body */}
        <main className="flex-1 p-8 overflow-y-auto space-y-6">
          {/* Pending Payment Prompt Banner (If student came from signup with selected course & hasn't paid) */}
          {selectedCourse && !hasPaid && (
            <div className="bg-gradient-to-r from-[#00088A] to-[#1A2199] text-white p-6 rounded-2xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <span className="bg-[#F4C430] text-[#00088A] text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Action Required
                </span>
                <h3 className="text-xl font-bold mt-2">
                  Complete Enrollment for {selectedCourse.title}
                </h3>
                <p className="text-xs text-gray-200 mt-1">
                  Tuition Fee: <span className="font-bold text-[#F4C430]">{selectedCourse.price || '₦150,000'}</span>.
                  Complete your payment to access live classes and course resources.
                </p>
              </div>
              <button
                onClick={handleSimulatePayment}
                className="px-6 py-3 bg-[#F4C430] text-[#00088A] font-bold text-xs rounded-xl hover:bg-yellow-400 transition-all shadow-md active:scale-95 whitespace-nowrap"
              >
                Proceed to Payment →
              </button>
            </div>
          )}

          {/* 1. DASHBOARD VIEW */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <p className="text-xs font-semibold text-[#008B8B]">September 2026 Cohort</p>

              {/* Welcome Card Banner */}
              <div className="bg-[#00088A] rounded-2xl p-6 text-white flex flex-col md:flex-row justify-between items-center gap-6 shadow-md">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Welcome back, {currentUser.name.split(' ')[0]}</h2>
                  <p className="text-xs text-gray-300 max-w-md leading-relaxed">
                    You're making solid progress. Keep the momentum going into this week's classes.
                  </p>
                </div>

                {/* Circular Progress Widget */}
                <div className="bg-[#1A2199] p-4 rounded-xl flex items-center gap-4 min-w-[220px]">
                  <div className="w-16 h-16 rounded-full border-4 border-[#F4C430] border-t-transparent flex items-center justify-center text-sm font-bold">
                    {hasPaid ? '50%' : '0%'}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#F4C430]">
                      {hasPaid ? '50% Overall' : 'Pending Payment'}
                    </span>
                    <p className="text-[11px] text-gray-300 mt-0.5">Across active courses</p>
                  </div>
                </div>
              </div>

              {/* Stat Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-5 rounded-2xl border border-teal-500/30 flex items-center gap-4 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 text-lg">
                    📖
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold text-gray-900">{hasPaid ? '3' : '1'}</h4>
                    <p className="text-xs text-gray-400 font-medium">Active Courses</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-yellow-500/30 flex items-center gap-4 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center text-yellow-600 text-lg">
                    📊
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold text-gray-900">{hasPaid ? '50%' : '0%'}</h4>
                    <p className="text-xs text-gray-400 font-medium">Learning Progress</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-teal-500/30 flex items-center gap-4 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 text-lg">
                    📢
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold text-gray-900">3</h4>
                    <p className="text-xs text-gray-400 font-medium">Announcements</p>
                  </div>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex gap-2 text-xs">
                {['All', 'Getting Started', 'In Progress', 'Making Progress', 'Completed'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setFilterState(tab)}
                    className={`px-4 py-2 rounded-full font-medium transition-all ${
                      filterState === tab
                        ? 'bg-[#00088A] text-white shadow-sm'
                        : 'bg-white text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Course Table Section */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-base font-bold text-gray-900">My Course</h3>
                  <button
                    onClick={() => setActiveTab('my-courses')}
                    className="text-xs font-bold text-[#008B8B] hover:underline"
                  >
                    View all
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-100 pb-3 uppercase text-[10px] font-bold">
                        <th className="pb-3">Courses</th>
                        <th className="pb-3">Duration</th>
                        <th className="pb-3">Progress</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      <tr className="hover:bg-gray-50/50">
                        <td className="py-4 flex items-center gap-3 font-bold text-gray-800">
                          <div className="w-8 h-8 rounded-full bg-[#00088A] flex items-center justify-center text-white text-xs">
                            🎨
                          </div>
                          {selectedCourse ? selectedCourse.title : 'UI/UX Design'}
                        </td>
                        <td className="py-4 text-gray-500">12 Weeks</td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${hasPaid ? 'bg-yellow-400 w-[25%]' : 'bg-gray-300 w-[0%]'}`}
                              ></div>
                            </div>
                            <span className="text-gray-500 font-bold">{hasPaid ? '25%' : '0%'}</span>
                          </div>
                        </td>
                        <td className="py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                              hasPaid ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'
                            }`}
                          >
                            {hasPaid ? 'Getting started' : 'Pending Payment'}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <button
                            onClick={() => (hasPaid ? setActiveTab('my-courses') : handleSimulatePayment())}
                            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-[#00088A] hover:text-white inline-flex items-center justify-center transition-colors text-gray-600"
                          >
                            ›
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 2. MY COURSES VIEW */}
          {activeTab === 'my-courses' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-base font-bold text-gray-900 mb-6">My Course</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-100 pb-3 uppercase text-[10px] font-bold">
                        <th className="pb-3">Courses</th>
                        <th className="pb-3">Duration</th>
                        <th className="pb-3">Progress</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {[
                        { title: selectedCourse?.title || 'UI/UX Design', duration: '12 Weeks', progress: 25, status: 'Getting started', color: 'bg-yellow-100 text-yellow-700', bar: 'bg-yellow-400' },
                        { title: 'Frontend Web Development', duration: '12 Weeks', progress: 50, status: 'In Progress', color: 'bg-blue-100 text-blue-700', bar: 'bg-blue-500' },
                        { title: 'Data Analysis & Python', duration: '12 Weeks', progress: 70, status: 'Making Progress', color: 'bg-purple-100 text-purple-700', bar: 'bg-purple-500' },
                        { title: 'Digital Marketing Masterclass', duration: '12 Weeks', progress: 100, status: 'Completed', color: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
                      ].map((c, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="py-4 flex items-center gap-3 font-bold text-gray-800">
                            <div className="w-8 h-8 rounded-full bg-[#00088A] flex items-center justify-center text-white text-xs">
                              💻
                            </div>
                            {c.title}
                          </td>
                          <td className="py-4 text-gray-500">{c.duration}</td>
                          <td className="py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                <div className={`h-full ${c.bar}`} style={{ width: `${c.progress}%` }}></div>
                              </div>
                              <span className="text-gray-500 font-bold">{c.progress}%</span>
                            </div>
                          </td>
                          <td className="py-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${c.color}`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="py-4 text-right">
                            <button className="w-7 h-7 rounded-full bg-gray-100 hover:bg-[#00088A] hover:text-white inline-flex items-center justify-center transition-colors text-gray-600">
                              ›
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 3. LEARNING MATERIALS VIEW */}
          {activeTab === 'materials' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6">
              <h3 className="text-base font-bold text-gray-900">All Materials</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100 pb-3 uppercase text-[10px] font-bold">
                      <th className="pb-3">Materials</th>
                      <th className="pb-3">Courses</th>
                      <th className="pb-3">Type</th>
                      <th className="pb-3">Size</th>
                      <th className="pb-3">Uploaded</th>
                      <th className="pb-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {[1, 2, 3, 4, 5].map((item) => (
                      <tr key={item} className="hover:bg-gray-50/50">
                        <td className="py-4 flex items-center gap-3 font-bold text-gray-800">
                          <span className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center text-xs">
                            📄
                          </span>
                          Wireframing Cheat Sheet.pdf
                        </td>
                        <td className="py-4 text-gray-500">{selectedCourse?.title || 'UI/UX Design'}</td>
                        <td className="py-4 text-gray-500">PDF</td>
                        <td className="py-4 text-gray-500">1.2MB</td>
                        <td className="py-4 text-gray-500">July 30, 2026</td>
                        <td className="py-4 text-right">
                          <button className="w-7 h-7 rounded-full bg-teal-50 text-teal-600 hover:bg-[#008B8B] hover:text-white inline-flex items-center justify-center transition-colors">
                            ⤓
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. ASSIGNMENTS VIEW */}
          {activeTab === 'assignments' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6">
              <h3 className="text-base font-bold text-gray-900">All Assignments</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100 pb-3 uppercase text-[10px] font-bold">
                      <th className="pb-3">Assignments</th>
                      <th className="pb-3">Course</th>
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {[
                      { name: 'Redesign a Mobile Onboarding Flow', status: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
                      { name: 'User Persona & Wireframes', status: 'Submitted', color: 'bg-blue-100 text-blue-700' },
                      { name: 'Color Palette & Typography System', status: 'Graded', color: 'bg-emerald-100 text-emerald-700' },
                    ].map((a, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="py-4 flex items-center gap-3 font-bold text-gray-800">
                          <span className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center text-xs">
                            📋
                          </span>
                          {a.name}
                        </td>
                        <td className="py-4 text-gray-500">{selectedCourse?.title || 'UI/UX Design'}</td>
                        <td className="py-4 text-gray-500">AUG 10, 2026</td>
                        <td className="py-4">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${a.color}`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <button className="w-7 h-7 rounded-full bg-gray-100 hover:bg-[#00088A] hover:text-white inline-flex items-center justify-center transition-colors text-gray-600">
                            ›
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. ANNOUNCEMENT VIEW */}
          {activeTab === 'announcements' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6">
              <h3 className="text-base font-bold text-gray-900">Announcement</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100 pb-3 uppercase text-[10px] font-bold">
                      <th className="pb-3">All Announcements</th>
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {[
                      { title: 'New Cohort Welcome Section', desc: 'Join the Welcome Session this Friday to meet your Tutors and fellow Students.', date: 'AUG 30, 2026', status: 'Read', color: 'bg-emerald-100 text-emerald-700' },
                      { title: 'Live Project Briefing', desc: 'Project briefs are now live in your course repository.', date: 'SEP 02, 2026', status: 'Unread', color: 'bg-yellow-100 text-yellow-700' },
                    ].map((ann, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="py-4 font-bold text-gray-800">
                          <p>{ann.title}</p>
                          <p className="text-[11px] font-normal text-gray-400 mt-0.5">{ann.desc}</p>
                        </td>
                        <td className="py-4 text-gray-500">{ann.date}</td>
                        <td className="py-4">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${ann.color}`}>
                            {ann.status}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <button className="w-7 h-7 rounded-full bg-indigo-50 text-[#00088A] inline-flex items-center justify-center font-bold">
                            📢
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. PAYMENT VIEW */}
          {activeTab === 'payment' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6">
              <h3 className="text-base font-bold text-gray-900">All Payments</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100 pb-3 uppercase text-[10px] font-bold">
                      <th className="pb-3">Payment</th>
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Amount</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    <tr className="hover:bg-gray-50/50">
                      <td className="py-4 flex items-center gap-3 font-bold text-gray-800">
                        <div className="w-8 h-8 rounded-full bg-[#00088A] flex items-center justify-center text-white text-xs">
                          💳
                        </div>
                        {selectedCourse ? selectedCourse.title : 'UI/UX Design'}
                      </td>
                      <td className="py-4 text-gray-500">AUG 28, 2026</td>
                      <td className="py-4 font-bold text-gray-800">
                        {selectedCourse?.price ? selectedCourse.price : '₦150,000'}
                      </td>
                      <td className="py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                            hasPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {hasPaid ? 'Paid' : 'Pending'}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        {!hasPaid ? (
                          <button
                            onClick={handleSimulatePayment}
                            className="px-3 py-1.5 bg-[#00088A] text-white font-bold rounded-lg text-[11px]"
                          >
                            Pay Now
                          </button>
                        ) : (
                          <button className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 inline-flex items-center justify-center">
                            ›
                          </button>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 7. ACCOUNT / PROFILE VIEW */}
          {activeTab === 'account' && (
            <div className="space-y-6 max-w-2xl">
              <h3 className="text-[#008B8B] font-bold text-sm">Account</h3>
              <h2 className="text-xl font-black text-gray-900">Profile</h2>

              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 space-y-6">
                <div className="flex items-center gap-6">
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    className="w-20 h-20 rounded-full object-cover border-2 border-[#00088A]"
                  />
                  <div>
                    <h3 className="text-lg font-extrabold text-gray-900">{currentUser.name}</h3>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                      <span>✉️</span> {currentUser.email}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                      <span>📞</span> {currentUser.phone}
                    </p>
                  </div>
                </div>

                <button className="w-full py-3 bg-[#00088A] text-white font-bold text-xs rounded-xl hover:bg-[#000666] transition-colors shadow-sm">
                  Edit Profile
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default StudentDashboard;