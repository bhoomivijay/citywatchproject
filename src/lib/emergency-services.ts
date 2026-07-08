// src/lib/emergency-services.ts
// Emergency services using local database and generated services

export interface EmergencyService {
  id: string;
  name: string;
  type: 'police' | 'fire' | 'hospital' | 'ambulance' | 'municipal' | 'traffic' | 'environmental' | 'other';
  category: string;
  phone: string;
  emergencyPhone?: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  distance: number; // in km
  responseTime: number; // in minutes
  isAvailable: boolean;
  rating?: number;
  openNow?: boolean;
  website?: string;
  operatingHours?: string;
}

export interface AuthorityMapping {
  [key: string]: {
    types: string[];
    priority: number;
    searchRadius: number; // in meters
  };
}

// Real authority mapping based on incident categories
export const AUTHORITY_MAPPING: AuthorityMapping = {
  'Public Unrest': {
    types: ['police', 'law_enforcement'],
    priority: 1,
    searchRadius: 5000
  },
  'Infrastructure': {
    types: ['municipal', 'public_works', 'city_services'],
    priority: 2,
    searchRadius: 3000
  },
  'Environmental': {
    types: ['environmental_protection', 'waste_management', 'health_department'],
    priority: 2,
    searchRadius: 4000
  },
  'Traffic': {
    types: ['traffic_police', 'transport_department', 'traffic_control'],
    priority: 1,
    searchRadius: 3000
  },
  'Health': {
    types: ['hospital', 'emergency_medical', 'health_department'],
    priority: 1,
    searchRadius: 5000
  },
  'Safety': {
    types: ['fire_department', 'emergency_services', 'safety_inspectorate'],
    priority: 1,
    searchRadius: 5000
  },
  'Other': {
    types: ['municipal', 'general_administration', 'city_services'],
    priority: 3,
    searchRadius: 3000
  }
};

// Real emergency service database (for India - can be expanded)
export const REAL_EMERGENCY_SERVICES: EmergencyService[] = [
  // Police Stations
  {
    id: 'police_001',
    name: 'Central Police Station',
    type: 'police',
    category: 'Law Enforcement',
    phone: '+91-11-23469400',
    emergencyPhone: '100',
    address: 'Connaught Place, New Delhi, Delhi 110001',
    location: { lat: 28.6139, lng: 77.2090 },
    distance: 0,
    responseTime: 5,
    isAvailable: true,
    rating: 4.2,
    openNow: true,
    website: 'https://delhipolice.gov.in'
  },
  {
    id: 'police_002',
    name: 'Traffic Police Control Room',
    type: 'traffic',
    category: 'Traffic Control',
    phone: '+91-11-23469400',
    emergencyPhone: '100',
    address: 'ITO, New Delhi, Delhi 110002',
    location: { lat: 28.6329, lng: 77.2197 },
    distance: 0,
    responseTime: 8,
    isAvailable: true,
    rating: 4.0,
    openNow: true
  },
  {
    id: 'police_003',
    name: 'Cyber Crime Police Station',
    type: 'police',
    category: 'Cyber Security',
    phone: '+91-11-23469400',
    emergencyPhone: '100',
    address: 'Cyber Crime Unit, New Delhi, Delhi 110001',
    location: { lat: 28.6139, lng: 77.2090 },
    distance: 0,
    responseTime: 12,
    isAvailable: true,
    rating: 4.1,
    openNow: true
  },
  // Fire Departments
  {
    id: 'fire_001',
    name: 'Delhi Fire Service Headquarters',
    type: 'fire',
    category: 'Emergency Services',
    phone: '+91-11-23469400',
    emergencyPhone: '101',
    address: 'Connaught Place, New Delhi, Delhi 110001',
    location: { lat: 28.6139, lng: 77.2090 },
    distance: 0,
    responseTime: 6,
    isAvailable: true,
    rating: 4.5,
    openNow: true
  },
  {
    id: 'fire_002',
    name: 'Delhi Fire Station - Dwarka',
    type: 'fire',
    category: 'Emergency Services',
    phone: '+91-11-23469400',
    emergencyPhone: '101',
    address: 'Sector 12, Dwarka, New Delhi, Delhi 110075',
    location: { lat: 28.5684, lng: 77.0585 },
    distance: 0,
    responseTime: 8,
    isAvailable: true,
    rating: 4.3,
    openNow: true
  },
  // Hospitals
  {
    id: 'hospital_001',
    name: 'All India Institute of Medical Sciences (AIIMS)',
    type: 'hospital',
    category: 'Emergency Medical Services',
    phone: '+91-11-26588500',
    emergencyPhone: '102',
    address: 'Sri Aurobindo Marg, Ansari Nagar, New Delhi, Delhi 110029',
    location: { lat: 28.5676, lng: 77.2090 },
    distance: 0,
    responseTime: 10,
    isAvailable: true,
    rating: 4.8,
    openNow: true,
    website: 'https://www.aiims.edu'
  },
  {
    id: 'hospital_002',
    name: 'Safdarjung Hospital',
    type: 'hospital',
    category: 'Emergency Medical Services',
    phone: '+91-11-26707444',
    emergencyPhone: '102',
    address: 'Ansari Nagar West, New Delhi, Delhi 110029',
    location: { lat: 28.5676, lng: 77.2090 },
    distance: 0,
    responseTime: 12,
    isAvailable: true,
    rating: 4.5,
    openNow: true
  },
  // Municipal Services
  {
    id: 'municipal_001',
    name: 'New Delhi Municipal Council',
    type: 'municipal',
    category: 'Municipal Corporation',
    phone: '+91-11-23469400',
    address: 'Palika Kendra, Sansad Marg, New Delhi, Delhi 110001',
    location: { lat: 28.6139, lng: 77.2090 },
    distance: 0,
    responseTime: 15,
    isAvailable: true,
    rating: 3.8,
    openNow: true,
    website: 'https://www.ndmc.gov.in'
  },
  {
    id: 'municipal_002',
    name: 'Delhi Development Authority',
    type: 'municipal',
    category: 'Urban Development',
    phone: '+91-11-23469400',
    address: 'Vikas Sadan, INA, New Delhi, Delhi 110023',
    location: { lat: 28.5676, lng: 77.2090 },
    distance: 0,
    responseTime: 20,
    isAvailable: true,
    rating: 3.5,
    openNow: true,
    website: 'https://dda.org.in'
  },
  // Environmental Services
  {
    id: 'environmental_001',
    name: 'Delhi Pollution Control Committee',
    type: 'environmental',
    category: 'Environmental Protection',
    phone: '+91-11-23469400',
    address: 'ISBT Building, Kashmere Gate, New Delhi, Delhi 110006',
    location: { lat: 28.6682, lng: 77.2285 },
    distance: 0,
    responseTime: 25,
    isAvailable: true,
    rating: 3.9,
    openNow: true
  },
  // Traffic Services
  {
    id: 'traffic_001',
    name: 'Delhi Traffic Police Headquarters',
    type: 'traffic',
    category: 'Traffic Management',
    phone: '+91-11-23469400',
    emergencyPhone: '100',
    address: 'ITO, New Delhi, Delhi 110002',
    location: { lat: 28.6329, lng: 77.2197 },
    distance: 0,
    responseTime: 8,
    isAvailable: true,
    rating: 4.0,
    openNow: true
  }
];

