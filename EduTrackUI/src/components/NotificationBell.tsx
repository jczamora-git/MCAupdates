import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from 'react-router-dom';
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useInfiniteNotifications, useUnreadCount, useMarkAsRead, useAnnouncements, useMarkAnnouncementRead } from "@/hooks/useNotifications";
import { formatDistanceToNow } from 'date-fns';

interface NotificationBellProps {
  onOpen?: () => void;
  onClose?: () => void;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

export const NotificationBell = ({ onOpen, onClose, isOpen: propIsOpen, onOpenChange }: NotificationBellProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = propIsOpen !== undefined ? propIsOpen : internalIsOpen;
  
  const setIsOpen = (value: boolean) => {
    if (propIsOpen === undefined) {
      setInternalIsOpen(value);
    }
    onOpenChange?.(value);
    if (value) {
      onOpen?.();
    } else {
      onClose?.();
    }
  };
  
  // Use hooks
  const { data: unreadCountData } = useUnreadCount();
  const {
    data: notificationsPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteNotifications({ limit: 10 });
  const { data: announcementsData } = useAnnouncements();
  const markAsReadMutation = useMarkAsRead();
  const markAnnouncementReadMutation = useMarkAnnouncementRead();
  
  const unreadCount = unreadCountData?.count ?? 0;
  const systemNotifications = notificationsPages?.pages.flatMap((page) => page.data ?? []) ?? [];

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

  const handleDropdownScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;

    if (distanceFromBottom < 80 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const matchesAudience = (aud: any, role?: string) => {
    const r = (role || '').toString().toLowerCase();
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
    if (r === 'admin') return true;
    if (r === 'student' && (tokens.includes('student') || tokens.includes('students'))) return true;
    if (r === 'teacher' && (tokens.includes('teacher') || tokens.includes('teachers'))) return true;
    
    return false;
  };

  // Filter announcements by audience
  const announcements = ((announcementsData?.data ?? announcementsData?.announcements ?? []) as any[])
    .filter((ann: any) => matchesAudience(ann.audience, user?.role));

  // Badge count: unread system notifs + unread announcements
  const unreadAnnouncements = announcements.filter((a: any) => !a.is_read);
  const totalBadgeCount = unreadCount + unreadAnnouncements.length;

  // Merge and sort notifications + announcements
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

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.notification-bell-container')) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);

  const handleItemClick = (item: any) => {
    if (item.source === 'notification') {
      const targetUrl = resolveNotificationTargetUrl(item);

      // For installment/payment-plan notifications, keep unread until user clicks View action on highlighted row.
      const category = getNotificationCategory(item);
      const canDeferInstallmentRead = category === 'installment' && !!item?.entity_id;
      if (!canDeferInstallmentRead && !item.is_read) {
        markAsReadMutation.mutate(item.id);
      }

      if (targetUrl) {
        setIsOpen(false);
        navigate(targetUrl);
      }
    } else {
      // Mark announcement as read
      if (!item.is_read) {
        markAnnouncementReadMutation.mutate(item.id);
      }
      setIsOpen(false);
    }
  };

  const getNotificationTypeColor = (type: string) => {
    if (type.includes('success') || type.includes('approved') || type.includes('confirmed')) {
      return 'bg-green-500';
    }
    if (type.includes('error') || type.includes('failed') || type.includes('rejected')) {
      return 'bg-red-500';
    }
    if (type.includes('warning') || type.includes('pending')) {
      return 'bg-yellow-500';
    }
    return 'bg-blue-500';
  };

  const getNotificationCategory = (item: any): 'payment' | 'installment' | 'enrollment' | 'general' => {
    const entityType = String(item?.entity_type || '').toLowerCase().trim();
    const actionUrl = String(item?.action_url || '').toLowerCase();
    const type = String(item?.type || '').toLowerCase();

    const dataAction = (() => {
      const rawData = item?.data;
      if (!rawData) return '';
      if (typeof rawData === 'object') return String(rawData.action || '').toLowerCase();
      if (typeof rawData === 'string') {
        try {
          const parsed = JSON.parse(rawData);
          return String(parsed?.action || '').toLowerCase();
        } catch {
          return '';
        }
      }
      return '';
    })();

    // Primary categorization: use backend entity_type (from notifications/audit context)
    if (entityType === 'payment') {
      return 'payment';
    }
    if (entityType === 'payment_plan' || entityType === 'installment') {
      return 'installment';
    }
    if (entityType === 'enrollment') {
      return 'enrollment';
    }

    // Structured fallback only (for legacy rows missing entity_type)
    if (
      actionUrl.includes('/payment-plans') ||
      actionUrl.includes('/installment') ||
      type.startsWith('payment_plan.') ||
      type.startsWith('installment.') ||
      dataAction === 'payment_plan.created'
    ) {
      return 'installment';
    }

    if (
      actionUrl.includes('/payment') ||
      type.startsWith('payment.') ||
      dataAction.startsWith('payment.')
    ) {
      return 'payment';
    }

    if (
      actionUrl.includes('/enrollment') ||
      type.startsWith('enrollment.') ||
      dataAction.startsWith('enrollment.')
    ) {
      return 'enrollment';
    }

    return 'general';
  };

  const resolveNotificationTargetUrl = (item: any): string | null => {
    const category = getNotificationCategory(item);
    const role = (user?.role || '').toString().toLowerCase();
    const isAdmin = role === 'admin';

    let actionUrl = (item?.action_url || '').toString();

    if (!actionUrl) {
      if (category === 'payment') {
        actionUrl = isAdmin ? '/admin/payments' : '/enrollment/payment';
      } else if (category === 'installment') {
        actionUrl = isAdmin ? '/admin/payment-plans' : '/enrollment/payment';
      } else if (category === 'enrollment') {
        actionUrl = isAdmin ? '/admin/enrollments' : '/enrollment/payment';
      }
    }

    // Force payment_plan notifications to payment plans page for admin view
    if (category === 'installment' && isAdmin) {
      actionUrl = '/admin/payment-plans';
    }

    if (!actionUrl) return null;

    // Keep row highlight behavior where implemented
    if (item?.entity_id && (category === 'payment' || category === 'enrollment' || category === 'installment')) {
      const separator = actionUrl.includes('?') ? '&' : '?';
      return `${actionUrl}${separator}highlight=${item.entity_id}&notification_id=${item.id}`;
    }

    return actionUrl;
  };

  const getNotificationCategoryStyle = (category: 'payment' | 'installment' | 'enrollment' | 'general') => {
    if (category === 'payment') {
      return {
        label: 'Payment',
        accentBarClass: 'bg-emerald-500',
        badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
        unreadBgClass: 'bg-emerald-50/60 dark:bg-emerald-950/25',
        unreadDotClass: 'bg-emerald-500',
      };
    }

    if (category === 'installment') {
      return {
        label: 'Installment',
        accentBarClass: 'bg-amber-500',
        badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        unreadBgClass: 'bg-amber-50/70 dark:bg-amber-950/25',
        unreadDotClass: 'bg-amber-500',
      };
    }

    if (category === 'enrollment') {
      return {
        label: 'Enrollment',
        accentBarClass: 'bg-sky-500',
        badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
        unreadBgClass: 'bg-sky-50/70 dark:bg-sky-950/25',
        unreadDotClass: 'bg-sky-500',
      };
    }

    return {
      label: 'General',
      accentBarClass: 'bg-slate-400',
      badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      unreadBgClass: 'bg-slate-100/70 dark:bg-slate-900/30',
      unreadDotClass: 'bg-slate-500',
    };
  };

  const announcementStyle = {
    accentBarClass: 'bg-purple-500',
    badgeClass: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    unreadBgClass: 'bg-purple-50/50 dark:bg-purple-950/20',
    unreadDotClass: 'bg-purple-500',
  };

  return (
    <div className="notification-bell-container relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative hover:bg-muted"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {totalBadgeCount > 0 && (
          <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-semibold">
            {totalBadgeCount > 9 ? '9+' : totalBadgeCount}
          </span>
        )}
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="fixed left-2 right-2 top-16 mt-0 z-[70] bg-card border border-border rounded-lg shadow-lg overflow-hidden sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 sm:max-w-80 sm:z-50">
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-sm">Notifications</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 p-0"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Notifications List */}
          <div className="max-h-[70vh] sm:max-h-96 overflow-y-auto" onScroll={handleDropdownScroll}>
            {allItems.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {allItems.map((item: any) => {
                  if (item.source === 'notification') {
                    const category = getNotificationCategory(item);
                    const categoryStyle = getNotificationCategoryStyle(category);

                    // Render system notification
                    return (
                      <div
                        key={`notif-${item.id}`}
                        className={cn(
                          "relative p-4 hover:bg-muted/50 transition-colors cursor-pointer",
                          !item.is_read && categoryStyle.unreadBgClass
                        )}
                        onClick={() => handleItemClick(item)}
                      >
                        <div className={cn("absolute left-0 top-0 h-full w-1", categoryStyle.accentBarClass)} />
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className={cn(
                                "text-sm font-medium break-words",
                                !item.is_read && "font-semibold"
                              )}>
                                {item.title}
                              </p>
                              <span className={cn(
                                "text-[10px] px-2 py-0.5 rounded font-medium shrink-0",
                                categoryStyle.badgeClass
                              )}>
                                {categoryStyle.label}
                              </span>
                              {!item.is_read && (
                                <div className={cn("w-2 h-2 rounded-full flex-shrink-0", categoryStyle.unreadDotClass)} />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {item.body}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {formatRelativeTimeSafe(item.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    // Render announcement
                    return (
                      <div
                        key={`announce-${item.id}`}
                        className={cn(
                          "relative p-4 hover:bg-muted/50 transition-colors cursor-pointer",
                          !item.is_read && announcementStyle.unreadBgClass
                        )}
                        onClick={() => handleItemClick(item)}
                      >
                        <div className={cn("absolute left-0 top-0 h-full w-1", announcementStyle.accentBarClass)} />
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className={cn(
                                "text-sm font-medium break-words",
                                !item.is_read && "font-semibold"
                              )}>{item.title}</p>
                              <span className={cn("text-xs px-2 py-0.5 rounded shrink-0", announcementStyle.badgeClass)}>
                                Announcement
                              </span>
                              {!item.is_read && (
                                <div className={cn("w-2 h-2 rounded-full flex-shrink-0", announcementStyle.unreadDotClass)} />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {item.message}
                            </p>
                            <div className="text-xs text-muted-foreground mt-2">
                              {item.published_at && (
                                <span>{formatRelativeTimeSafe(item.published_at)}</span>
                              )}
                              {item.audience && (
                                <span className="ml-3">• {item.audience}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            )}

            {isFetchingNextPage && (
              <div className="py-3 text-center text-xs text-muted-foreground border-t border-border/60">
                Loading more notifications...
              </div>
            )}
          </div>

          {/* Footer */}
          {allItems.length > 0 && (
            <div className="p-3 border-t border-border text-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setIsOpen(false);
                  const role = (user?.role || '').toString().toLowerCase();
                  if (role === 'admin') {
                    navigate('/admin/announcements');
                  } else if (role === 'teacher') {
                    navigate('/teacher/notifications');
                  } else {
                    navigate('/student/notifications');
                  }
                }}
              >
                View All Notifications
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
