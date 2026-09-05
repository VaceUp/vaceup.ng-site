'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'failed';
  audienceFilter: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  unsubscribedCount: number;
  openRate: number;
  clickRate: number;
  createdAt: string;
  scheduledAt?: string;
  sentAt?: string;
  template: string;
  createdBy: string;
}

function CampaignCard({ campaign }: { campaign: any }) {
  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      sending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      sent: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return (
      <Badge variant="outline" className={styles[campaign.status as keyof typeof styles] || ''}>
        {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
      </Badge>
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card variant="glass" className="flex flex-col h-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white">{campaign.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{campaign.subject}</p>
          </div>
          {getStatusBadge(campaign.status)}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <p className="text-gray-500 dark:text-gray-400">Open Rate</p>
            <p className="font-semibold text-gray-900 dark:text-white">{campaign.openRate}%</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">Click Rate</p>
            <p className="font-semibold text-gray-900 dark:text-white">{campaign.clickRate}%</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <p className="text-gray-500 dark:text-gray-400">Sent</p>
            <p className="font-semibold text-gray-900 dark:text-white">{campaign.sentCount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">Delivered</p>
            <p className="font-semibold text-gray-900 dark:text-white">{campaign.deliveredCount.toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>Created: {formatDate(campaign.createdAt)}</span>
          {campaign.sentAt && <span>• Sent: {formatDate(campaign.sentAt)}</span>}
        </div>
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
          <Button variant="ghost" size="sm" className="flex-1">
            <LordIconComponent src={LordIcons.eye} size={16} className="mr-1" />
            View
          </Button>
          <Button variant="ghost" size="sm" className="flex-1">
            <LordIconComponent src={LordIcons.edit} size={16} className="mr-1" />
            Edit
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 text-red-600 hover:text-red-700">
            <LordIconComponent src={LordIcons.delete} size={16} className="mr-1" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MarketingPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'failed'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, [page, filter, search]);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      setCampaigns([
        {
          id: '1',
          name: 'Black Friday Sale 2024',
          subject: '🔥 50% Off All Courses - Ends Tonight!',
          status: 'sent',
          audienceFilter: 'never_purchased',
          totalRecipients: 12500,
          sentCount: 12450,
          deliveredCount: 12300,
          openedCount: 3450,
          clickedCount: 890,
          bouncedCount: 150,
          unsubscribedCount: 25,
          openRate: 28.1,
          clickRate: 7.2,
          createdAt: '2024-11-20T10:00:00Z',
          sentAt: '2024-11-25T09:00:00Z',
          template: 'promotional_sale',
          createdBy: 'Marketing Team',
        },
        {
          id: '2',
          name: 'New Year Learning Goals',
          subject: 'New Year, New Skills 🎯',
          status: 'scheduled',
          audienceFilter: 'all_users',
          totalRecipients: 25000,
          sentCount: 0,
          deliveredCount: 0,
          openedCount: 0,
          clickedCount: 0,
          bouncedCount: 0,
          unsubscribedCount: 0,
          openRate: 0,
          clickRate: 0,
          createdAt: '2024-12-20T10:00:00Z',
          scheduledAt: '2025-01-01T09:00:00Z',
          template: 'new_year_goals',
          createdBy: 'Marketing Team',
        },
        {
          id: '3',
          name: 'Course Completion Reminder',
          subject: 'You\'re 80% done! Finish strong 💪',
          status: 'sending',
          audienceFilter: 'in_progress_courses',
          totalRecipients: 5200,
          sentCount: 3200,
          deliveredCount: 3150,
          openedCount: 1200,
          clickedCount: 450,
          bouncedCount: 50,
          unsubscribedCount: 10,
          openRate: 38.1,
          clickRate: 14.3,
          createdAt: '2024-11-15T14:00:00Z',
          sentAt: '2024-11-20T10:00:00Z',
          template: 'course_progress_reminder',
          createdBy: 'Automation',
        },
        {
          id: '4',
          name: 'Course Launch: AI Fundamentals',
          subject: '🚀 NEW: AI Fundamentals Course - 40% Off Launch Price!',
          status: 'draft',
          audienceFilter: 'interested_in_ai',
          totalRecipients: 8500,
          sentCount: 0,
          deliveredCount: 0,
          openedCount: 0,
          clickedCount: 0,
          bouncedCount: 0,
          unsubscribedCount: 0,
          openRate: 0,
          clickRate: 0,
          createdAt: '2024-12-10T15:30:00Z',
          template: 'course_launch',
          createdBy: 'Product Team',
        },
      ]);
      setLoading(false);
      setHasMore(false);
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
      setLoading(false);
    }
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    if (filter !== 'all' && campaign.status !== filter) return false;
    if (search && !campaign.name.toLowerCase().includes(search.toLowerCase()) &&
        !campaign.subject.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      sending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      sent: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return (
      <Badge variant="outline" className={styles[campaign.status as keyof typeof styles] || ''}>
        {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
      </Badge>
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Marketing Campaigns</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Create and manage email marketing campaigns</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="ml-auto">
            <LordIconComponent src={LordIcons.add} size={20} className="mr-2" />
            Create Campaign
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1">
            <Input
              placeholder="Search campaigns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<LordIconComponent src={LordIcons.search} size={20} />}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {['all', 'draft', 'scheduled', 'sending', 'sent', 'paused', 'failed'].map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f as any); setPage(1); }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-primary-500 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {filteredCampaigns.length === 0 ? (
          <div className="text-center py-12">
            <LordIconComponent src={LordIcons.mail} size={64} className="text-gray-300 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No campaigns found</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCampaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
            {hasMore && (
              <div className="text-center mt-8">
                <Button variant="outline" size="lg" onClick={() => setPage(p => p + 1)}>
                  Load More Campaigns
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}