'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Plus, Minus, CreditCard, Lock, Shield, Truck, RotateCcw } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';

interface CartItem {
  id: string;
  course: {
    id: string;
    title: string;
    thumbnail: string;
    instructor: string;
    price: number;
  };
  quantity: number;
}

function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [coupon, setCoupon] = useState('');
  const [discount, setDiscount] = useState(0);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/cart/');
      if (res.ok) {
        const data = await res.json();
        setCartItems(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(itemId);
      return;
    }
    try {
      const res = await fetch(`/api/v1/cart/items/${itemId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });
      if (res.ok) {
        const data = await res.json();
        setCartItems(prev => prev.map(item =>
          item.id === itemId ? { ...item, quantity: data.quantity } : item
        ));
      }
    } catch (error) {
      console.error('Failed to update quantity:', error);
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      const res = await fetch(`/api/v1/cart/items/${itemId}/`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setCartItems(prev => prev.filter(item => item.id !== itemId));
      }
    } catch (error) {
      console.error('Failed to remove item:', error);
    }
  };

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    setApplyingCoupon(true);
    setCouponError('');
    try {
      const res = await fetch('/api/v1/coupons/apply/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: coupon }),
      });
      if (res.ok) {
        const data = await res.json();
        setDiscount(data.discount);
        setCouponError('');
      } else {
        const data = await res.json();
        setCouponError(data.detail || 'Invalid coupon code');
      }
    } catch (error) {
      setCouponError('Failed to apply coupon');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const subtotal = cartItems.reduce((sum, item) => sum + item.course.price * item.quantity, 0);
  const total = subtotal - discount;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Shopping Cart</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Review your courses and proceed to checkout
          </p>
        </div>

        {cartItems.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v9m5-8a4 4 0 11-8 0 4 4 0 018 0v10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-3" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Your cart is empty</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Looks like you haven't added any courses yet.</p>
            <button onClick={() => window.location.href = '/courses'} className="px-8 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors">
              Browse Courses
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Cart ({cartItems.length} items)</h2>
                  {cartItems.length > 0 && (
                    <button
                      onClick={() => cartItems.forEach(item => removeItem(item.id))}
                      className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 hover:text-red-300"
                    >
                      Clear Cart
                    </button>
                  )}
                </div>
                <div className="divide-y divide-gray-200 dark:divide-slate-700">
                  {cartItems.map((item) => (
                    <div key={item.id} className="p-6 flex flex-col md:flex-row gap-6 items-start">
                      <img
                        src={item.course.thumbnail || '/placeholder-course.jpg'}
                        alt={item.course.title}
                        className="w-24 h-16 rounded-xl object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 dark:text-white truncate">{item.course.title}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{item.course.instructor}</p>
                          </div>
                          <Badge variant="outline" className="whitespace-nowrap">
                            {item.course.price === 0 ? 'Free' : formatCurrency(item.course.price)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-4">
                          <div className="flex items-center border border-gray-300 dark:border-slate-700 rounded-xl overflow-hidden">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              className="px-3 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-l-xl text-gray-600 dark:text-gray-300 disabled:opacity-50"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                            </button>
                            <span className="w-10 text-center font-medium">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="p-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-r-xl text-gray-600 dark:text-gray-300"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item.id)}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 hover:text-red-500"
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Order Summary</h2>
                  <div className="space-y-4">
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Subtotal ({cartItems.length} items)</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Discount</span>
                      <span className="text-green-600 dark:text-green-400">-{formatCurrency(discount)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Tax (Estimated)</span>
                      <span>{formatCurrency(subtotal * 0.05)}</span>
                    </div>
                    <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
                      <div className="flex justify-between text-xl font-bold text-gray-900 dark:text-white">
                        <span>Total</span>
                        <span>{formatCurrency(total + subtotal * 0.05)}</span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="flex gap-2 mb-4">
                        <Input
                          placeholder="Coupon code"
                          value={coupon}
                          onChange={(e) => setCoupon(e.target.value)}
                          className="flex-1"
                          placeholder="Coupon code"
                        />
                        <Button
                          variant={applyingCoupon ? 'secondary' : 'primary'}
                          onClick={applyCoupon}
                          disabled={applyingCoupon || !coupon.trim()}
                        >
                          {applyingCoupon ? 'Applying...' : 'Apply'}
                        </Button>
                      </div>
                      {couponError && <p className="text-sm text-red-600 dark:text-red-400">{couponError}</p>}
                    </div>
                    <Button
                      size="lg"
                      className="w-full"
                      onClick={() => router.push('/checkout')}
                      disabled={cartItems.length === 0}
                    >
                      Proceed to Checkout
                      <CreditCard className="w-5 h-5 ml-2" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <CartContent />
    </div>
  );
}

export default CartPage;