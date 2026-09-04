'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { api, User } from '@/lib/api';
import {
  User,
  Lock,
  Bell,
  Shield,
  CreditCard,
  Globe,
  Palette,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Camera,
  X,
  CheckCircle,
  Clock,
  CreditCard as CreditCardIcon,
} from 'lucide-react';

interface SettingsTabs {
  profile: 'Profile';
  security: 'Security';
  notifications: 'Notifications';
  billing: 'Billing';
  appearance: 'Appearance';
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<keyof SettingsTabs>('profile');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    bio: '',
    date_of_birth: '',
  });

  const [passwords, setPasswords] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState({
    email_notifications: true,
    push_notifications: true,
    course_updates: true,
    live_class_reminders: true,
    assignment_reminders: true,
    marketing_emails: false,
    weekly_digest: true,
  });

  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await api.getMe();
        setUser(userData);
        setProfile({
          full_name: userData.full_name || '',
          email: userData.email || '',
          phone_number: userData.phone_number || '',
          bio: '',
          date_of_birth: '',
        });
      } catch (err) {
        console.error('Failed to fetch user:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await api.updateProfile(profile);
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwords.new_password !== passwords.confirm_password) {
      alert('Passwords do not match');
      return;
    }
    if (passwords.new_password.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(passwords);
      setSuccess('Password changed successfully!');
      setPasswords({ current_password: '', new_password: '', confirm_password: '' });
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSuccess('Notification preferences saved!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleSaveAppearance = () => {
    localStorage.setItem('theme', theme);
    setSuccess('Appearance settings saved!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    alert('Avatar upload would be implemented here');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-navy-900 border-t-transparent"></div>
      </div>
    );
  }

  const tabs: { key: keyof SettingsTabs; label: string; icon: React.ReactNode }[] = [
    { key: 'profile', label: 'Profile', icon: <User className="w-5 h-5" /> },
    { key: 'security', label: 'Security', icon: <Lock className="w-5 h-5" /> },
    { key: 'notifications', label: 'Notifications', icon: <Bell className="w-5 h-5" /> },
    { key: 'billing', label: 'Billing', icon: <CreditCard className="w-5 h-5" /> },
    { key: 'appearance', label: 'Appearance', icon: <Palette className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your account settings and preferences</p>
        </div>

        {success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800/50 rounded-xl text-green-700 dark:text-green-400 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span>{success}</span>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-64 flex-shrink-0">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 sticky top-24">
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      activeTab === tab.key
                        ? 'bg-navy-50 dark:bg-navy-900/30 text-navy-900 dark:text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          <div className="flex-1">
            {activeTab === 'profile' && <ProfileTab user={user} profile={profile} setProfile={setProfile} onSave={handleSaveProfile} saving={saving} userAvatar={user?.avatar} onAvatarUpload={handleAvatarUpload} />}
            {activeTab === 'security' && <SecurityTab passwords={passwords} setPasswords={setPasswords} showCurrent={showCurrent} setShowCurrent={setShowCurrent} showNew={showNew} setShowNew={setShowNew} showConfirm={showConfirm} setShowConfirm={setShowConfirm} onSave={handleChangePassword} saving={saving} />}
            {activeTab === 'notifications' && <NotificationsTab prefs={notifPrefs} setPrefs={setNotifPrefs} onSave={handleSaveNotifications} saving={saving} />}
            {activeTab === 'billing' && <BillingTab />}
            {activeTab === 'appearance' && <AppearanceTab theme={theme} setTheme={setTheme} onSave={handleSaveAppearance} />}
          </div>
        </div>
      </div>
    );
  }
}

function ProfileTab({ user, profile, setProfile, onSave, saving, userAvatar, onAvatarUpload }: any) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h2>

      <div className="flex items-center gap-6">
        <div className="relative">
          <Avatar
            src={userAvatar}
            alt="Profile"
            size="xl"
            className="ring-4 ring-white dark:ring-slate-900"
          />
          <label className="absolute bottom-0 right-0 cursor-pointer">
            <input type="file" accept="image/*" className="sr-only" onChange={(e: any) => e.target.files?.[0] && alert('Avatar upload would be implemented here')} />
            <div className="w-10 h-10 rounded-full bg-navy-900 text-white flex items-center justify-center text-sm font-bold hover:bg-navy-950 transition-colors">
              <Camera className="w-5 h-5" />
            </div>
          </label>
        </div>
        <div className="flex-1 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Profile Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
              <Input
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                placeholder="Your full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <Input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                placeholder="your@email.com"
                disabled
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Email cannot be changed</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
              <Input
                type="tel"
                value={profile.phone_number}
                onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
                placeholder="+234 800 000 0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date of Birth</label>
              <Input
                type="date"
                value={profile.date_of_birth}
                onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bio</label>
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-navy-900 focus:border-transparent"
              placeholder="Tell us about yourself..."
            />
          </div>
          <Button onClick={onSave} disabled={saving} className="w-full sm:w-auto">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

function SecurityTab({ passwords, setPasswords, showCurrent, setShowCurrent, showNew, setShowNew, showConfirm, setShowConfirm, onSave, saving }: any) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 space-y-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Security</h2>

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Change Password</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
              <div className="relative">
                <Input
                  type={showCurrent ? 'text' : 'password'}
                  value={passwords.current_password}
                  onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })}
                  placeholder="Current password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  onClick={() => setShowCurrent(!showCurrent)}
                >
                  {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
              <div className="relative">
                <Input
                  type={showNew ? 'text' : 'password'}
                  value={passwords.new_password}
                  onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
                  placeholder="New password (min 8 characters)"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  onClick={() => setShowNew(!showNew)}
                >
                  {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
              <div className="relative">
                <Input
                  type={showConfirm ? 'text' : 'password'}
                  value={passwords.confirm_password}
                  onChange={(e) => setPasswords({ ...passwords, confirm_password: e.target.value })}
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  onClick={() => setShowConfirm(!showConfirm)}
                >
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
          <Button onClick={handleChangePassword} disabled={saving} className="w-full sm:w-auto">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Update Password
          </Button>
        </div>

        <div className="pt-6 border-t border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Two-Factor Authentication</h3>
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Two-Factor Authentication</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Add an extra layer of security to your account</p>
            </div>
            <Button variant="outline">Enable 2FA</Button>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Active Sessions</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold">Chrome</div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Chrome on Windows</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Current session • Active now</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">Revoke</Button>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 font-bold">iOS</div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Safari on iPhone</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Last active 2 hours ago</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">Revoke</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationsTab({ prefs, setPrefs, onSave, saving }: any) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 space-y-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h2>

      <div className="space-y-4">
        {[
          { key: 'email_notifications', label: 'Email Notifications', desc: 'Receive email updates about your account and courses' },
          { key: 'push_notifications', label: 'Push Notifications', desc: 'Receive browser push notifications' },
          { key: 'course_updates', label: 'Course Updates', desc: 'New lessons, assignments, and course announcements' },
          { key: 'live_class_reminders', label: 'Live Class Reminders', desc: 'Get reminded before live classes start' },
          { key: 'assignment_reminders', label: 'Assignment Reminders', desc: 'Get reminded about upcoming assignments and deadlines' },
          { key: 'marketing_emails', label: 'Marketing Emails', desc: 'Receive promotional emails about new courses and offers' },
          { key: 'weekly_digest', label: 'Weekly Digest', desc: 'Receive a weekly summary of your learning progress' },
        ].map((item) => (
          <div key={item.key} className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-slate-700 last:border-0">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{item.label}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={true}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus-4:ring-offset-2 peer-focus-4:ring-offset-white peer-focus-4:ring-primary-500 rounded-full peer dark:bg-slate-700 peer-checked:bg-primary-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-600"></div>
            </label>
          </div>
        ))}
      </div>
      <Button onClick={onSave} disabled={saving} className="w-full sm:w-auto">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        Save Preferences
      </Button>
    </div>
  );
}

