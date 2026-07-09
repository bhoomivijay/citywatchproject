// src/components/IncidentsList.tsx
// Real-time incidents list component for the Dashboard

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, MapPin, User } from "lucide-react";
import { Incident } from "@/lib/firebase-services";
import { getSeverityBadgeClass, getIncidentSeverity, formatSeverity } from "@/lib/severity";

interface IncidentsListProps {
  incidents: Incident[];
}

export const IncidentsList = ({ incidents }: IncidentsListProps) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="h-3 w-3 text-muted-foreground" />;
      case "in-progress": return <Clock className="h-3 w-3 text-primary" />;
      case "resolved": return <Clock className="h-3 w-3 text-foreground" />;
      case "rejected": return <Clock className="h-3 w-3 text-destructive" />;
      default: return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  if (incidents.length === 0) {
    return (
      <Card className="card-city">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Live Incidents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No incidents reported yet</p>
            <p className="text-xs">Be the first to report an issue!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-city">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          <span>Live Incidents</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[650px]">
          <div className="space-y-2 p-4">
            {incidents.map((incident) => {
              console.log('IncidentsList: Rendering incident:', incident);
              console.log('IncidentsList: Incident AI analysis:', incident.aiAnalysis);
              console.log('IncidentsList: Incident severity:', incident.aiAnalysis?.severity);
              
              return (
                <div
                  key={incident.id}
                  className="p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
                >
                  {/* Header with severity and status */}
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={`${getSeverityBadgeClass(getIncidentSeverity(incident))} text-xs`}>
                      {formatSeverity(getIncidentSeverity(incident))}
                    </Badge>
                    <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                      {getStatusIcon(incident.status || 'pending')}
                      <span className="capitalize">{incident.status || 'pending'}</span>
                    </div>
                  </div>

                  {/* AI Summary */}
                  {incident.aiAnalysis?.summary ? (
                    <p className="text-sm font-medium mb-2">
                      {incident.aiAnalysis.summary}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground mb-2 italic">
                      Analyzing with AI...
                    </p>
                  )}

                  {/* Original Report */}
                  <p className="text-xs text-muted-foreground mb-2">
                    "{incident.description}"
                  </p>

                  {/* Footer with metadata */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <User className="h-3 w-3" />
                      <span>{incident.userName || 'Anonymous'}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-3 w-3" />
                      <span>{incident.timestamp?.toLocaleDateString() || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
