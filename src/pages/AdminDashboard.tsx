import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Filter, MapPin, AlertTriangle, CheckCircle, XCircle, Clock, Users, Phone, Globe, Star, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAllIncidents, updateIncidentStatus, Incident, getRecommendedUsers, UserProfile } from "@/lib/firebase-services";
import { ProfilePopup } from "@/components/ProfilePopup";
import { findRealEmergencyServices, EmergencyService, getEmergencyContacts, generateLocalEmergencyServices } from "@/lib/emergency-services";
import { useAuth } from "@/contexts/AuthContext";
import {
  SEVERITY_SCALE,
  getSeverityBadgeClass,
  getIncidentSeverity,
  formatSeverity,
} from "@/lib/severity";

// Using the Incident interface from Firebase services
type Report = Incident;

const AdminDashboard = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [recommendedUsers, setRecommendedUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [showAuthoritiesModal, setShowAuthoritiesModal] = useState(false);
  const [currentAuthorities, setCurrentAuthorities] = useState<EmergencyService[]>([]);
  const [currentIncident, setCurrentIncident] = useState<Report | null>(null);
  const { toast } = useToast();
  const { userData } = useAuth();
  const navigate = useNavigate();

  // Load incidents and recommended users from Firebase
  useEffect(() => {
    const loadData = async () => {
      try {
        const [allIncidents, recommended] = await Promise.all([
          getAllIncidents(),
          getRecommendedUsers()
        ]);
        setReports(allIncidents);
        setRecommendedUsers(recommended);
      } catch (error) {
        console.error('Error loading data:', error);
        toast({
          title: "Error Loading Data",
          description: "Failed to load data. Please refresh the page.",
          variant: "destructive"
        });
      }
    };

    loadData();
  }, [toast]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="h-4 w-4" />;
      case "in-progress": return <Clock className="h-4 w-4 text-blue-500" />;
      case "resolved": return <CheckCircle className="h-4 w-4" />;
      case "rejected": return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // Emergency services integration using local database
  const findNearestAuthorities = async (issueType: string, location: { lat: number, lng: number }, severity: number) => {
    try {
      console.log('Finding nearest authorities using local database...');
      
      // Get emergency services from local database
      const realServices = await findRealEmergencyServices(location, issueType, severity);
      
      if (realServices.length > 0) {
        console.log(`Found ${realServices.length} services from local database`);
        return realServices;
      }
      
      // Final fallback: Get emergency contacts for the region
      const emergencyContacts = getEmergencyContacts('india');
      console.log('Using emergency contacts as final fallback:', emergencyContacts);
      
      // Return basic emergency contacts if no specific services found
      return Object.entries(emergencyContacts).map(([service, number], index) => ({
        id: `emergency_${index}`,
        name: service,
        type: 'other' as const,
        category: 'Emergency Contact',
        phone: number,
        emergencyPhone: number,
        address: 'National Emergency Number',
        location: { lat: 0, lng: 0 },
        distance: 0,
        responseTime: 5,
        isAvailable: true,
        rating: 5,
        openNow: true
      }));
      
    } catch (error) {
      console.error('Error finding real emergency services:', error);
      return [];
    }
  };

  const handleStatusChange = async (reportId: string, newStatus: "pending" | "in-progress" | "resolved" | "rejected") => {
    try {
      // Update in Firebase
      await updateIncidentStatus(reportId, newStatus, undefined, userData?.uid);
      
      // Update local state
      setReports(prev => prev.map(report => 
        report.id === reportId ? { ...report, status: newStatus } : report
      ));
      
      toast({
        title: "Status Updated",
        description: `Report ${reportId} has been ${newStatus}.`,
      });




    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update report status. Please try again.",
        variant: "destructive"
      });
    }
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (report.location.address && report.location.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (report.userName && report.userName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesSeverity =
      severityFilter === "all" ||
      getIncidentSeverity(report).toString() === severityFilter;
    const matchesStatus = statusFilter === "all" || report.status === statusFilter;
    
    // Priority filtering
    let matchesPriority = true;
    if (priorityFilter === "elite") {
      matchesPriority = report.userBadge === '🏆 Elite Citizen';
    } else if (priorityFilter === "gold") {
      matchesPriority = report.userBadge === '🏆 Elite Citizen' || report.userBadge === '⭐ Gold Citizen';
    } else if (priorityFilter === "high") {
      matchesPriority = report.userBadge === '🏆 Elite Citizen' || report.userBadge === '⭐ Gold Citizen' || 
                       getIncidentSeverity(report) >= 4;
    }
    
    return matchesSearch && matchesSeverity && matchesStatus && matchesPriority;
  }).sort((a, b) => {
    // Priority sorting: Elite citizens first, then by severity, then by date
    const getPriorityScore = (report: Report) => {
      let score = 0;
      
      // Elite citizens get highest priority
      if (report.userBadge === '🏆 Elite Citizen') score += 1000;
      else if (report.userBadge === '⭐ Gold Citizen') score += 500;
      else if (report.userBadge === '🥉 Silver Citizen') score += 200;
      else if (report.userBadge === '🥉 Bronze Citizen') score += 100;
      else if (report.userBadge === '👤 New Citizen') score += 50;
              else if (report.userBadge === '🚫 Suspended Citizen') score += 0;
      
      // Add severity bonus (higher severity = higher priority)
      score += getIncidentSeverity(report) * 10;
      
      // Add recency bonus (newer reports get slight priority)
      const daysOld = report.createdAt ? (Date.now() - report.createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24) : 0;
      score += Math.max(0, 30 - daysOld); // Reports older than 30 days get no bonus
      
      return score;
    };
    
    return getPriorityScore(b) - getPriorityScore(a); // Sort descending (highest priority first)
  });

  const stats = {
    total: reports.length,
    pending: reports.filter(r => r.status === "pending").length,
    highSeverity: reports.filter((r) => getIncidentSeverity(r) >= 4).length,
    resolved: reports.filter(r => r.status === "resolved").length,
    eliteReports: reports.filter(r => r.userBadge === '🏆 Elite Citizen').length
  };



  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="backdrop-city border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-city rounded-lg flex items-center justify-center">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gradient">CityWatch Admin</h1>
          </div>
          <div className="flex items-center space-x-4">
            {/* Welcome Message */}
            <div className="text-sm text-muted-foreground">
              Welcome, Admin <span className="text-foreground font-medium">{userData?.displayName || 'User'}</span>
            </div>
            
            <ProfilePopup incidents={reports}>
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

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="card-city">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Total Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.total}</div>
            </CardContent>
          </Card>

          <Card className="card-city">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <Clock className="h-4 w-4 mr-2" />
                Pending Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.pending}</div>
            </CardContent>
          </Card>

          <Card className="card-city">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                High Priority
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.highSeverity}</div>
            </CardContent>
          </Card>

          <Card className="card-city">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <CheckCircle className="h-4 w-4 mr-2" />
                Resolved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.resolved}</div>
            </CardContent>
          </Card>
          
          <Card className="card-city">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Elite Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.eliteReports}</div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Management Section */}
        <Card className="card-city relative">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-primary" />
              <span>Admin Management</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Create New Admin</h4>
                  <p className="text-sm text-muted-foreground">
                    Only existing administrators can create new admin accounts
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => navigate("/signup?admin=true")}
                  className="relative z-10"
                >
                  <Shield className="h-4 w-4" />
                  Create Admin
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recommended Users Section */}
        {recommendedUsers.length > 0 && (
          <Card className="card-city">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-primary" />
                <span>Recommended Users</span>
                <Badge variant="secondary" className="ml-2">
                  {recommendedUsers.length} users
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendedUsers.map((user) => (
                  <div
                    key={user.uid}
                    className="p-4 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-foreground">{user.displayName}</h4>
                      <Badge variant="outline" className="text-xs">
                        {user.badge}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>Score: <span className="font-medium text-foreground">{user.score}</span></p>
                      <p>Reports: {user.totalReports}</p>
                      <p>Accepted: {user.acceptedReports}</p>
                      <p>Rejected: {user.rejectedReports}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reports Table */}
        <Card className="card-city">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Issue Reports</span>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search reports..." 
                    className="pl-10 w-64 bg-muted/50 border-border/50"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-32 bg-muted/50 border-border/50">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    {SEVERITY_SCALE.map(({ level, label }) => (
                      <SelectItem key={level} value={String(level)}>
                        Level {level} — {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32 bg-muted/50 border-border/50">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-36 bg-muted/50 border-border/50">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="elite">🏆 Elite Only</SelectItem>
                    <SelectItem value="gold">⭐ Gold+ Only</SelectItem>
                    <SelectItem value="high">High Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow key={report.id} className="hover:bg-muted/50">
                    <TableCell className="whitespace-nowrap">
                      {report.userBadge === '🏆 Elite Citizen' ? (
                        <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-yellow-900 text-xs px-2 py-1 font-bold">
                          🏆 HIGH
                        </Badge>
                      ) : report.userBadge === '⭐ Gold Citizen' ? (
                        <Badge className="bg-gradient-to-r from-yellow-500 to-yellow-700 text-white text-xs px-2 py-1">
                          ⭐ MEDIUM
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs px-2 py-1 text-muted-foreground">
                          📋 NORMAL
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{report.id?.substring(0, 8)}...</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{report.description}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="outline" className="text-xs px-2 py-1">
                        {report.aiAnalysis?.category || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge className={`${getSeverityBadgeClass(getIncidentSeverity(report))} text-white text-xs px-2 py-1 min-w-[2rem] justify-center`}>
                        {getIncidentSeverity(report)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {report.location.address || `${report.location.lat.toFixed(3)}, ${report.location.lng.toFixed(3)}`}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {report.createdAt?.toDate().toLocaleDateString('en-GB') || 'N/A'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(report.status || 'pending')}
                        <span className="capitalize text-xs">{report.status || 'pending'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap max-w-[100px] truncate">
                      {report.userName || 'Anonymous'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex space-x-1">
                        {report.status === "pending" && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="h-7 px-2 text-xs bg-success/20 border-success/50 text-success hover:bg-success/30"
                              onClick={async () => {
                                try {
                                  // Show authorities modal without changing status yet
                                  const authorities = await findNearestAuthorities(
                                    report.aiAnalysis?.category || 'Other',
                                    report.location,
                                    report.aiAnalysis?.severity || 1
                                  );
                                  
                                  if (authorities.length > 0) {
                                    setCurrentAuthorities(authorities);
                                    setCurrentIncident(report);
                                    setShowAuthoritiesModal(true);
                                    
                                    // Show authorities found toast
                                    const authorityList = authorities.slice(0, 3).map(auth => 
                                      `${auth.name} (${auth.distance}km away)`
                                    ).join(', ');
                                    
                                    toast({
                                      title: "🚨 Authorities Found",
                                      description: `Nearest authorities: ${authorityList}. Response time: ${authorities[0].responseTime} minutes.`,
                                      duration: 8000,
                                    });

                                    // For high severity incidents, show detailed authority information
                                    if (report.aiAnalysis?.severity && report.aiAnalysis.severity >= 4) {
                                      setTimeout(() => {
                                        toast({
                                          title: "📞 Emergency Contact Details",
                                          description: `Primary: ${authorities[0].name} - ${authorities[0].phone}. Backup: ${authorities[1]?.name} - ${authorities[1]?.phone}`,
                                          duration: 10000,
                                        });
                                      }, 2000);
                                    }
                                  } else {
                                    // Show fallback message if no authorities found
                                    toast({
                                      title: "⚠️ No Authorities Found",
                                      description: "Using emergency contact numbers as fallback.",
                                      variant: "destructive"
                                    });
                                    
                                    // Still show modal with emergency contacts
                                    const emergencyContacts = getEmergencyContacts('india');
                                    const fallbackAuthorities = Object.entries(emergencyContacts).map(([service, number], index) => ({
                                      id: `emergency_${index}`,
                                      name: service,
                                      type: 'other' as const,
                                      category: 'Emergency Contact',
                                      phone: number,
                                      emergencyPhone: number,
                                      address: 'National Emergency Number',
                                      location: { lat: 0, lng: 0 },
                                      distance: 0,
                                      responseTime: 5,
                                      isAvailable: true,
                                      rating: 5,
                                      openNow: true
                                    }));
                                    
                                    setCurrentAuthorities(fallbackAuthorities);
                                    setCurrentIncident(report);
                                    setShowAuthoritiesModal(true);
                                  }
                                } catch (error) {
                                  console.error('Error finding authorities:', error);
                                  toast({
                                    title: "❌ Error Finding Authorities",
                                    description: "Using emergency contacts as fallback. Please try again.",
                                    variant: "destructive"
                                  });
                                  
                                  // Show emergency contacts as fallback
                                  const emergencyContacts = getEmergencyContacts('india');
                                  const fallbackAuthorities = Object.entries(emergencyContacts).map(([service, number], index) => ({
                                    id: `emergency_${index}`,
                                    name: service,
                                    type: 'other' as const,
                                    category: 'Emergency Contact',
                                    phone: number,
                                      emergencyPhone: number,
                                      address: 'National Emergency Number',
                                      location: { lat: 0, lng: 0 },
                                      distance: 0,
                                      responseTime: 5,
                                      isAvailable: true,
                                      rating: 5,
                                      openNow: true
                                  }));
                                  
                                  setCurrentAuthorities(fallbackAuthorities);
                                  setCurrentIncident(report);
                                  setShowAuthoritiesModal(true);
                                }
                              }}
                            >
                              Start Work
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="h-7 px-2 text-xs bg-destructive/20 border-destructive/50 text-destructive hover:bg-destructive/30"
                              onClick={() => handleStatusChange(report.id, "rejected")}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {report.status === "in-progress" && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-7 px-2 text-xs bg-primary/20 border-primary/50 text-primary hover:bg-primary/30"
                            onClick={() => handleStatusChange(report.id, "resolved")}
                          >
                            Mark Resolved
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      {/* Authorities Modal */}
      {showAuthoritiesModal && currentIncident && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto border border-slate-600">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">
                🚨 Authorities Found for Incident
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAuthoritiesModal(false)}
                className="text-slate-400 hover:text-white hover:bg-slate-700"
              >
                ✕
              </Button>
            </div>

            {/* Emergency Contacts Quick Reference */}
            <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-red-300 mb-2 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Emergency Numbers (India)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="text-center">
                  <div className="text-red-400 font-medium">Police</div>
                  <div className="text-white font-bold">100</div>
                </div>
                <div className="text-center">
                  <div className="text-red-400 font-medium">Fire</div>
                  <div className="text-white font-bold">101</div>
                </div>
                <div className="text-center">
                  <div className="text-red-400 font-medium">Ambulance</div>
                  <div className="text-white font-bold">102</div>
                </div>
                <div className="text-center">
                  <div className="text-red-400 font-medium">Women Helpline</div>
                  <div className="text-white font-bold">1091</div>
                </div>
              </div>
            </div>

            {/* Incident Details */}
            <div className="bg-slate-700 rounded-lg p-4 mb-4 border border-slate-600">
              <h3 className="font-semibold text-white mb-2">
                Incident: {currentIncident.description}
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">Category:</span>
                  <span className="ml-2 font-medium text-white">
                    {currentIncident.aiAnalysis?.category}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Severity:</span>
                  <span className="ml-2 font-medium text-white">
                    {formatSeverity(getIncidentSeverity(currentIncident))}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Location:</span>
                  <span className="ml-2 font-medium text-white">
                    {currentIncident.location.address || `${currentIncident.location.lat.toFixed(4)}, ${currentIncident.location.lng.toFixed(4)}`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Status:</span>
                  <span className="ml-2 font-medium text-white capitalize">
                    {currentIncident.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Authorities List */}
            <div className="space-y-3">
              <h3 className="font-semibold text-white">
                Nearest Available Authorities
              </h3>
              {currentAuthorities.map((authority, index) => (
                <div key={authority.id || index} className="border border-slate-600 rounded-lg p-4 bg-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium text-white">
                        {authority.name}
                      </h4>
                      {authority.rating && (
                        <div className="flex items-center space-x-1">
                          <Star className="h-3 w-3 text-yellow-400 fill-current" />
                          <span className="text-xs text-yellow-400">{authority.rating}</span>
                        </div>
                      )}
                    </div>
                    <Badge className={`${
                      index === 0 ? 'bg-green-900/30 text-green-300 border-green-600' : 
                      index === 1 ? 'bg-blue-900/30 text-blue-300 border-blue-600' : 
                      'bg-slate-900/30 text-slate-300 border-slate-600'
                    }`}>
                      {index === 0 ? 'Primary' : index === 1 ? 'Secondary' : 'Backup'}
                    </Badge>
                  </div>
                  
                  {/* Service Type Badge */}
                  <div className="mb-3">
                    <Badge variant="outline" className="text-xs border-slate-500 text-slate-300">
                      {authority.category}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      <div>
                        <span className="text-slate-400 text-xs">Distance:</span>
                        <div className="font-medium text-white">
                          {authority.distance > 0 ? `${authority.distance} km` : 'National Service'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <div>
                        <span className="text-slate-400 text-xs">Response:</span>
                        <div className="font-medium text-white">
                          {authority.responseTime} min
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Contact Information */}
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center space-x-2">
                      <Phone className="h-3 w-3 text-slate-400" />
                      <div>
                        <span className="text-slate-400 text-xs">Phone:</span>
                        <div className="font-medium text-white">
                          {authority.phone}
                        </div>
                      </div>
                    </div>
                    {authority.emergencyPhone && (
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="h-3 w-3 text-red-400" />
                        <div>
                          <span className="text-red-400 text-xs">Emergency:</span>
                          <div className="font-medium text-red-300">
                            {authority.emergencyPhone}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-3 w-3 text-slate-400 mt-0.5" />
                      <div>
                        <span className="text-slate-400 text-xs">Address:</span>
                        <div className="font-medium text-white text-xs leading-tight">
                          {authority.address}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Info */}
                  {authority.website && (
                    <div className="flex items-center space-x-2 mb-3 text-xs">
                      <Globe className="h-3 w-3 text-slate-400" />
                      <a 
                        href={authority.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline"
                      >
                        Visit Website
                      </a>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs flex-1"
                      onClick={() => {
                        // In real implementation, this would initiate a call or send notification
                        toast({
                          title: "📞 Contacting Authority",
                          description: `Initiating contact with ${authority.name}...`,
                        });
                      }}
                    >
                      <Phone className="h-3 w-3 mr-1" />
                      Contact Now
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-slate-600 text-slate-300 hover:bg-slate-600 hover:text-white"
                      onClick={() => {
                        // Copy contact details to clipboard
                        const contactInfo = authority.emergencyPhone 
                          ? `${authority.name}: ${authority.phone} (Emergency: ${authority.emergencyPhone})`
                          : `${authority.name}: ${authority.phone}`;
                        navigator.clipboard.writeText(contactInfo);
                        toast({
                          title: "📋 Contact Details Copied",
                          description: "Contact information copied to clipboard",
                        });
                      }}
                    >
                      📋 Copy Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-slate-600">
              <Button
                variant="outline"
                onClick={() => setShowAuthoritiesModal(false)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
              >
                Close
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={async () => {
                  if (currentIncident) {
                    try {
                      // Now actually update the status to "in-progress"
                      await updateIncidentStatus(currentIncident.id!, "in-progress", undefined, userData?.uid);
                      
                      // Update local state
                      setReports(prev => prev.map(report => 
                        report.id === currentIncident.id ? { ...report, status: "in-progress" } : report
                      ));
                      
                      // Close modal
                      setShowAuthoritiesModal(false);
                      
                      // Show success toast
                      toast({
                        title: "✅ Work Started",
                        description: "Incident marked as in-progress. Authorities have been notified.",
                      });
                    } catch (error) {
                      console.error('Error updating status:', error);
                      toast({
                        title: "Update Failed",
                        description: "Failed to update report status. Please try again.",
                        variant: "destructive"
                      });
                    }
                  }
                }}
              >
                Start Working on Incident
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;