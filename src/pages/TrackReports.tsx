import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, 
  ArrowLeft,
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  MapPin,
  Calendar,
  User,
  FileText,
  Home
} from "lucide-react";
import { getUserIncidents, Incident } from "@/lib/firebase-services";
import { useAuth } from "@/contexts/AuthContext";
import { getSeverityBadgeClass, getIncidentSeverity, formatSeverity } from "@/lib/severity";

const TrackReports = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const navigate = useNavigate();
  const { userData } = useAuth();

  // Load incidents from Firebase
  useEffect(() => {
    const loadIncidents = async () => {
      try {
        if (userData?.uid) {
          const userIncidents = await getUserIncidents(userData.uid);
          setIncidents(userIncidents);
        }
      } catch (error) {
        console.error('Error loading incidents:', error);
      }
    };

    if (userData?.uid) {
      loadIncidents();
    }
  }, [userData?.uid]);

  // Filter incidents based on search and filters
  const filteredIncidents = incidents.filter(incident => {
    const matchesSearch = incident.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (incident.location.address || `${incident.location.lat}, ${incident.location.lng}`).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || incident.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || incident.aiAnalysis?.category === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'in-progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return "bg-yellow-500/20 text-yellow-600 border-yellow-500/30";
      case 'in-progress':
        return "bg-blue-500/20 text-blue-600 border-blue-500/30";
      case 'rejected':
        return "bg-red-500/20 text-red-600 border-red-500/30";
      case 'resolved':
        return "bg-green-500/20 text-green-600 border-green-500/30";
      default:
        return "bg-gray-500/20 text-gray-600 border-gray-500/30";
    }
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="backdrop-city border-b border-border/50 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/dashboard")}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/dashboard")}
              className="text-muted-foreground hover:text-foreground"
            >
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="max-w-6xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gradient mb-2">Track Your Reports</h1>
            <p className="text-muted-foreground">
              Monitor the status and progress of all your submitted reports
            </p>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reports by description or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Traffic">Traffic</SelectItem>
                <SelectItem value="Power Outage">Power Outage</SelectItem>
                <SelectItem value="Water Issue">Water Issue</SelectItem>
                <SelectItem value="Public Unrest">Public Unrest</SelectItem>
                <SelectItem value="Infrastructure">Infrastructure</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="card-city">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-primary">{incidents.length}</div>
                <p className="text-sm text-muted-foreground">Total Reports</p>
              </CardContent>
            </Card>
            
            <Card className="card-city">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-yellow-600">
                  {incidents.filter(inc => inc.status === 'pending').length}
                </div>
                <p className="text-sm text-muted-foreground">Pending</p>
              </CardContent>
            </Card>
            
            <Card className="card-city">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {incidents.filter(inc => inc.status === 'in-progress').length}
                </div>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </CardContent>
            </Card>
            
            <Card className="card-city">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">
                  {incidents.filter(inc => inc.status === 'resolved').length}
                </div>
                <p className="text-sm text-muted-foreground">Resolved</p>
              </CardContent>
            </Card>
          </div>

          {/* Reports List */}
          <div className="space-y-4">
            {filteredIncidents.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Reports Found</h3>
                  <p className="text-muted-foreground mb-4">
                    {incidents.length === 0 
                      ? "You haven't submitted any reports yet. Start by reporting an issue!" 
                      : "No reports match your search criteria."
                    }
                  </p>
                  {incidents.length === 0 && (
                    <Button onClick={() => navigate("/dashboard")}>
                      Go to Dashboard
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredIncidents.map((incident) => (
                <Card key={incident.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                      {/* Report Details */}
                      <div className="flex-1 space-y-4">
                        <div className="flex items-start justify-between">
                                                  <h3 className="text-lg font-medium text-foreground line-clamp-2">
                          {incident.description}
                        </h3>
                          <div className="flex items-center space-x-2 ml-4">
                            {getStatusIcon(incident.status)}
                            <Badge className={getStatusColor(incident.status)}>
                              {incident.status.charAt(0).toUpperCase() + incident.status.slice(1)}
                            </Badge>
                          </div>
                        </div>

                        {incident.aiAnalysis?.summary && (
                          <p className="text-muted-foreground line-clamp-3">
                            {incident.aiAnalysis.summary}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-4 w-4" />
                            <span>{incident.location.address || `${incident.location.lat.toFixed(4)}, ${incident.location.lng.toFixed(4)}`}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDate(incident.createdAt?.toDate() || new Date())}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4" />
                            <span>{incident.userName}</span>
                          </div>
                        </div>
                      </div>

                      {/* AI Analysis & Severity */}
                      <div className="flex flex-col items-end space-y-3">
                        {incident.aiAnalysis?.category && (
                          <Badge variant="outline" className="text-sm px-3 py-1">
                            {incident.aiAnalysis.category}
                          </Badge>
                        )}
                        
                        {incident.aiAnalysis?.severity && (
                          <Badge className={`text-sm px-3 py-1 ${getSeverityBadgeClass(getIncidentSeverity(incident))} text-white`}>
                            {formatSeverity(getIncidentSeverity(incident))}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-6 border-t mt-8">
            <p className="text-sm text-muted-foreground">
              Showing {filteredIncidents.length} of {incidents.length} reports
            </p>
            <Button onClick={() => navigate("/dashboard")} variant="outline">
              Back to Dashboard
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TrackReports;


