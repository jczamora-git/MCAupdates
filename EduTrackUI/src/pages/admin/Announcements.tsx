import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { API_ENDPOINTS, apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { useNotification } from "@/hooks/useNotification";
import { useNotifications, useAuditLogs, useNotificationStats } from "@/hooks/useNotifications";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Plus, Activity, FileText, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";

const Announcements = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";

  // useEffect(() => {
  //   if (!isAuthenticated || user?.role !== "admin") {
  //     navigate("/auth");
  //   }
  // }, [isAuthenticated, user, navigate]);

  const notify = useNotification();
  const [announcements, setAnnouncements] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("announcements");

  const ITEMS_PER_PAGE = 20;
  const [notifPage, setNotifPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);

  // Reset page when switching tabs
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'notifications') setNotifPage(1);
    if (tab === 'audit-logs') setAuditPage(1);
  };

  // Announcements state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("all");
  const [status, setStatus] = useState("active");
  const [startsAt, setStartsAt] = useState<string>("");
  const [endsAt, setEndsAt] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editAudience, setEditAudience] = useState("all");
  const [editStatus, setEditStatus] = useState("active");
  const [editStartsAt, setEditStartsAt] = useState<string>("");
  const [editEndsAt, setEditEndsAt] = useState<string>("");
  const [editSaving, setEditSaving] = useState(false);

  const adminAudienceOptions = [
    { value: "all", label: "All Users" },
    { value: "students", label: "Students Only" },
    { value: "teachers", label: "Teachers Only" },
    { value: "parents", label: "Parents Only" },
    { value: "staff", label: "Staff Only" }
  ];

  const teacherAudienceOptions = [
    { value: "my_students", label: "My Students" },
    { value: "my_classes", label: "My Classes" },
    { value: "parents_of_my_students", label: "Parents of My Students" }
  ];

  const audienceOptions = isTeacher ? teacherAudienceOptions : adminAudienceOptions;
  const defaultAudience = isTeacher ? "my_students" : "all";

  const toValidDate = (value: unknown): Date | null => {
    if (!value) return null;
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatDateTimeSafe = (value: unknown) => {
    const parsed = toValidDate(value);
    return parsed ? parsed.toLocaleString() : '-';
  };

  const formatRelativeTimeSafe = (value: unknown) => {
    const parsed = toValidDate(value);
    return parsed ? formatDistanceToNow(parsed, { addSuffix: true }) : 'Unknown time';
  };

  useEffect(() => {
    if (!isAdmin) {
      setActiveTab("announcements");
    }
    if (!audienceOptions.some((opt) => opt.value === audience)) {
      setAudience(defaultAudience);
    }
    if (!audienceOptions.some((opt) => opt.value === editAudience)) {
      setEditAudience(defaultAudience);
    }
  }, [isAdmin, audienceOptions, audience, editAudience, defaultAudience]);

  // Notifications hooks
  const { data: notificationsData, isLoading: notificationsLoading } = useNotifications({
    limit: ITEMS_PER_PAGE,
    offset: (notifPage - 1) * ITEMS_PER_PAGE,
    enabled: activeTab === 'notifications'
  });

  // Audit logs hooks
  const { data: auditLogsData, isLoading: auditLogsLoading } = useAuditLogs({
    limit: ITEMS_PER_PAGE,
    offset: (auditPage - 1) * ITEMS_PER_PAGE,
    enabled: activeTab === 'audit-logs'
  });

  // Stats hooks
  const { data: statsData } = useNotificationStats(activeTab === 'stats');

  // if (!isAuthenticated) return null;

  useEffect(() => {
    let mounted = true;
    const fetchAnnouncements = async () => {
      setLoading(true);
      try {
        const res = await apiGet(`${API_ENDPOINTS.ANNOUNCEMENTS}?include_expired=1`);
        // Expecting res.data or res.announcements or array directly
        const list = res.data ?? res.announcements ?? res ?? [];
        if (Array.isArray(list) && mounted) {
          setAnnouncements(list);
        }
      } catch (e) {
        console.error('Failed to fetch announcements', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchAnnouncements();
    return () => { mounted = false; };
  }, []);

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{isTeacher ? "My Announcements" : "Announcements & Notifications"}</h1>
            <p className="text-muted-foreground">
              {isTeacher ? "Create and manage your announcements" : "Manage announcements, view notifications, and monitor audit logs"}
            </p>
          </div>
          {activeTab === 'announcements' && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Announcement
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Announcement</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="starts_at">Starts At</Label>
                      <Input id="starts_at" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="ends_at">Ends At</Label>
                      <Input id="ends_at" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="message">Message</Label>
                    <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Announcement details" rows={4} />
                  </div>
                  <div>
                    <Label htmlFor="audience">Target Audience</Label>
                    <Select value={audience} onValueChange={(v) => setAudience(String(v))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select audience" />
                      </SelectTrigger>
                      <SelectContent>
                        {audienceOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={status} onValueChange={(v) => setStatus(String(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Button className="w-full" disabled={saving || !title || !message} onClick={async () => {
                      if (!title || !message) return notify.error('Title and message are required');
                      setSaving(true);
                      try {
                        let published = new Date().toISOString().slice(0,19).replace('T',' ');

                        const toSqlDatetime = (val: string) => {
                          if (!val) return null;
                          if (val.includes('T')) {
                            const withSpace = val.replace('T', ' ');
                            return withSpace.length === 16 ? `${withSpace}:00` : withSpace;
                          }
                          return `${val} 00:00:00`;
                        };

                        const payload: any = {
                          title,
                          message,
                          audience,
                          status,
                          published_at: published,
                        };

                        const s = toSqlDatetime(startsAt);
                        const e = toSqlDatetime(endsAt);
                        if (s) payload.starts_at = s;
                        if (e) payload.ends_at = e;

                        const res = await apiPost(API_ENDPOINTS.ANNOUNCEMENTS, payload);
                        const created = res.data ?? res.announcement ?? null;
                        if (created) {
                          setAnnouncements((prev) => [created, ...prev]);
                          setTitle(''); setMessage(''); setAudience(defaultAudience); setStatus('active'); setStartsAt(''); setEndsAt(''); setIsCreateOpen(false);
                          notify.success('Announcement published');
                        } else {
                          if (res && Array.isArray(res) === false && res.id) {
                            setAnnouncements((prev) => [res, ...prev]);
                            setTitle(''); setMessage(''); setAudience(defaultAudience); setStatus('active'); setStartsAt(''); setEndsAt(''); setIsCreateOpen(false);
                            notify.success('Announcement published');
                          } else {
                            notify.error(res?.message || 'Failed to create announcement');
                          }
                        }
                      } catch (e: any) {
                        notify.error(e?.message || 'Failed to create announcement');
                      } finally {
                        setSaving(false);
                      }
                    }}>{saving ? 'Publishing...' : 'Publish Announcement'}</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          {isAdmin && (
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="announcements" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Announcements
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="audit-logs" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Audit Logs
              </TabsTrigger>
              <TabsTrigger value="stats" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Statistics
              </TabsTrigger>
            </TabsList>
          )}

          {/* Announcements Tab */}
          <TabsContent value="announcements">
            <Card className="shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-muted/50 to-muted border-b">
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  {isTeacher ? "My Announcements" : "All Announcements"} ({announcements.length})
                </CardTitle>
                <CardDescription>Manage and track announcements</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Title</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Audience</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Schedule</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {announcements.map((announcement) => (
                        <tr key={announcement.id} className="hover:bg-muted/50">
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm font-medium">{announcement.title}</p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{announcement.message}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant="secondary">{announcement.audience}</Badge>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs text-muted-foreground">
                              Starts: {formatDateTimeSafe(announcement.starts_at)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Ends: {formatDateTimeSafe(announcement.ends_at)}
                            </p>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge
                              variant={announcement.status === "active" ? "default" : "outline"}
                            >
                              {announcement.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" onClick={() => {
                                setEditingId(Number(announcement.id));
                                setEditTitle(announcement.title ?? '');
                                setEditMessage(announcement.message ?? '');
                                const nextAudience = announcement.audience ?? defaultAudience;
                                setEditAudience(audienceOptions.some((opt) => opt.value === nextAudience) ? nextAudience : defaultAudience);
                                setEditStatus(announcement.status ?? 'active');
                                setEditStartsAt(announcement.starts_at ? (announcement.starts_at.replace(' ', 'T').slice(0,19)) : '');
                                setEditEndsAt(announcement.ends_at ? (announcement.ends_at.replace(' ', 'T').slice(0,19)) : '');
                                setIsEditOpen(true);
                              }}>
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={async () => {
                                  const ok = window.confirm(`Delete announcement \"${announcement.title ?? 'Untitled'}\"?`);
                                  if (!ok) return;
                                  try {
                                    const res = await apiDelete(API_ENDPOINTS.ANNOUNCEMENT_BY_ID(Number(announcement.id)));
                                    if (res && (res.success || res.id || res.message)) {
                                      setAnnouncements((prev) => prev.filter((a) => Number(a.id) !== Number(announcement.id)));
                                      notify.success('Announcement deleted');
                                    } else {
                                      notify.error(res?.message || 'Failed to delete announcement');
                                    }
                                  } catch (err: any) {
                                    notify.error(err?.message || 'Failed to delete announcement');
                                  }
                                }}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {loading && (
                    <div className="text-center py-8 text-muted-foreground">Loading announcements...</div>
                  )}

                  {!loading && announcements.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">No announcements found</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          {isAdmin && (
            <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  System Notifications
                </CardTitle>
                <CardDescription>
                  Recent notifications sent to users ({notificationsData?.unread_count || 0} unread)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {notificationsLoading ? (
                  <p className="text-muted-foreground">Loading notifications...</p>
                ) : (
                  <div className="space-y-3">
                    {notificationsData?.data?.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 border rounded-lg ${
                          !notification.is_read ? 'bg-blue-50 border-blue-200' : 'border-border'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline">{notification.type}</Badge>
                              {!notification.is_read && (
                                <Badge variant="default" className="text-xs">New</Badge>
                              )}
                            </div>
                            <p className="font-medium">{notification.title}</p>
                            <p className="text-sm text-muted-foreground mt-1">{notification.body}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {formatRelativeTimeSafe(notification.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {notificationsData?.data?.length === 0 && (
                      <p className="text-muted-foreground text-center py-8">No notifications yet</p>
                    )}

                    {/* Pagination */}
                    {(() => {
                      const total = notificationsData?.total ?? 0;
                      const totalPages = Math.ceil(total / ITEMS_PER_PAGE) || 1;
                      if (totalPages <= 1) return null;
                      return (
                        <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
                          <p className="text-sm text-muted-foreground">
                            Page {notifPage} of {totalPages} &middot; {total} total
                          </p>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setNotifPage(p => Math.max(1, p - 1))} disabled={notifPage === 1}>Previous</Button>
                            <Button variant="outline" size="sm" onClick={() => setNotifPage(p => Math.min(totalPages, p + 1))} disabled={notifPage === totalPages}>Next</Button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {/* Audit Logs Tab */}
          {isAdmin && (
            <TabsContent value="audit-logs">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Audit Logs
                </CardTitle>
                <CardDescription>Complete history of all system actions</CardDescription>
              </CardHeader>
              <CardContent>
                {auditLogsLoading ? (
                  <p className="text-muted-foreground">Loading audit logs...</p>
                ) : (
                  <div className="space-y-2">
                    {auditLogsData?.data?.map((log: any) => (
                      <div key={log.id} className="p-3 border border-border rounded-lg text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{log.action}</Badge>
                            <Badge variant="secondary">{log.actor_role}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTimeSafe(log.created_at)}
                          </span>
                        </div>
                        <p className="text-muted-foreground">{log.description}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{log.entity_type} #{log.entity_id}</span>
                          {log.actor_name && <span>by {log.actor_name}</span>}
                        </div>
                      </div>
                    ))}
                    {auditLogsData?.data?.length === 0 && (
                      <p className="text-muted-foreground text-center py-8">No audit logs yet</p>
                    )}

                    {/* Pagination */}
                    {(() => {
                      const total = (auditLogsData as any)?.total ?? 0;
                      const totalPages = Math.ceil(total / ITEMS_PER_PAGE) || 1;
                      if (totalPages <= 1) return null;
                      return (
                        <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
                          <p className="text-sm text-muted-foreground">
                            Page {auditPage} of {totalPages} &middot; {total} total
                          </p>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setAuditPage(p => Math.max(1, p - 1))} disabled={auditPage === 1}>Previous</Button>
                            <Button variant="outline" size="sm" onClick={() => setAuditPage(p => Math.min(totalPages, p + 1))} disabled={auditPage === totalPages}>Next</Button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {/* Statistics Tab */}
          {isAdmin && (
            <TabsContent value="stats">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Today's Notifications</CardTitle>
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{statsData?.stats?.today_notifications || 0}</div>
                  <p className="text-xs text-muted-foreground">Sent today</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Today's Audit Logs</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{statsData?.stats?.today_audits || 0}</div>
                  <p className="text-xs text-muted-foreground">Actions recorded</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Push</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{statsData?.stats?.pending_push || 0}</div>
                  <p className="text-xs text-muted-foreground">In queue</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Failed Push (24h)</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{statsData?.stats?.failed_push || 0}</div>
                  <p className="text-xs text-muted-foreground">Needs attention</p>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Notifications by Type (Last 7 Days)</CardTitle>
                <CardDescription>Most common notification types</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {statsData?.stats?.by_type_last_7_days?.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 border border-border rounded">
                      <span className="text-sm font-medium">{item.type}</span>
                      <Badge variant="secondary">{item.count}</Badge>
                    </div>
                  ))}
                  {(!statsData?.stats?.by_type_last_7_days || statsData.stats.by_type_last_7_days.length === 0) && (
                    <p className="text-muted-foreground text-center py-4">No data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}
        </Tabs>
        {/* Edit Announcement Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Announcement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-title">Title</Label>
                <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-starts_at">Starts At</Label>
                  <Input id="edit-starts_at" type="datetime-local" value={editStartsAt} onChange={(e) => setEditStartsAt(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="edit-ends_at">Ends At</Label>
                  <Input id="edit-ends_at" type="datetime-local" value={editEndsAt} onChange={(e) => setEditEndsAt(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-message">Message</Label>
                <Textarea id="edit-message" value={editMessage} onChange={(e) => setEditMessage(e.target.value)} rows={4} />
              </div>
              <div>
                <Label htmlFor="edit-audience">Target Audience</Label>
                <Select value={editAudience} onValueChange={(v) => setEditAudience(String(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {audienceOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(String(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="flex gap-2">
                  <Button className="flex-1" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                  <Button className="flex-1" disabled={editSaving || !editTitle || !editMessage} onClick={async () => {
                    if (!editingId) return;
                    setEditSaving(true);
                    try {
                      const toSqlDatetime = (val: string) => {
                        if (!val) return null;
                        if (val.includes('T')) {
                          const withSpace = val.replace('T', ' ');
                          return withSpace.length === 16 ? `${withSpace}:00` : withSpace;
                        }
                        return `${val} 00:00:00`;
                      };

                      const payload: any = {
                        title: editTitle,
                        message: editMessage,
                        audience: editAudience,
                        status: editStatus,
                      };
                      const s = toSqlDatetime(editStartsAt);
                      const e = toSqlDatetime(editEndsAt);
                      if (s) payload.starts_at = s;
                      if (e) payload.ends_at = e;

                      const res = await apiPut(API_ENDPOINTS.ANNOUNCEMENT_BY_ID(editingId), payload);
                      if (res && (res.success || res.id)) {
                        // Update local list
                        setAnnouncements((prev) => prev.map((a) => a.id === editingId ? ({ ...a, ...payload, id: editingId }) : a));
                        setIsEditOpen(false);
                        notify.success('Announcement updated');
                      } else {
                        notify.error(res?.message || 'Failed to update announcement');
                      }
                    } catch (err: any) {
                      notify.error(err?.message || 'Failed to update announcement');
                    } finally {
                      setEditSaving(false);
                    }
                  }}>{editSaving ? 'Saving...' : 'Save Changes'}</Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Announcements;
