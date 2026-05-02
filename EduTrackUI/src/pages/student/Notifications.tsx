import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNotifications, useMarkAsRead, useMarkAllAsRead, useAnnouncements, useMarkAnnouncementRead } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { Bell, CheckCheck, Check, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const ITEMS_PER_PAGE = 20;

const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all' | 'unread' | 'notifications' | 'announcements'>('all');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  const { data: notificationsData, isLoading } = useNotifications({
    limit: ITEMS_PER_PAGE,
    offset: (currentPage - 1) * ITEMS_PER_PAGE
  });
  const { data: announcementsData } = useAnnouncements();
  const markAsReadMutation = useMarkAsRead();
  const markAllAsReadMutation = useMarkAllAsRead();
  const markAnnouncementReadMutation = useMarkAnnouncementRead();

  const systemNotifications = notificationsData?.data ?? [];
  const totalNotifications = notificationsData?.total ?? 0;

  const toValidDate = (value: unknown): Date | null => {
    if (!value) return null;
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatRelativeTimeSafe = (value: unknown) => {
    const parsed = toValidDate(value);
    if (!parsed) return 'Unknown time';
    return formatDistanceToNow(parsed, { addSuffix: true });
  };

  const matchesAudience = (aud: any) => {
    const role = (user?.role || '').toString().toLowerCase();
    if (!aud) return true;
    
    let tokens: string[] = [];
    if (Array.isArray(aud)) {
      tokens = aud.map((x: any) => String(x).toLowerCase());
    } else if (typeof aud === 'object' && aud.roles) {
      tokens = aud.roles.map((x: any) => String(x).toLowerCase());
    } else {
      const raw = String(aud).toLowerCase();
      tokens = raw.split(/[,;|]+/).map(s => s.trim());
    }
    
    tokens = tokens.map(t => t.replace(/[^a-z0-9]/g, '')).filter(Boolean);
    
    if (tokens.includes('all') || tokens.includes('everyone')) return true;
    if (role === 'admin') return true;
    if (role === 'student' && (tokens.includes('student') || tokens.includes('students'))) return true;
    if (role === 'teacher' && (tokens.includes('teacher') || tokens.includes('teachers'))) return true;
    
    return false;
  };

  // Filter announcements by audience
  const announcements = ((announcementsData?.data ?? announcementsData?.announcements ?? []) as any[])
    .filter((ann: any) => matchesAudience(ann.audience));

  // Merge all items
  const allItems = [
    ...systemNotifications.map((n: any) => ({
      ...n,
      source: 'notification',
      sortDate: toValidDate(n.created_at) ?? new Date(0)
    })),
    ...announcements.map((a: any) => ({
      ...a,
      source: 'announcement',
      sortDate: toValidDate(a.published_at || a.created_at) ?? new Date(0)
    }))
  ].sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());

  const totalPages = Math.ceil((totalNotifications + announcements.length) / ITEMS_PER_PAGE) || 1;

  // Apply filters
  const filteredItems = allItems.filter((item) => {
    if (filter === 'unread') {
      if (item.source === 'notification') return !item.is_read;
      if (item.source === 'announcement') return !item.is_read;
      return false;
    }
    if (filter === 'notifications') {
      return item.source === 'notification';
    }
    if (filter === 'announcements') {
      return item.source === 'announcement';
    }
    return true;
  });

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  // Group items by time period
  const groupedItems = {
    today: filteredItems.filter(item => isToday(item.sortDate)),
    yesterday: filteredItems.filter(item => isYesterday(item.sortDate)),
    thisWeek: filteredItems.filter(item => !isToday(item.sortDate) && !isYesterday(item.sortDate) && isThisWeek(item.sortDate)),
    thisMonth: filteredItems.filter(item => !isThisWeek(item.sortDate) && isThisMonth(item.sortDate)),
    older: filteredItems.filter(item => !isThisMonth(item.sortDate))
  };

  const handleMarkAsRead = (notificationId: number) => {
    markAsReadMutation.mutate(notificationId);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const getNotificationTypeColor = (type: string) => {
    if (type.includes('success') || type.includes('approved') || type.includes('confirmed')) {
      return 'text-green-600 dark:text-green-400';
    }
    if (type.includes('error') || type.includes('failed') || type.includes('rejected')) {
      return 'text-red-600 dark:text-red-400';
    }
    if (type.includes('warning') || type.includes('pending')) {
      return 'text-yellow-600 dark:text-yellow-400';
    }
    return 'text-blue-600 dark:text-blue-400';
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-orange-500',
      'bg-teal-500'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const unreadCount = systemNotifications.filter((n: any) => !n.is_read).length;
  const unreadAnnouncementCount = announcements.filter((a: any) => !a.is_read).length;

  const renderTimeGroup = (title: string, items: any[]) => {
    if (items.length === 0) return null;

    return (
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-1">
          {title}
        </h2>
        <div className="space-y-2">
          {items.map((item: any) => {
            const itemId = `${item.source}-${item.id}`;
            const isHovered = hoveredId === itemId;

            if (item.source === 'notification') {
              return (
                <div
                  key={itemId}
                  className={cn(
                    'group relative p-4 rounded-lg transition-all cursor-pointer',
                    !item.is_read 
                      ? 'bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/30' 
                      : 'bg-card hover:bg-muted/50'
                  )}
                  onMouseEnter={() => setHoveredId(itemId)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => {
                    if (!item.is_read) {
                      handleMarkAsRead(item.id);
                    }
                  }}
                >
                  <div className="flex gap-3">
                    {/* Avatar */}
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarFallback className={getAvatarColor(item.title)}>
                        {item.icon === 'user' ? <User className="h-5 w-5" /> : getInitials(item.title)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-relaxed">
                        <span className={cn('font-semibold', getNotificationTypeColor(item.type))}>
                          {item.title}
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.body}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTimeSafe(item.created_at)}
                        </span>
                        {item.entity_type && (
                          <>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                              {item.entity_type.toUpperCase()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Unread indicator & mark as read */}
                    <div className="flex items-start gap-2">
                      {!item.is_read && (
                        <div className="w-2 h-2 rounded-full bg-blue-600 mt-2" />
                      )}
                      {!item.is_read && isHovered && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(item.id);
                          }}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            } else {
              // Announcement
              return (
                <div
                  key={itemId}
                  className={cn(
                    "group p-4 rounded-lg transition-all cursor-pointer",
                    !item.is_read
                      ? 'bg-purple-50 dark:bg-purple-950/20 hover:bg-purple-100 dark:hover:bg-purple-950/30'
                      : 'bg-card hover:bg-muted/50'
                  )}
                  onMouseEnter={() => setHoveredId(itemId)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => {
                    if (!item.is_read) markAnnouncementReadMutation.mutate(item.id);
                  }}
                >
                  <div className="flex gap-3">
                    {/* Avatar */}
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarFallback className="bg-purple-500">
                        <Bell className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={cn(
                          "text-sm text-purple-700 dark:text-purple-300",
                          !item.is_read ? 'font-semibold' : 'font-medium'
                        )}>
                          {item.title}
                        </p>
                        <Badge variant="secondary" className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                          Announcement
                        </Badge>
                        {!item.is_read && (
                          <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {item.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTimeSafe(item.published_at || item.created_at)}
                        </span>
                        {item.audience && (
                          <>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground capitalize">{item.audience}</span>
                          </>
                        )}
                        {item.is_read && item.read_at && (
                          <>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-green-600 dark:text-green-400">Read</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Mark as read button */}
                    {!item.is_read && (
                      <div className="flex items-start">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAnnouncementReadMutation.mutate(item.id);
                          }}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            }
          })}
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Notifications</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {unreadCount > 0 && `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
                {unreadCount > 0 && unreadAnnouncementCount > 0 && ' · '}
                {unreadAnnouncementCount > 0 && `${unreadAnnouncementCount} unread announcement${unreadAnnouncementCount !== 1 ? 's' : ''}`}
              </p>
            </div>
            {unreadCount > 0 && (
              <Button
                onClick={handleMarkAllAsRead}
                variant="ghost"
                size="sm"
                className="w-full sm:w-auto text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                Mark all as read
              </Button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 border-b border-border">
            <Button
              variant="ghost"
              className={cn(
                'rounded-none border-b-2 transition-colors',
                filter === 'all' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setFilter('all')}
            >
              All
              <Badge variant="secondary" className="ml-2">
                {allItems.length}
              </Badge>
            </Button>
            <Button
              variant="ghost"
              className={cn(
                'rounded-none border-b-2 transition-colors',
                filter === 'unread' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setFilter('unread')}
            >
              Unread
              {(unreadCount + unreadAnnouncementCount) > 0 && (
                <Badge 
                  variant="secondary" 
                  className="ml-2 bg-blue-600 text-white hover:bg-blue-700"
                >
                  {unreadCount + unreadAnnouncementCount}
                </Badge>
              )}
            </Button>
            <Button
              variant="ghost"
              className={cn(
                'rounded-none border-b-2 transition-colors hidden sm:flex',
                filter === 'notifications' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setFilter('notifications')}
            >
              Notifications
              <Badge variant="secondary" className="ml-2">
                {systemNotifications.length}
              </Badge>
            </Button>
            <Button
              variant="ghost"
              className={cn(
                'rounded-none border-b-2 transition-colors hidden sm:flex',
                filter === 'announcements' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setFilter('announcements')}
            >
              Announcements
              <Badge variant="secondary" className="ml-2">
                {announcements.length}
              </Badge>
            </Button>
          </div>
        </div>

        {/* Notifications List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-50 animate-pulse" />
            <p>Loading notifications...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
            </p>
          </div>
        ) : (
          <>
            {renderTimeGroup('TODAY', groupedItems.today)}
            {renderTimeGroup('YESTERDAY', groupedItems.yesterday)}
            {renderTimeGroup('THIS WEEK', groupedItems.thisWeek)}
            {renderTimeGroup('THIS MONTH', groupedItems.thisMonth)}
            {renderTimeGroup('OLDER', groupedItems.older)}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default NotificationsPage;