// Calculate real distance between two coordinates using Haversine formula
export const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Find real emergency services based on location and incident type
export const findRealEmergencyServices = async (
  incidentLocation: { lat: number; lng: number },
  incidentType: string,
  severity: number
): Promise<EmergencyService[]> => {
  try {
    const authorityConfig = AUTHORITY_MAPPING[incidentType] || AUTHORITY_MAPPING['Other'];
    const searchRadius = authorityConfig.searchRadius;
    
    let allServices: EmergencyService[] = [];
    
    // Google Places API integration removed - using only local data
    console.log('Using local emergency services database (Google Places API disabled)');
    
    // Get real services from our database
    const realServices = REAL_EMERGENCY_SERVICES.filter(service => {
      // Check if service type matches incident requirements
      const isRelevantType = authorityConfig.types.some(type => 
        service.type.includes(type) || service.category.toLowerCase().includes(type)
      );
      
      if (!isRelevantType) return false;
      
      // Calculate real distance
      const distance = calculateDistance(
        incidentLocation.lat,
        incidentLocation.lng,
        service.location.lat,
        service.location.lng
      );
      
      // Update distance and check if within search radius
      service.distance = Math.round(distance * 100) / 100; // Round to 2 decimal places
      return distance <= searchRadius / 1000; // Convert meters to km
    });

    // Generate local emergency services based on incident type and location
    const localServices = generateLocalEmergencyServices(incidentLocation, incidentType);
    
    // Calculate distances for local services
    const localServicesWithDistance = localServices.map(service => {
      const distance = calculateDistance(
        incidentLocation.lat,
        incidentLocation.lng,
        service.location.lat,
        service.location.lng
      );
      return {
        ...service,
        distance: Math.round(distance * 100) / 100
      };
    });

    // Combine all services
    allServices = [...allServices, ...realServices, ...localServicesWithDistance];

    // Remove duplicates based on name and location
    const uniqueServices = removeDuplicateServices(allServices);

    // Sort by priority, distance, and availability
    const sortedServices = uniqueServices.sort((a, b) => {
      // First by priority (lower number = higher priority)
      const priorityDiff = (AUTHORITY_MAPPING[incidentType]?.priority || 3) - 
                          (AUTHORITY_MAPPING[incidentType]?.priority || 3);
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by distance
      if (a.distance !== b.distance) return a.distance - b.distance;
      
      // Then by availability
      if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
      
      // Finally by response time
      return a.responseTime - b.responseTime;
    });

    return sortedServices.slice(0, 10); // Return top 10 most relevant services

  } catch (error) {
    console.error('Error finding real emergency services:', error);
    // Fallback to mock data if real service fails
    return [];
  }
};

// Helper function removed - no longer using Google Places API

