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
import { getAllIncidents, updateIncidentStatus, Incident, getRecommendedUsers, UserProfile, saveAgentDispatchResult, CITIZEN_BADGES, normalizeBadgeLabel } from "@/lib/firebase-services";
import { ProfilePopup } from "@/components/ProfilePopup";
import { findRealEmergencyServices, EmergencyService, getEmergencyContacts, generateLocalEmergencyServices } from "@/lib/emergency-services";
import { useAuth } from "@/contexts/AuthContext";
import {
  SEVERITY_SCALE,
  getSeverityBadgeClass,
  getIncidentSeverity,
  formatSeverity,
} from "@/lib/severity";
import { resolveNearLocationLabel } from "@/lib/location-label";
import { runAgenticAutoDispatch, shouldAutoEscalate } from "@/lib/agent-dispatch";

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
  const [locationLabels, setLocationLabels] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { userData } = useAuth();
  const navigate = useNavigate();

  // Load incidents and recommended users from Firebase
  useEffect(() => {
    const loadData = async () => {
      try {
        const [allIncidentsRaw, recommended] = await Promise.all([
          getAllIncidents(),
          getRecommendedUsers()
        ]);

        // Merge recommended-user scores when incident join is incomplete
        const scoreByUserId = new Map(
          recommended
            .filter((user) => user.id)
            .map((user) => [user.id!, Number(user.score || 0)])
        );
        const allIncidents = allIncidentsRaw.map((incident) => {
          const fallbackScore = scoreByUserId.get(incident.userId);
          const score = Number(
            incident.userScore && incident.userScore > 0
              ? incident.userScore
              : fallbackScore ?? incident.userScore ?? 0
          );
          return {
            ...incident,
            userScore: score,
            userBadge:
              score >= 100
                ? CITIZEN_BADGES.ELITE
                : score >= 75
                  ? CITIZEN_BADGES.GOLD
                  : incident.userBadge,
          };
        });

        // Backfill: Elite (score >= 100) + severity 5 pending reports that missed auto-dispatch
        const eligible = allIncidents.filter(
          (incident) =>
            !incident.agentDispatch?.triggered &&
            incident.status === 'pending' &&
            shouldAutoEscalate(incident.userScore, getIncidentSeverity(incident))
        );

        console.log(
          'AdminDashboard: auto-dispatch candidates',
          eligible.map((i) => ({
            id: i.id,
            score: i.userScore,
            severity: getIncidentSeverity(i),
            status: i.status,
          }))
        );

        let incidents = allIncidents;
        if (eligible.length > 0) {
          const updates = await Promise.all(
            eligible.map(async (incident) => {
              try {
                return await dispatchEliteReport(incident, { silent: true });
              } catch (error) {
                console.error('Backfill auto-dispatch failed for', incident.id, error);
                toast({
                  title: "Auto-dispatch failed",
                  description: error instanceof Error ? error.message : `Could not dispatch ${incident.id}`,
                  variant: "destructive",
                });
                return null;
              }
            })
          );

          const byId = new Map(
            updates.filter(Boolean).map((item) => [item!.id!, item!])
          );
          if (byId.size > 0) {
            incidents = allIncidents.map((incident) =>
              incident.id && byId.has(incident.id) ? byId.get(incident.id)! : incident
            );
            toast({
              title: "Agent Auto-Dispatched",
              description: `${byId.size} Elite severity-5 report(s) sent to nearest authorities.`,
            });
          }
        }

        setReports(incidents);
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

  // Resolve precise "near Place (lat, lng)" labels (street/locality, not just city)
  useEffect(() => {
    let cancelled = false;

    const resolveLabels = async () => {
      const uniqueReports = reports.filter((report) => report.id && report.location);

      for (const report of uniqueReports) {
        if (cancelled) return;
        if (!report.id) continue;

        const existing = locationLabels[report.id];
        // Re-resolve overly generic city-only labels from older lookups.
        const isTooGeneric =
          !!existing &&
          /^near [^,(]+ \(\d/.test(existing) &&
          !/,/.test(existing) &&
          !/\b(road|street|nagar|colony|market|subway|lane|avenue|marg|hospital|clinic)\b/i.test(existing);

        if (existing && !existing.includes("unknown area") && !isTooGeneric) {
          continue;
        }

        try {
          const label = await resolveNearLocationLabel({
            lat: report.location.lat,
            lng: report.location.lng,
            existingAddress: report.location.address,
          });

          if (cancelled) return;
          setLocationLabels((prev) => ({ ...prev, [report.id!]: label }));
        } catch (error) {
          console.warn("Location label resolve failed:", error);
          if (cancelled) return;
          const coords = `${report.location.lat.toFixed(3)}, ${report.location.lng.toFixed(3)}`;
          setLocationLabels((prev) => ({
            ...prev,
            [report.id!]: `near unknown area (${coords})`,
          }));
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    };

    void resolveLabels();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);

  const getReportLocationLabel = (report: Report): string => {
    if (report.id && locationLabels[report.id]) {
      return locationLabels[report.id];
    }
    const coords = `${report.location.lat.toFixed(3)}, ${report.location.lng.toFixed(3)}`;
    if (
      report.location.address &&
      !/^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(report.location.address)
    ) {
      const short = report.location.address.split(",").slice(0, 2).join(",").trim();
      return `near ${short} (${coords})`;
    }
    return `Resolving location… (${coords})`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "in-progress": return <Clock className="h-4 w-4 text-primary" />;
      case "resolved": return <CheckCircle className="h-4 w-4 text-foreground" />;
      case "rejected": return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const buildAgentDispatchPayload = (
    dispatch: Awaited<ReturnType<typeof runAgenticAutoDispatch>>
  ) => ({
    triggered: dispatch.triggered,
    reason: dispatch.reason,
    ...(dispatch.authority?.name ? { authorityName: dispatch.authority.name } : {}),
    ...(dispatch.authority?.phone ? { authorityPhone: dispatch.authority.phone } : {}),
    ...(dispatch.authority?.email ? { authorityEmail: dispatch.authority.email } : {}),
    ...(typeof dispatch.authority?.distanceKm === 'number'
      ? { distanceKm: dispatch.authority.distanceKm }
      : {}),
    emailOpened: dispatch.actions.emailOpened,
    emailSubmitted: dispatch.actions.emailSubmitted,
    callOpened: dispatch.actions.callOpened,
    ...(dispatch.actions.callNumber ? { callNumber: dispatch.actions.callNumber } : {}),
    ...(dispatch.messagePreview ? { messagePreview: dispatch.messagePreview } : {}),
    createdAt: dispatch.createdAt,
  });

  const dispatchEliteReport = async (
    incident: Report,
    options?: { silent?: boolean }
  ): Promise<Report | null> => {
    if (!incident.id) return null;

    const score = Number(incident.userScore || 0);
    const severity = getIncidentSeverity(incident);
    if (!shouldAutoEscalate(score, severity)) {
      toast({
        title: "Not eligible for auto-dispatch",
        description: `Needs Elite score ≥ 100 (has ${score}) and severity 5 (has ${severity}).`,
        variant: "destructive",
      });
      return null;
    }

    const dispatch = await runAgenticAutoDispatch({
      incidentId: incident.id,
      userScore: score,
      userName: incident.userName || 'Citizen',
      userEmail: incident.userEmail || 'unknown@email.com',
      description: incident.description,
      category: incident.aiAnalysis?.category || 'Other',
      severity,
      location: {
        lat: incident.location.lat,
        lng: incident.location.lng,
        ...(incident.location.address ? { address: incident.location.address } : {}),
      },
      silent: options?.silent ?? false,
    });

    if (!dispatch.triggered) {
      toast({
        title: "Auto-dispatch skipped",
        description: dispatch.reason,
        variant: "destructive",
      });
      return null;
    }

    const agentDispatch = buildAgentDispatchPayload(dispatch);
    await saveAgentDispatchResult(incident.id, agentDispatch);

    return {
      ...incident,
      agentDispatch,
      status: 'in-progress' as const,
      notes: `Agent auto-dispatched to ${dispatch.authority?.name || 'nearest authority'} (no admin action required).`,
    };
  };

  // Free nearest-authority lookup via OpenStreetMap Overpass
  const findNearestAuthorities = async (
    issueType: string,
    location: { lat: number, lng: number },
    severity: number,
    description: string = ""
  ) => {
    try {
      console.log('Finding nearest authorities via OpenStreetMap...');

      const realServices = await findRealEmergencyServices(location, issueType, severity, description);

      if (realServices.length > 0) {
        console.log(`Found ${realServices.length} nearby authorities from OpenStreetMap`);
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
        description: `Report has been ${newStatus}.`,
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
    
    // Priority filtering (badge from users profile, score as fallback)
    const score = Number(report.userScore || 0);
    const isElite = normalizeBadgeLabel(report.userBadge || '') === CITIZEN_BADGES.ELITE || score >= 100;
    const isGold = normalizeBadgeLabel(report.userBadge || '') === CITIZEN_BADGES.GOLD || score >= 75;
    let matchesPriority = true;
    if (priorityFilter === "elite") {
      matchesPriority = isElite;
    } else if (priorityFilter === "gold") {
      matchesPriority = isElite || isGold;
    } else if (priorityFilter === "high") {
      matchesPriority = isElite || isGold || getIncidentSeverity(report) >= 4;
    }
    
    return matchesSearch && matchesSeverity && matchesStatus && matchesPriority;
  }).sort((a, b) => {
    // Active work first; resolved/rejected sink to the bottom
    const statusRank = (status?: string) => {
      switch (status) {
        case "pending":
          return 0;
        case "in-progress":
          return 1;
        case "resolved":
          return 2;
        case "rejected":
          return 3;
        default:
          return 4;
      }
    };

    const statusDiff = statusRank(a.status) - statusRank(b.status);
    if (statusDiff !== 0) return statusDiff;

    // Within the same status: Elite citizens first, then severity, then date
    const getPriorityScore = (report: Report) => {
      let score = 0;

      const badge = normalizeBadgeLabel(report.userBadge || '');
      if (badge === CITIZEN_BADGES.ELITE) score += 1000;
      else if (badge === CITIZEN_BADGES.GOLD) score += 500;
      else if (badge === CITIZEN_BADGES.SILVER) score += 200;
      else if (badge === CITIZEN_BADGES.BRONZE) score += 100;
      else if (badge === CITIZEN_BADGES.NEW) score += 50;
      else if (badge === CITIZEN_BADGES.SUSPENDED) score += 0;

      score += getIncidentSeverity(report) * 10;

      const daysOld = report.createdAt
        ? (Date.now() - report.createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24)
        : 0;
      score += Math.max(0, 30 - daysOld);

      return score;
    };

    return getPriorityScore(b) - getPriorityScore(a);
  });

  const stats = {
    total: reports.length,
    pending: reports.filter(r => r.status === "pending").length,
    highSeverity: reports.filter((r) => getIncidentSeverity(r) >= 4).length,
    resolved: reports.filter(r => r.status === "resolved").length,
    eliteReports: reports.filter(r => normalizeBadgeLabel(r.userBadge || '') === CITIZEN_BADGES.ELITE || Number(r.userScore || 0) >= 100).length
  };



  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="backdrop-city border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <MapPin className="h-5 w-5 text-primary-foreground" />
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
              <div className="text-2xl font-semibold text-muted-foreground">{stats.pending}</div>
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
              <div className="text-2xl font-semibold text-primary">{stats.highSeverity}</div>
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
              <div className="text-2xl font-semibold text-foreground">{stats.resolved}</div>
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
              <div className="text-2xl font-semibold text-primary">{stats.eliteReports}</div>
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
                      <p>
                        Open:{' '}
                        {Math.max(
                          0,
                          Number(user.totalReports || 0) -
                            Number(user.acceptedReports || 0) -
                            Number(user.rejectedReports || 0)
                        )}
                      </p>
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
                    <SelectItem value="elite">Elite Only</SelectItem>
                    <SelectItem value="gold">Gold+ Only</SelectItem>
                    <SelectItem value="high">High Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-hidden">
            <div className="w-full max-w-full overflow-x-auto">
            <Table className="min-w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">Priority</TableHead>
                  <TableHead className="w-[18%]">Summary</TableHead>
                  <TableHead className="w-[110px]">Category</TableHead>
                  <TableHead className="w-[80px]">Severity</TableHead>
                  <TableHead className="w-[22%]">Location</TableHead>
                  <TableHead className="w-[90px]">Date</TableHead>
                  <TableHead className="w-[110px]">Status</TableHead>
                  <TableHead className="w-[100px]">Reporter</TableHead>
                  <TableHead className="w-[160px] sticky right-0 bg-card z-10 border-l border-border">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow key={report.id} className="hover:bg-muted/50">
                    <TableCell className="whitespace-nowrap">
                      {normalizeBadgeLabel(report.userBadge || '') === CITIZEN_BADGES.ELITE || Number(report.userScore || 0) >= 100 ? (
                        <Badge className="bg-primary/15 border border-primary text-primary text-xs px-2 py-1 font-semibold">
                          HIGH
                        </Badge>
                      ) : normalizeBadgeLabel(report.userBadge || '') === CITIZEN_BADGES.GOLD || Number(report.userScore || 0) >= 75 ? (
                        <Badge className="bg-primary/10 border border-primary/50 text-primary text-xs px-2 py-1">
                          MEDIUM
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs px-2 py-1 text-muted-foreground">
                          NORMAL
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-0 truncate text-sm" title={report.description}>
                      {report.description}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="outline" className="text-xs px-2 py-1">
                        {report.aiAnalysis?.category || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge className={`${getSeverityBadgeClass(getIncidentSeverity(report))} text-xs px-2 py-1 min-w-[2rem] justify-center`}>
                        {getIncidentSeverity(report)}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="text-muted-foreground text-xs max-w-0 truncate"
                      title={getReportLocationLabel(report)}
                    >
                      {getReportLocationLabel(report)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {report.createdAt?.toDate().toLocaleDateString('en-GB') || 'N/A'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(report.status || 'pending')}
                        <span className="capitalize text-xs">{report.status || 'pending'}</span>
                      </div>
                      {report.agentDispatch?.triggered && (
                        <Badge className="mt-1 bg-primary/10 border border-primary/30 text-primary text-[10px]">
                          Auto-dispatched
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs max-w-0 truncate" title={report.userName || 'Anonymous'}>
                      {report.userName || 'Anonymous'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap sticky right-0 bg-card z-10 border-l border-border">
                      <div className="flex flex-wrap gap-1">
                        {report.status === "pending" && (
                          <>
                            {shouldAutoEscalate(Number(report.userScore || 0), getIncidentSeverity(report)) &&
                              !report.agentDispatch?.triggered && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                                onClick={async () => {
                                  try {
                                    const updated = await dispatchEliteReport(report, { silent: false });
                                    if (updated) {
                                      setReports((prev) =>
                                        prev.map((item) =>
                                          item.id === updated.id ? updated : item
                                        )
                                      );
                                      toast({
                                        title: "Agent Auto-Dispatched",
                                        description: updated.notes || "Authorities notified.",
                                      });
                                    }
                                  } catch (error) {
                                    console.error('Manual auto-dispatch failed:', error);
                                    toast({
                                      title: "Auto-dispatch failed",
                                      description:
                                        error instanceof Error
                                          ? error.message
                                          : "Could not dispatch this report.",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                Dispatch Now
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="h-7 px-2 text-xs bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                              onClick={async () => {
                                try {
                                  // Show authorities modal without changing status yet
                                  const authorities = await findNearestAuthorities(
                                    report.aiAnalysis?.category || 'Other',
                                    report.location,
                                    report.aiAnalysis?.severity || 1,
                                    report.description || report.aiAnalysis?.summary || ''
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
                                      title: "Authorities Found",
                                      description: `Nearest authorities: ${authorityList}. Response time: ${authorities[0].responseTime} minutes.`,
                                      duration: 8000,
                                    });

                                    // For high severity incidents, show detailed authority information
                                    if (report.aiAnalysis?.severity && report.aiAnalysis.severity >= 4) {
                                      setTimeout(() => {
                                        toast({
                                          title: "Emergency Contact Details",
                                          description: `Primary: ${authorities[0].name} - ${authorities[0].phone}. Backup: ${authorities[1]?.name} - ${authorities[1]?.phone}`,
                                          duration: 10000,
                                        });
                                      }, 2000);
                                    }
                                  } else {
                                    // Show fallback message if no authorities found
                                    toast({
                                      title: "No Authorities Found",
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
                                    title: "Error Finding Authorities",
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
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Authorities Modal */}
      {showAuthoritiesModal && currentIncident && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">
                Authorities Found for Incident
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAuthoritiesModal(false)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                ✕
              </Button>
            </div>

            {/* Emergency Contacts Quick Reference */}
            <div className="bg-muted/50 border border-border rounded-lg p-4 mb-4">
              <h3 className="font-medium text-foreground mb-2 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2 text-primary" />
                Emergency Numbers (India)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="text-center">
                  <div className="text-muted-foreground font-medium">Police</div>
                  <div className="text-foreground font-semibold">100</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground font-medium">Fire</div>
                  <div className="text-foreground font-semibold">101</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground font-medium">Ambulance</div>
                  <div className="text-foreground font-semibold">102</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground font-medium">Women Helpline</div>
                  <div className="text-foreground font-semibold">1091</div>
                </div>
              </div>
            </div>

            {/* Incident Details */}
            <div className="bg-muted/30 rounded-lg p-4 mb-4 border border-border">
              <h3 className="font-medium text-foreground mb-2">
                Incident: {currentIncident.description}
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Category:</span>
                  <span className="ml-2 font-medium text-foreground">
                    {currentIncident.aiAnalysis?.category}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Severity:</span>
                  <span className="ml-2 font-medium text-foreground">
                    {formatSeverity(getIncidentSeverity(currentIncident))}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Location:</span>
                  <span className="ml-2 font-medium text-foreground">
                    {getReportLocationLabel(currentIncident)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <span className="ml-2 font-medium text-foreground capitalize">
                    {currentIncident.status}
                  </span>
                </div>
              </div>
              {currentIncident.agentDispatch?.triggered && (
                <div className="mt-3 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">
                  <p className="font-semibold">Agent auto-dispatched (no admin action required)</p>
                  <p className="mt-1">
                    Authority: {currentIncident.agentDispatch.authorityName || 'Nearest emergency authority'}
                    {currentIncident.agentDispatch.callNumber
                      ? ` • Call: ${currentIncident.agentDispatch.callNumber}`
                      : ''}
                  </p>
                  {currentIncident.agentDispatch.authorityEmail && (
                    <p className="mt-1">Email: {currentIncident.agentDispatch.authorityEmail}</p>
                  )}
                </div>
              )}
            </div>

            {/* Authorities List */}
            <div className="space-y-3">
              <h3 className="font-medium text-foreground">
                Nearest Available Authorities
              </h3>
              {currentAuthorities.map((authority, index) => (
                <div key={authority.id || index} className="border border-border rounded-lg p-4 bg-muted/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium text-foreground">
                        {authority.name}
                      </h4>
                      {authority.rating && (
                        <div className="flex items-center space-x-1">
                          <Star className="h-3 w-3 text-primary fill-current" />
                          <span className="text-xs text-muted-foreground">{authority.rating}</span>
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className={
                      index === 0 ? 'border-primary text-primary' : 'text-muted-foreground'
                    }>
                      {index === 0 ? 'Primary' : index === 1 ? 'Secondary' : 'Backup'}
                    </Badge>
                  </div>
                  
                  {/* Service Type Badge */}
                  <div className="mb-3">
                    <Badge variant="outline" className="text-xs">
                      {authority.category}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <div>
                        <span className="text-muted-foreground text-xs">Distance:</span>
                        <div className="font-medium text-foreground">
                          {authority.distance > 0 ? `${authority.distance} km` : 'National Service'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <div>
                        <span className="text-muted-foreground text-xs">Response:</span>
                        <div className="font-medium text-foreground">
                          {authority.responseTime} min
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Contact Information */}
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center space-x-2">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      <div>
                        <span className="text-muted-foreground text-xs">Phone:</span>
                        <div className="font-medium text-foreground">
                          {authority.phone}
                        </div>
                      </div>
                    </div>
                    {authority.emergencyPhone && (
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="h-3 w-3 text-destructive" />
                        <div>
                          <span className="text-destructive text-xs">Emergency:</span>
                          <div className="font-medium text-foreground">
                            {authority.emergencyPhone}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-3 w-3 text-muted-foreground mt-0.5" />
                      <div>
                        <span className="text-muted-foreground text-xs">Address:</span>
                        <div className="font-medium text-foreground text-xs leading-tight">
                          {authority.address}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Info */}
                  {authority.website && (
                    <div className="flex items-center space-x-2 mb-3 text-xs">
                      <Globe className="h-3 w-3 text-muted-foreground" />
                      <a 
                        href={authority.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Visit Website
                      </a>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      className="btn-city text-xs flex-1"
                      onClick={() => {
                        const rawCandidates = [
                          authority.phone,
                          authority.emergencyPhone,
                          "112",
                        ];
                        const dialNumber = rawCandidates
                          .map((value) => (value || "").trim())
                          .find((value) => value && value.toUpperCase() !== "N/A" && /[\d+]/.test(value));

                        if (!dialNumber) {
                          toast({
                            title: "No phone number available",
                            description: "This authority has no dialable number in OpenStreetMap data.",
                            variant: "destructive",
                          });
                          return;
                        }

                        const sanitized = dialNumber.replace(/[^\d+]/g);
                        const anchor = document.createElement("a");
                        anchor.href = `tel:${sanitized}`;
                        anchor.rel = "noopener noreferrer";
                        document.body.appendChild(anchor);
                        anchor.click();
                        anchor.remove();

                        toast({
                          title: "Calling authority",
                          description: `Dialing ${authority.name} at ${sanitized}`,
                        });
                      }}
                    >
                      <Phone className="h-3 w-3 mr-1" />
                      Contact Now
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={async () => {
                        const dialable =
                          authority.phone && authority.phone.toUpperCase() !== "N/A"
                            ? authority.phone
                            : authority.emergencyPhone || "N/A";
                        const contactInfo = [
                          authority.name,
                          `Phone: ${dialable}`,
                          authority.emergencyPhone ? `Emergency: ${authority.emergencyPhone}` : null,
                          authority.address ? `Address: ${authority.address}` : null,
                          `Distance: ${authority.distance} km`,
                        ]
                          .filter(Boolean)
                          .join("\n");

                        try {
                          await navigator.clipboard.writeText(contactInfo);
                          toast({
                            title: "Contact details copied",
                            description: "Authority information copied to clipboard",
                          });
                        } catch {
                          toast({
                            title: "Copy failed",
                            description: "Could not copy to clipboard on this browser.",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      Copy Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setShowAuthoritiesModal(false)}
              >
                Close
              </Button>
              <Button
                className="btn-city"
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
                        title: "Work Started",
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