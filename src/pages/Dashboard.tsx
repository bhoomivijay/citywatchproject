import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, MapPin, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ReportIssueModal } from "@/components/ReportIssueModal";
import { useAuth } from "@/contexts/AuthContext";

import { MapView } from "@/components/MapView";
import { IncidentsList } from "@/components/IncidentsList";
import { NotificationBell } from "@/components/NotificationBell";
import { ProfilePopup } from "@/components/ProfilePopup";
import { getUserIncidents, Incident } from "@/lib/firebase-services";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

const Dashboard = () => {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number} | null>(null);
  const [currentCity, setCurrentCity] = useState<string>("Detecting location...");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [hasError, setHasError] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userData } = useAuth();

  // Error boundary effect
  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.log('Dashboard caught error:', error);
      setHasError(true);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  // Test Firestore connection
  useEffect(() => {
    const testFirestore = async () => {
      try {
        const testDoc = await getDocs(collection(db, 'incidents'));
        console.log('Firestore connection test successful');
      } catch (error: any) {
        console.log('Firestore connection test failed:', error.message);
        if (error.message.includes('permission-denied')) {
          toast({
            title: "Database Access Error",
            description: "You don't have permission to access the database. Please check your account status.",
            variant: "destructive"
          });
        }
      }
    };
    
    if (userData?.uid) {
      testFirestore();
    }
  }, [userData?.uid]); // Remove toast from dependencies



  // Load incidents from Firebase
  useEffect(() => {
    const loadIncidents = async () => {
      try {
        if (userData?.uid) {
          try {
            const userIncidents = await getUserIncidents(userData.uid);
            setIncidents(userIncidents);
          } catch (error: any) {
            console.log('Error loading incidents with ordering:', error.message);
            // If index error, try to load without ordering
            try {
              const simpleQuery = query(
                collection(db, 'incidents'),
                where('userId', '==', userData.uid)
              );
              const snapshot = await getDocs(simpleQuery);
              const simpleIncidents = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as Incident[];
              setIncidents(simpleIncidents);
            } catch (simpleError: any) {
              console.log('Error loading incidents without ordering:', simpleError.message);
              setIncidents([]);
            }
          }
        }
      } catch (error: any) {
        console.log('General error loading incidents:', error.message);
        toast({
          title: "Error Loading Incidents",
          description: "Failed to load your incident reports. Please refresh the page.",
          variant: "destructive"
        });
      }
    };

    if (userData?.uid) {
      loadIncidents();
      
      // Set up real-time listener for new incidents
      try {
        const incidentsRef = collection(db, 'incidents');
        const userIncidentsQuery = query(
          incidentsRef,
          where('userId', '==', userData.uid)
        );
        
        const unsubscribe = onSnapshot(userIncidentsQuery, (snapshot) => {
          const updatedIncidents = snapshot.docs.map(doc => {
            const incidentData = doc.data();
            
            // USE ONLY TOP-LEVEL SEVERITY - IGNORE NESTED FIELD TO AVOID TRANSFORMATIONS
            const topLevelSeverity = incidentData.severity;
            const aiAnalysisSeverity = incidentData.aiAnalysis?.severity;
            
            // ALWAYS use top-level severity if available, never fall back to nested field
            const finalSeverity = topLevelSeverity !== undefined ? topLevelSeverity : aiAnalysisSeverity;
            
            return {
              id: doc.id,
              ...incidentData,
              // FORCE TOP-LEVEL SEVERITY - NO NESTED FIELD OVERRIDES
              severity: finalSeverity,
              aiAnalysis: {
                ...incidentData.aiAnalysis,
                // USE TOP-LEVEL SEVERITY IN NESTED FIELD TOO
                severity: finalSeverity
              }
            } as any; // Use 'any' to bypass interface restrictions
          });
          
          console.log('Dashboard: Real-time update received:', updatedIncidents.length, 'incidents');
          console.log('Dashboard: First incident severity:', updatedIncidents[0]?.aiAnalysis?.severity);
          console.log('Dashboard: First incident top-level severity:', updatedIncidents[0]?.severity);
          
          setIncidents(updatedIncidents);
        }, (error) => {
          console.log('Real-time listener error:', error);
          // Silent error handling for real-time updates
        });
        
        return unsubscribe;
      } catch (listenerError: any) {
        console.log('Error setting up real-time listener:', listenerError.message);
      }
    } else {
      console.log('Dashboard: No user UID, skipping incident load');
    }
  }, [userData?.uid]); // Remove toast from dependencies



  const handleLocationSelect = useCallback((location: { lat: number; lng: number }) => {
    setSelectedLocation(location);
  }, []);

  const handleLocationChange = useCallback((location: { lat: number; lng: number; city?: string }) => {
    if (location.city) {
      setCurrentCity(location.city);
    }
  }, []);

  const handleOpenReportModal = () => {
    setIsReportModalOpen(true);
  };

  const handleTrackReport = () => {
    navigate("/track");
  };











  // Show error state if component crashed
  if (hasError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground mb-4">Something went wrong</h1>
          <p className="text-muted-foreground mb-4">The dashboard encountered an error. Please refresh the page.</p>
          <Button onClick={() => window.location.reload()}>Refresh Page</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="backdrop-city border-b border-border/50 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <MapPin className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-gradient">CityWatch</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Welcome Message */}
            <div className="text-sm text-muted-foreground">
              Welcome, <span className="text-foreground font-medium">{userData?.displayName || 'User'}</span>
            </div>
            
            <NotificationBell />
            <ProfilePopup incidents={incidents}>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-foreground"
              >
                Profile
              </Button>
            </ProfilePopup>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[600px]">
          {/* Stats Cards */}
          <div className="lg:col-span-1 flex flex-col h-full">
            <Card className="card-city mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{incidents.filter(inc => inc.status === 'pending' || inc.status === 'approved').length}</div>
                <p className="text-xs text-muted-foreground">Live from Firebase</p>
              </CardContent>
            </Card>

            <Card className="card-city mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-foreground">{incidents.length}</div>
                <p className="text-xs text-muted-foreground">All time incidents</p>
              </CardContent>
            </Card>

            <Card className="card-city mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">High Priority</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-primary">{incidents.filter(inc => inc.aiAnalysis?.severity && inc.aiAnalysis.severity >= 4).length}</div>
                <p className="text-xs text-muted-foreground">Severity 4-5</p>
              </CardContent>
            </Card>



            {/* Quick Actions */}
            <Card className="card-city relative z-20 flex-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 relative z-30 pb-8">
                <Button 
                  className="btn-city w-full justify-start" 
                  onClick={handleOpenReportModal}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Report Issue
                </Button>
                <Button 
                  className="btn-city w-full justify-start"
                  onClick={handleTrackReport}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Track Report
                </Button>
                

              </CardContent>
            </Card>


          </div>

          {/* Map View */}
          <div className="lg:col-span-2">
            <Card className="card-city h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <span>City Map - {currentCity} Region</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    (Detected: {currentCity})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 min-h-[500px]">
                <MapView 
                  onLocationSelect={handleLocationSelect} 
                  onLocationChange={handleLocationChange}
                  incidents={incidents} 
                />
              </CardContent>
            </Card>
          </div>

          {/* Incidents List */}
          <div className="lg:col-span-1">
            <IncidentsList 
              incidents={incidents} 
            />
          </div>
        </div>
      </main>

      {/* Floating Action Button */}
      <Button
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full btn-city z-50"
        onClick={handleOpenReportModal}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Report Issue Modal */}
      <ReportIssueModal 
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        selectedLocation={selectedLocation}
        onLocationSelect={handleLocationSelect}
        onIncidentAdded={(incidentId: string) => {
          console.log('Dashboard: Incident added with ID:', incidentId);
          // The modal will close automatically after this callback
        }}
      />


    </div>
  );
};

export default Dashboard;