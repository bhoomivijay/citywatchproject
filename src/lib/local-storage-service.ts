// src/lib/local-storage-service.ts
// Local storage service as a fallback when Firebase isn't available

export interface LocalIncident {
  id: string;
  text: string;
  timestamp: Date;
  position?: {
    lat: number;
    lng: number;
  };
  aiAnalysis?: {
    summary: string;
    category: 'Traffic' | 'Power Outage' | 'Water Issue' | 'Public Unrest' | 'Infrastructure' | 'Other';
    severity: 1 | 2 | 3 | 4 | 5;
  };
  status?: 'pending' | 'approved' | 'rejected' | 'completed';
  reporter?: string;
  location?: string;
}

class LocalStorageService {
  private readonly STORAGE_KEY = 'pulseai_incidents';

  // Get all incidents from local storage
  getIncidents(): LocalIncident[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const incidents = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        return incidents.map((incident: any) => ({
          ...incident,
          timestamp: new Date(incident.timestamp)
        }));
      }
      return [];
    } catch (error) {
      console.error('Error reading from local storage:', error);
      return [];
    }
  }

  // Add a new incident
  addIncident(incident: Omit<LocalIncident, 'id'>): string {
    try {
      const incidents = this.getIncidents();
      const newIncident: LocalIncident = {
        ...incident,
        id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        status: 'pending'
      };
      
      incidents.unshift(newIncident); // Add to beginning
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(incidents));
      
      console.log('Incident saved to local storage:', newIncident);
      return newIncident.id;
    } catch (error) {
      console.error('Error saving to local storage:', error);
      throw error;
    }
  }

  // Update incident status
  updateIncidentStatus(incidentId: string, status: 'approved' | 'rejected' | 'completed'): void {
    try {
      const incidents = this.getIncidents();
      const updatedIncidents = incidents.map(incident => 
        incident.id === incidentId ? { ...incident, status } : incident
      );
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedIncidents));
      console.log(`Incident ${incidentId} status updated to: ${status}`);
    } catch (error) {
      console.error('Error updating incident status:', error);
      throw error;
    }
  }

  // Clear all incidents (for testing)
  clearIncidents(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('All incidents cleared from local storage');
  }

  // Get incidents count
  getIncidentsCount(): number {
    return this.getIncidents().length;
  }

  // Get incidents by status
  getIncidentsByStatus(status: string): LocalIncident[] {
    return this.getIncidents().filter(incident => incident.status === status);
  }

  // Get incidents by severity
  getIncidentsBySeverity(severity: number): LocalIncident[] {
    return this.getIncidents().filter(incident => 
      incident.aiAnalysis?.severity === severity
    );
  }
}

export const localStorageService = new LocalStorageService();
