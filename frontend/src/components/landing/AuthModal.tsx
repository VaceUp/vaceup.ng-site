'use client';

import React, { useState } from 'react';

interface AuthModalProps {
  isOpen: boolean;
  mode: 'signin' | 'signup';
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({ isOpen, mode, onClose, onSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(mode === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate successful authentication/signup flow
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl relative border border-gray-100 text-[#0A1128]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 text-lg font-bold"
        >
          ✕
        </button>

        <div className="text-center space-y-2 mb-6">
          <h3 className="text-2xl font-black">
            {isSignUp ? 'Create Your Account' : 'Welcome Back'}
          </h3>
          <p className="text-xs text-gray-500">
            {isSignUp
              ? 'Join VaceUp Digital Academy and start your tech career.'
              : 'Sign in to access your dashboard and active courses.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {isSignUp && (
            <div>
              <label className="block font-bold text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                placeholder="Abubakar Aminu"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#F4F4F9] border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00088A]"
              />
            </div>
          )}

          <div>
            <label className="block font-bold text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#F4F4F9] border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00088A]"
            />
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#F4F4F9] border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00088A]"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-[#00088A] text-white font-bold rounded-xl hover:bg-[#000666] transition-all shadow-md mt-2"
          >
            {isSignUp ? 'Proceed to Enrollment & Payment →' : 'Sign In to Dashboard →'}
          </button>
        </form>

        <div className="text-center mt-6 text-xs text-gray-500">
          {isSignUp ? (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className="text-[#008B8B] font-bold hover:underline"
              >
                Sign In
              </button>
            </p>
          ) : (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => setIsSignUp(true)}
                className="text-[#008B8B] font-bold hover:underline"
              >
                Sign Up
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}