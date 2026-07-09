// src/components/NotificationBell.tsx
// Notification bell component with user score and badge display

import { useState, useEffect } from "react";
import { Bell, X, CheckCircle, XCircle, Clock, Plus, Trophy, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { getUserNotifications, getUserProfile, markNotificationAsRead, Notification, UserProfile, stripEmojis } from "@/lib/firebase-services";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const { userData } = useAuth();

  useEffect(() => {
    if (userData?.uid) {
      loadNotifications();
      loadUserProfile();
      
      // Set up real-time listener for notifications
      const notificationsRef = collection(db, 'notifications');
      const userNotificationsQuery = query(
        notificationsRef,
        where('userId', '==', userData.uid),
        orderBy('createdAt', 'desc')
      );
      
      const unsubscribe = onSnapshot(userNotificationsQuery, (snapshot) => {
        const updatedNotifications = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Notification[];
        
        setNotifications(updatedNotifications);
        // Update unread count in real-time
        const unreadCount = updatedNotifications.filter(n => !n.isRead).length;
        setUnreadCount(unreadCount);
        console.log('Real-time notification update - unread count:', unreadCount);
      }, (error) => {
        console.log('Real-time notifications error:', error);
      });
      
      return unsubscribe;
    }
  }, [userData?.uid]);

  // Handle click outside to close notification panel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen) {
        const target = event.target as Element;
        const notificationPanel = document.querySelector('[data-notification-panel]');
        const notificationButton = document.querySelector('[data-notification-button]');
        
        if (notificationPanel && notificationButton) {
          if (!notificationPanel.contains(target) && !notificationButton.contains(target)) {
            setIsOpen(false);
          }
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const loadNotifications = async () => {
    if (!userData?.uid) return;
    
    try {
      const userNotifications = await getUserNotifications(userData.uid);
      setNotifications(userNotifications);
      setUnreadCount(userNotifications.filter(n => !n.isRead).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const loadUserProfile = async () => {
    if (!userData?.uid) return;
    
    try {
      const profile = await getUserProfile(userData.uid);
      setUserProfile(profile);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      
      // Update local state immediately for better UX
      setNotifications(prev => prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, isRead: true }
          : notification
      ));
      
      // Update unread count immediately
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      console.log('Notification marked as read, unread count updated');
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      // Mark all unread notifications as read in Firebase
      const unreadNotifications = notifications.filter(n => !n.isRead);
      
      for (const notification of unreadNotifications) {
        if (notification.id) {
          await markNotificationAsRead(notification.id);
        }
      }
      
      // Update local state immediately
      setNotifications(prev => prev.map(notification => ({
        ...notification,
        isRead: true
      })));
      
      // Reset unread count
      setUnreadCount(0);
      
      console.log('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'incident_created':
        return <Plus className="h-4 w-4 text-primary" />;
      case 'incident_accepted':
        return <CheckCircle className="h-4 w-4 text-primary" />;
      case 'incident_rejected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'incident_in_progress':
        return <Clock className="h-4 w-4 text-primary" />;
      case 'incident_pending':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case 'badge_earned':
        return <Trophy className="h-4 w-4 text-primary" />;
      case 'points_earned':
        return <Star className="h-4 w-4 text-primary" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 100) return "text-purple-600";
    if (score >= 75) return "text-yellow-600";
    if (score >= 50) return "text-gray-600";
    if (score >= 25) return "text-orange-600";
    if (score >= 0) return "text-green-600";
    return "text-red-600";
  };

  if (!userData?.uid) return null;

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <Button
        variant="ghost"
        size="sm"
        className="relative text-muted-foreground hover:text-foreground"
        onClick={() => setIsOpen(!isOpen)}
        data-notification-button
      >
        <Bell className="h-4 w-4 mr-2" />
        Notifications
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs bg-primary text-primary-foreground">
            {unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notification Panel */}
      {isOpen && (
        <div 
          className="absolute right-0 top-12 w-96 bg-card border border-border rounded-lg z-50"
          data-notification-panel
        >
          <Card className="border-0 shadow-none bg-transparent">
            <CardHeader className="pb-4 border-b border-border bg-muted/30 rounded-t-lg">
              <div className="flex items-center justify-between mb-3">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  Notifications
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="hover:bg-muted rounded-md p-2 text-muted-foreground"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              
              {/* Notification Count */}
              <div className={`flex items-center justify-between p-3 rounded-lg border ${
                unreadCount > 0 
                  ? 'bg-primary/10 border-primary/30' 
                  : 'bg-muted/50 border-border'
              }`}>
                <span className="text-sm font-medium text-foreground">Notifications</span>
                <div className="flex items-center space-x-3">
                  <Badge 
                    variant={unreadCount > 0 ? "default" : "secondary"} 
                    className="text-xs font-medium px-2 py-1 whitespace-nowrap"
                  >
                    {unreadCount > 0 ? `${unreadCount} unread` : 'All read'}
                  </Badge>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs font-medium text-primary hover:bg-muted rounded-md"
                      onClick={handleMarkAllAsRead}
                    >
                      Mark All Read
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 bg-card">
              <ScrollArea className="h-80">
                {notifications.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Bell className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium text-foreground">No notifications yet</p>
                    <p className="text-xs text-muted-foreground mt-1">You're all caught up!</p>
                  </div>
                ) : (
                  <div className="space-y-2 p-3">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-3 rounded-lg border transition-colors ${
                          notification.isRead 
                            ? 'bg-muted/30 border-border' 
                            : 'bg-primary/5 border-primary/20'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-1">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-sm font-medium mb-1 ${
                              notification.isRead 
                                ? 'text-muted-foreground' 
                                : 'text-foreground'
                            }`}>
                              {stripEmojis(notification.title)}
                            </h4>
                            <p className="text-xs leading-relaxed mb-2 text-muted-foreground">
                              {stripEmojis(notification.message)}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {notification.createdAt?.toDate().toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              {!notification.isRead && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs font-medium text-primary hover:bg-muted rounded-md"
                                  onClick={() => notification.id && handleMarkAsRead(notification.id)}
                                >
                                  Mark Read
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
