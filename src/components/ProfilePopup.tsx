import React, { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Trophy, FileText, CheckCircle, XCircle, Clock, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getUserProfile, UserProfile } from "@/lib/firebase-services";

interface ProfilePopupProps {
  children: React.ReactNode;
  incidents?: any[]; // Add incidents prop
}

export const ProfilePopup: React.FC<ProfilePopupProps> = ({ children, incidents = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const { userData, signOut } = useAuth();
  const { toast } = useToast();

  // Fetch user profile when component mounts or userData changes
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (userData?.uid) {
        try {
          const profile = await getUserProfile(userData.uid);
          setUserProfile(profile);
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      }
    };

    fetchUserProfile();
  }, [userData?.uid]);

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
      setIsOpen(false);
    } catch (error) {
      toast({
        title: "Logout Failed",
        description: "There was an error logging out. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getCurrentBadge = (role: string) => {
    // Admin users get special badges
    if (role === 'admin') {
      return '👑 Administrator';
    }
    
    // For citizens, we'll show a simple status
    return '👤 Citizen';
  };

  if (!userData) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3 bg-gradient-to-r from-primary/10 to-secondary/10">
            <CardTitle className="flex items-center space-x-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              <span>User Profile</span>
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* User Info */}
            <div className="text-center pb-3 border-b border-border/50">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl text-white font-bold">
                  {userData.displayName?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <h3 className="font-semibold text-lg">{userData.displayName || 'User'}</h3>
              <p className="text-sm text-muted-foreground">{userData.email}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {userData.role === 'admin' ? 'Administrator' : 'Citizen'}
              </p>
            </div>

            {/* Badge & Score */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Badge</span>
                </div>
                                <Badge variant="outline" className="text-xs">
                  {userProfile ? getCurrentBadge(userProfile.role) : 'Loading...'}
                </Badge>
              </div>
              
              {/* Only show score for non-admin users */}
              {userProfile && userProfile.role !== 'admin' && (
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">📊</span>
                    <span className="text-sm font-medium">Score</span>
                  </div>
                  <span className="font-bold text-lg text-blue-600">
                    {userProfile.score} points
                  </span>
                </div>
              )}
            </div>

            {/* Reports Statistics */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                {userProfile?.role === 'admin' ? 'System Overview' : 'Reports Statistics'}
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-muted/20 rounded">
                  <div className="flex items-center justify-center mb-1">
                    <FileText className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="text-lg font-bold text-blue-500">{incidents.length}</div>
                  <div className="text-xs text-muted-foreground">
                    {userProfile?.role === 'admin' ? 'All Reports' : 'Total'}
                  </div>
                </div>
                
                <div className="text-center p-2 bg-muted/20 rounded">
                  <div className="flex items-center justify-center mb-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="text-lg font-bold text-green-500">{incidents.filter(inc => inc.status === 'resolved').length}</div>
                  <div className="text-xs text-muted-foreground">
                    {userProfile?.role === 'admin' ? 'Resolved' : 'Accepted'}
                  </div>
                </div>
                
                <div className="text-center p-2 bg-muted/20 rounded">
                  <div className="flex items-center justify-center mb-1">
                    <XCircle className="h-4 w-4 text-red-500" />
                  </div>
                  <div className="text-lg font-bold text-red-500">{incidents.filter(inc => inc.status === 'rejected').length}</div>
                  <div className="text-xs text-muted-foreground">
                    {userProfile?.role === 'admin' ? 'Rejected' : 'Rejected'}
                  </div>
                </div>
              </div>
            </div>

            {/* Account Status - Only for non-admin users */}
            {userProfile && userProfile.role !== 'admin' && userProfile.score < 0 && (
              <div className={`p-3 rounded-lg border ${
                userProfile.score < -80 
                  ? 'bg-red-500/10 border-red-500/20' 
                  : 'bg-yellow-500/10 border-yellow-500/20'
              }`}>
                <div className="flex items-center space-x-2">
                  <span className="text-lg">
                    {userProfile.score < -80 ? '🚫' : '⚠️'}
                  </span>
                  <div>
                    <p className={`text-sm font-medium ${
                      userProfile.score < -80 ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {userProfile.score < -80 ? 'Account Suspended' : 'Warning Zone'}
                    </p>
                    <p className={`text-xs ${
                      userProfile.score < -80 ? 'text-red-500' : 'text-yellow-500'
                    }`}>
                      {userProfile.score < -80 
                        ? 'Score below -80. Cannot submit reports.'
                        : 'Negative score. Improve to avoid suspension.'
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Logout Button */}
            <Button 
              onClick={handleLogout}
              variant="outline" 
              className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
};