function BillingTab() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 space-y-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Billing & Payments</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Current Plan</h3>
          <div className="bg-primary-50 dark:bg-primary-900/30 rounded-xl p-4 mb-4">
            <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">Pro Plan</p>
            <p className="text-sm text-primary-700 dark:text-primary-300">Active until Dec 31, 2024</p>
          </div>
          <Button variant="outline" className="w-full">Manage Subscription</Button>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Payment Methods</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400"><CreditCard className="w-5 h-5" /></div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Visa ending in 4242</p>
                  <p className="text-sm text-gray-500">Expires 12/25</p>
                </div>
              </div>
              <Badge variant="secondary">Default</Badge>
            </div>
          </div>
          <Button variant="outline" className="w-full mt-4">Add Payment Method</Button>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Billing History</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Pro Plan - Annual</p>
                <p className="text-sm text-gray-500">Jan 15, 2024</p>
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">₦150,000</span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-gray-200 dark:border-slate-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Invoices</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400"><CheckCircle className="w-5 h-5" /></div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Invoice #INV-2024-001</p>
                <p className="text-sm text-gray-500">Jan 15, 2024</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-gray-900 dark:text-white">₦150,000</span>
              <Badge variant="success">Paid</Badge>
              <Button variant="ghost" size="sm">Download</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppearanceTab({ theme, setTheme, onSave, saving }: any) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 space-y-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Appearance</h2>
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Theme</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { key: 'light', label: 'Light', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M17.657 17.657l.707.707M4 12a8 8 0 1116 0 8 8 0 01-16 0z" /></svg> },
            { key: 'dark', label: 'Dark', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg> },
            { key: 'system', label: 'System', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.707.707L13.75 17z" /></svg> },
          ].map((option) => (
            <button
              key={option.key}
              onClick={() => setTheme(option.key as any)}
              className={`relative p-6 rounded-2xl border-2 transition-all ${
                theme === option.key
                  ? 'border-primary-500 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/30'
                  : 'border-gray-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700'
              }`}
            >
              <input type="radio" name="theme" value={option.key} checked={theme === option.key} className="sr-only" />
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-2xl">{option.icon}</div>
                <span className="font-medium text-gray-900 dark:text-white">{option.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="pt-6 border-t border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Language</h3>
        <div className="flex items-center gap-4">
          <select className="flex-1 px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-navy-900 focus:border-transparent">
            <option value="en">English</option>
            <option value="yo">Yoruba</option>
            <option value="ha">Hausa</option>
            <option value="ig">Igbo</option>
          </select>
        </div>
      </div>

      <div className="pt-6 border-t border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Density</h3>
        <div className="grid grid-cols-3 gap-4">
          {['comfortable', 'compact', 'spacious'].map((density) => (
            <button
              key={density}
              className={`p-6 rounded-2xl border-2 transition-all ${
                false
                  ? 'border-primary-500 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/30'
                  : 'border-gray-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                <div className={`w-full h-2 bg-gray-200 dark:bg-slate-700 rounded ${density === 'compact' ? 'h-1' : density === 'spacious' ? 'h-3' : ''}`} />
                <div className={`w-full h-2 bg-gray-200 dark:bg-slate-700 rounded mt-2 ${density === 'compact' ? 'h-1' : density === 'spacious' ? 'h-3' : ''}`} />
                <div className={`w-full h-2 bg-gray-200 dark:bg-slate-700 rounded mt-2 ${density === 'compact' ? 'h-1' : density === 'spacious' ? 'h-3' : ''}`} />
              </div>
              <span className="block text-center font-medium text-gray-900 dark:text-white capitalize">{density}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BillingTab() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 space-y-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Billing & Payments</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Current Plan</h3>
          <div className="bg-primary-50 dark:bg-primary-900/30 rounded-xl p-4 mb-4">
            <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">Pro Plan</p>
            <p className="text-sm text-primary-700 dark:text-primary-300">Active until Dec 31, 2024</p>
          </div>
          <Button variant="outline" className="w-full">Manage Subscription</Button>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Payment Methods</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400"><CreditCard className="w-5 h-5" /></div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Visa ending in 4242</p>
                  <p className="text-sm text-gray-500">Expires 12/25</p>
                </div>
              </div>
              <Badge variant="secondary">Default</Badge>
            </div>
          </div>
          <Button variant="outline" className="w-full mt-4">Add Payment Method</Button>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Billing History</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Pro Plan - Annual</p>
                <p className="text-sm text-gray-500">Jan 15, 2024</p>
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">₦150,000</span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-gray-200 dark:border-slate-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Invoices</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400"><CheckCircle className="w-5 h-5" /></div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Invoice #INV-2024-001</p>
                <p className="text-sm text-gray-500">Jan 15, 2024</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-gray-900 dark:text-white">₦150,000</span>
              <Badge variant="success">Paid</Badge>
              <Button variant="ghost" size="sm">Download</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppearanceTab({ theme, setTheme, onSave, saving }: any) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 space-y-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Appearance</h2>
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Theme</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { key: 'light', label: 'Light', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M17.657 17.657l.707.707M4 12a8 8 0 1116 0 8 8 0 01-16 0z" /></svg> },
            { key: 'dark', label: 'Dark', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg> },
            { key: 'system', label: 'System', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.707.707L13.75 17z" /></svg> },
          ].map((option) => (
            <button
              key={option.key}
              onClick={() => setTheme(option.key as any)}
              className={`relative p-6 rounded-2xl border-2 transition-all ${
                theme === option.key
                  ? 'border-primary-500 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/30'
                  : 'border-gray-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700'
              }`}
            >
              <input type="radio" name="theme" value={option.key} checked={theme === option.key} className="sr-only" />
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-2xl">{option.icon}</div>
                <span className="font-medium text-gray-900 dark:text-white">{option.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="pt-6 border-t border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Language</h3>
        <div className="flex items-center gap-4">
          <select className="flex-1 px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-navy-900 focus:border-transparent">
            <option value="en">English</option>
            <option value="yo">Yoruba</option>
            <option value="ha">Hausa</option>
            <option value="ig">Igbo</option>
          </select>
        </div>
      </div>

      <div className="pt-6 border-t border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Density</h3>
        <div className="grid grid-cols-3 gap-4">
          {['comfortable', 'compact', 'spacious'].map((density) => (
            <button
              key={density}
              className={`p-6 rounded-2xl border-2 transition-all ${
                false
                  ? 'border-primary-500 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/30'
                  : 'border-gray-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                <div className={`w-full h-2 bg-gray-200 dark:bg-slate-700 rounded ${density === 'compact' ? 'h-1' : density === 'spacious' ? 'h-3' : ''}`} />
                <div className={`w-full h-2 bg-gray-200 dark:bg-slate-700 rounded mt-2 ${density === 'compact' ? 'h-1' : density === 'spacious' ? 'h-3' : ''}`} />
                <div className={`w-full h-2 bg-gray-200 dark:bg-slate-700 rounded mt-2 ${density === 'compact' ? 'h-1' : density === 'spacious' ? 'h-3' : ''}`} />
              </div>
              <span className="block text-center font-medium text-gray-900 dark:text-white capitalize">{density}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<keyof SettingsTabs>('profile');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    bio: '',
    date_of_birth: '',
  });

  const [passwords, setPasswords] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState({
    email_notifications: true,
    push_notifications: true,
    course_updates: true,
    live_class_reminders: true,
    assignment_reminders: true,
    marketing_emails: false,
    weekly_digest: true,
  });

  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await api.getMe();
        setUser(userData);
        setProfile({
          full_name: userData.full_name || '',
          email: userData.email || '',
          phone_number: userData.phone_number || '',
          bio: '',
          date_of_birth: '',
        });
      } catch (err) {
        console.error('Failed to fetch user:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await api.updateProfile(profile);
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwords.new_password !== passwords.confirm_password) {
      alert('Passwords do not match');
      return;
    }
    if (passwords.new_password.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(passwords);
      setSuccess('Password changed successfully!');
      setPasswords({ current_password: '', new_password: '', confirm_password: '' });
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSuccess('Notification preferences saved!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleSaveAppearance = () => {
    localStorage.setItem('theme', theme);
    setSuccess('Appearance settings saved!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    alert('Avatar upload would be implemented here');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-navy-900 border-t-transparent"></div>
      </div>
    );
  }

  const tabs: { key: keyof SettingsTabs; label: string; icon: React.ReactNode }[] = [
    { key: 'profile', label: 'Profile', icon: <User className="w-5 h-5" /> },
    { key: 'security', label: 'Security', icon: <Lock className="w-5 h-5" /> },
    { key: 'notifications', label: 'Notifications', icon: <Bell className="w-5 h-5" /> },
    { key: 'billing', label: 'Billing', icon: <CreditCard className="w-5 h-5" /> },
    { key: 'appearance', label: 'Appearance', icon: <Palette className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your account settings and preferences</p>
        </div>

        {success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800/50 rounded-xl text-green-700 dark:text-green-400 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span>{success}</span>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-64 flex-shrink-0">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 sticky top-24">
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      activeTab === tab.key
                        ? 'bg-navy-50 dark:bg-navy-900/30 text-navy-900 dark:text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          <div className="flex-1">
            {activeTab === 'profile' && <ProfileTab user={user} profile={profile} setProfile={setProfile} onSave={handleSaveProfile} saving={saving} userAvatar={user?.avatar} onAvatarUpload={handleAvatarUpload} />}
            {activeTab === 'security' && <SecurityTab passwords={passwords} setPasswords={setPasswords} showCurrent={showCurrent} setShowCurrent={setShowCurrent} showNew={showNew} setShowNew={setShowNew} showConfirm={showConfirm} setShowConfirm={setShowConfirm} onSave={handleChangePassword} saving={saving} />}
            {activeTab === 'notifications' && <NotificationsTab prefs={notifPrefs} setPrefs={setNotifPrefs} onSave={handleSaveNotifications} saving={saving} />}
            {activeTab === 'billing' && <BillingTab />}
            {activeTab === 'appearance' && <AppearanceTab theme={theme} setTheme={setTheme} onSave={handleSaveAppearance} />}
          </div>
        </div>
      </div>
    );
  }
}

export default SettingsPage;