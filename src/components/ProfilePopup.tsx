import React, { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Trophy, FileText, CheckCircle, XCircle, Clock, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getUserProfile, UserProfile, getBadgeFromScore, CITIZEN_BADGES, normalizeBadgeLabel } from "@/lib/firebase-services";

interface ProfilePopupProps {
  children: React.ReactNode;
  incidents?: any[]; // Add incidents prop
}

export const ProfilePopup: React.FC<ProfilePopupProps> = ({ children, incidents = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const { userData, signOut } = useAuth();
  const { toast } = useToast();

  // Fetch user profile when opened / user changes so badge matches latest score
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (userData?.uid && isOpen) {
        try {
          const profile = await getUserProfile(userData.uid);
          setUserProfile(profile);
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      }
    };

    fetchUserProfile();
  }, [userData?.uid, isOpen]);

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

  const getCurrentBadge = (profile: UserProfile) => {
    if (profile.role === 'admin') {
      return 'Administrator';
    }

    // Always derive from score so UI matches thresholds (100 → Elite, 75 → Gold, etc.)
    return normalizeBadgeLabel(getBadgeFromScore(Number(profile.score || 0)).badge);
  };

  if (!userData) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Card className="border border-border">
          <CardHeader className="pb-3 border-b border-border bg-muted/30">
            <CardTitle className="flex items-center space-x-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              <span>User Profile</span>
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* User Info */}
            <div className="text-center pb-3 border-b border-border/50">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl text-primary-foreground font-semibold">
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
                  {userProfile ? getCurrentBadge(userProfile) : 'Loading...'}
                </Badge>
              </div>
              
              {/* Only show score for non-admin users */}
              {userProfile && userProfile.role !== 'admin' && (
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">Score</span>
                  </div>
                  <span className="font-semibold text-lg text-primary">
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
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-lg font-semibold text-foreground">{incidents.length}</div>
                  <div className="text-xs text-muted-foreground">
                    {userProfile?.role === 'admin' ? 'All Reports' : 'Total'}
                  </div>
                </div>
                
                <div className="text-center p-2 bg-muted/20 rounded">
                  <div className="flex items-center justify-center mb-1">
                    <CheckCircle className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-lg font-semibold text-foreground">{incidents.filter(inc => inc.status === 'resolved').length}</div>
                  <div className="text-xs text-muted-foreground">
                    {userProfile?.role === 'admin' ? 'Resolved' : 'Accepted'}
                  </div>
                </div>
                
                <div className="text-center p-2 bg-muted/20 rounded">
                  <div className="flex items-center justify-center mb-1">
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-lg font-semibold text-foreground">{incidents.filter(inc => inc.status === 'rejected').length}</div>
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
                  ? 'bg-destructive/10 border-destructive/30' 
                  : 'bg-muted/50 border-border'
              }`}>
                <div className="flex items-center space-x-2">
                  <div>
                    <p className={`text-sm font-medium ${
                      userProfile.score < -80 ? 'text-destructive' : 'text-foreground'
                    }`}>
                      {userProfile.score < -80 ? 'Account Suspended' : 'Warning Zone'}
                    </p>
                    <p className="text-xs text-muted-foreground">
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
              className="w-full border-border text-muted-foreground hover:bg-muted hover:text-foreground"
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