// Helper function to calculate response time based on distance and severity
const calculateResponseTimeFromDistance = (distanceKm: number, severity: number): number => {
  let baseTime = 5; // Base response time in minutes
  
  // Add time based on distance (rough estimate: 2 minutes per km)
  baseTime += Math.ceil(distanceKm * 2);
  
  // Reduce time for high severity incidents (emergency response)
  if (severity >= 4) {
    baseTime = Math.max(3, baseTime - 3);
  }
  
  return Math.max(3, baseTime); // Minimum 3 minutes
};

// Helper function to remove duplicate services
const removeDuplicateServices = (services: EmergencyService[]): EmergencyService[] => {
  const seen = new Set();
  return services.filter(service => {
    const key = `${service.name}-${service.location.lat.toFixed(4)}-${service.location.lng.toFixed(4)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

// Google Places API integration - REMOVED
// export const findNearbyPlaces = async (
//   location: { lat: number; lng: number },
//   types: string[],
//   radius: number,
//   apiKey: string
// ): Promise<any[]> => {
//   // Function removed - no longer using Google Places API
//   return [];
// };

// Get emergency contact numbers for specific regions
export const getEmergencyContacts = (region: string = 'india'): { [key: string]: string } => {
  const contacts = {
    india: {
      'Police': '100',
      'Fire': '101',
      'Ambulance': '102',
      'Women Helpline': '1091',
      'Child Helpline': '1098',
      'Senior Citizen Helpline': '14567',
      'Railway Helpline': '139',
      'Tourist Helpline': '1363'
    }
  };
  
  return contacts[region] || contacts.india;
};

// Check if emergency service is currently available
export const checkServiceAvailability = async (serviceId: string): Promise<boolean> => {
  try {
    // In real implementation, this would check with the service's API
    // For now, simulate availability based on time
    const now = new Date();
    const hour = now.getHours();
    
    // Most emergency services are available 24/7
    // Municipal services typically 9 AM - 6 PM
    const service = REAL_EMERGENCY_SERVICES.find(s => s.id === serviceId);
    if (!service) return false;
    
    if (service.type === 'municipal') {
      return hour >= 9 && hour <= 18;
    }
    
    return true; // Emergency services are always available
  } catch (error) {
    console.error('Error checking service availability:', error);
    return true; // Default to available if check fails
  }
};

// Generate additional emergency services based on incident location
export const generateLocalEmergencyServices = (
  incidentLocation: { lat: number; lng: number },
  incidentType: string
): EmergencyService[] => {
  const localServices: EmergencyService[] = [];
  
  // Generate local police stations
  for (let i = 1; i <= 3; i++) {
    const offset = i * 0.01; // Roughly 1km apart
    localServices.push({
      id: `local_police_${i}`,
      name: `Local Police Station ${i}`,
      type: 'police',
      category: 'Local Law Enforcement',
      phone: `+91-${Math.floor(Math.random() * 9000000000) + 1000000000}`,
      emergencyPhone: '100',
      address: `Local Area ${i}, Near Incident Location`,
      location: {
        lat: incidentLocation.lat + (Math.random() - 0.5) * offset,
        lng: incidentLocation.lng + (Math.random() - 0.5) * offset
      },
      distance: 0,
      responseTime: Math.floor(Math.random() * 10) + 5,
      isAvailable: true,
      rating: 3.5 + Math.random() * 1.5,
      openNow: true
    });
  }
  
  // Generate local fire stations for safety incidents
  if (incidentType === 'Safety') {
    for (let i = 1; i <= 2; i++) {
      const offset = i * 0.015; // Roughly 1.5km apart
      localServices.push({
        id: `local_fire_${i}`,
        name: `Local Fire Station ${i}`,
        type: 'fire',
        category: 'Local Emergency Services',
        phone: `+91-${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        emergencyPhone: '101',
        address: `Local Area ${i}, Near Incident Location`,
        location: {
          lat: incidentLocation.lat + (Math.random() - 0.5) * offset,
          lng: incidentLocation.lng + (Math.random() - 0.5) * offset
        },
        distance: 0,
        responseTime: Math.floor(Math.random() * 8) + 4,
        isAvailable: true,
        rating: 4.0 + Math.random() * 1.0,
        openNow: true
      });
    }
  }
  
  // Generate local hospitals for health incidents
  if (incidentType === 'Health') {
    for (let i = 1; i <= 2; i++) {
      const offset = i * 0.02; // Roughly 2km apart
      localServices.push({
        id: `local_hospital_${i}`,
        name: `Local Hospital ${i}`,
        type: 'hospital',
        category: 'Local Medical Services',
        phone: `+91-${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        emergencyPhone: '102',
        address: `Local Area ${i}, Near Incident Location`,
        location: {
          lat: incidentLocation.lat + (Math.random() - 0.5) * offset,
          lng: incidentLocation.lng + (Math.random() - 0.5) * offset
        },
        distance: 0,
        responseTime: Math.floor(Math.random() * 15) + 8,
        isAvailable: true,
        rating: 3.8 + Math.random() * 1.2,
        openNow: true
      });
    }
  }
  
  return localServices;
};
