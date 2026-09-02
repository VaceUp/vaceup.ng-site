'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import {
  Mail,
  Users,
  Filter,
  Send,
  BarChart2,
  TrendingUp,
  MailCheck,
  Users as UsersIcon,
  DollarSign,
  ArrowRight,
  ChevronRight,
  Plus,
  Search,
  Filter as FilterIcon,
  Calendar,
  Clock,
  Download,
  Eye,
  Edit,
  Trash2,
  PlusCircle,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

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

function MarketingPage() {
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
      // Mock data
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Marketing Campaigns</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Create and manage email marketing campaigns</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="ml-auto">
            <PlusCircle className="w-5 h-5 mr-2" />
            Create Campaign
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1">
            <Input
              placeholder="Search campaigns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-5 h-5" />}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {['all', 'draft', 'scheduled', 'sending', 'sent', 'paused', 'failed'].map((filter) => (
              <button
                key={filter}
                onClick={() => { setFilter(filter); setPage(1); }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  filter === filter
                    ? 'bg-primary-500 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-200 dark:bg-slate-700 h-48 rounded-xl mb-4 animate-pulse" />
                <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4 mb-2 animate-pulse" />
                <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/2 animate-pulse" />
              </div>
            )}
          ) : (
            <>
              {filteredCampaigns.length === 0 ? (
                <div className="text-center py-12">
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
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <MarketingContent />
    </div>
  );
}

export default MarketingPage;