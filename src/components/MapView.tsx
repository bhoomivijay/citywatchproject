import { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import {
  getSeverityHex,
  getSeverityLabel,
  getIncidentSeverity,
  formatSeverity,
  getSeverityBadgeClass,
} from "@/lib/severity";

interface MapViewProps {
  onLocationSelect?: (location: { lat: number; lng: number }) => void;
  onLocationChange?: (location: { lat: number; lng: number; city?: string }) => void;
  incidents?: any[];
  onIncidentAdded?: (incident: any) => void;
}

const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };
const MIN_MOVE_FOR_GEOCODE_METERS = 150;

const USER_LOCATION_COLOR = "#7c3aed";
const SELECTED_REPORT_COLOR = "#3b82f6";

const createCircleMarker = (
  lat: number,
  lng: number,
  color: string,
  radius: number,
  popupHtml?: string
) => {
  const marker = L.circleMarker([lat, lng], {
    radius,
    fillColor: color,
    fillOpacity: 0.85,
    color: "#ffffff",
    weight: 2,
  });

  if (popupHtml) {
    marker.bindPopup(popupHtml);
  }

  return marker;
};

const buildIncidentPopup = (incident: any) => `
  <div style="padding: 12px; max-width: 250px;">
    <h3 style="margin: 0 0 10px 0; font-weight: bold; color: #1f2937; font-size: 14px;">
      ${incident.aiAnalysis?.category || "Unknown Issue"}
    </h3>
    <p style="margin: 0 0 10px 0; font-size: 13px; color: #374151; line-height: 1.4;">
      ${incident.description?.substring(0, 100) || "No description"}...
    </p>
    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid #e5e7eb;">
      <span style="font-size: 12px; color: #059669; font-weight: 500;">
        ${formatSeverity(getIncidentSeverity(incident))}
      </span>
      <span style="font-size: 12px; color: #dc2626; font-weight: 500;">
        Status: ${incident.status || "Unknown"}
      </span>
    </div>
  </div>
`;

const getCityFromCoordinates = async (lat: number, lng: number): Promise<string> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`,
      {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "CityWatch/1.0",
        },
      }
    );
    const data = await response.json();
    const address = data.address || {};

    return (
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.state_district ||
      address.suburb ||
      address.county ||
      address.state ||
      `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    );
  } catch (error) {
    console.error("Error getting city name:", error);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};

const distanceMeters = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) => {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export const MapView = ({
  onLocationSelect,
  onLocationChange,
  incidents = [],
}: MapViewProps) => {
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");
  const [locationStatus, setLocationStatus] = useState<"locating" | "found" | "denied">("locating");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const incidentMarkersRef = useRef<L.LayerGroup | null>(null);
  const selectedMarkerRef = useRef<L.CircleMarker | null>(null);
  const currentLocationMarkerRef = useRef<L.CircleMarker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const hasFirstFixRef = useRef(false);
  const userPannedMapRef = useRef(false);
  const userManuallySelectedRef = useRef(false);
  const lastGeocodedLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  const onLocationSelectRef = useRef(onLocationSelect);
  const onLocationChangeRef = useRef(onLocationChange);

  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect;
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationSelect, onLocationChange]);

  const updateCurrentLocationMarker = useCallback((location: { lat: number; lng: number }) => {
    if (!leafletMapRef.current) return;

    if (currentLocationMarkerRef.current) {
      currentLocationMarkerRef.current.remove();
    }

    currentLocationMarkerRef.current = createCircleMarker(
      location.lat,
      location.lng,
      USER_LOCATION_COLOR,
      8
    );
    currentLocationMarkerRef.current.addTo(leafletMapRef.current);
  }, []);

  const applyLocation = useCallback(
    async (
      location: { lat: number; lng: number },
      options: {
        select?: boolean;
        center?: boolean;
        geocode?: boolean;
        persist?: boolean;
      } = {}
    ) => {
      const { select = false, center = false, geocode = true, persist = false } = options;

      setCurrentLocation(location);
      updateCurrentLocationMarker(location);

      if (select) {
        setSelectedLocation(location);
        onLocationSelectRef.current?.(location);
      }

      let city: string | undefined;
      if (geocode) {
        city = await getCityFromCoordinates(location.lat, location.lng);
        lastGeocodedLocationRef.current = location;
        onLocationChangeRef.current?.({ ...location, city });
      } else if (lastGeocodedLocationRef.current) {
        onLocationChangeRef.current?.({ ...location });
      }

      if (persist && city) {
        localStorage.setItem("userLocation", JSON.stringify(location));
        localStorage.setItem("userCity", city);
      }

      if (center && leafletMapRef.current && !userPannedMapRef.current) {
        leafletMapRef.current.setView([location.lat, location.lng], select ? 15 : 14);
      }

      return city;
    },
    [updateCurrentLocationMarker]
  );

  const handlePositionUpdate = useCallback(
    async (position: GeolocationPosition, options: { forceSelect?: boolean; forceCenter?: boolean } = {}) => {
      const { forceSelect = false, forceCenter = false } = options;
      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      const isFirstFix = !hasFirstFixRef.current;
      if (isFirstFix) {
        hasFirstFixRef.current = true;
      }

      const movedEnough =
        !lastGeocodedLocationRef.current ||
        distanceMeters(location, lastGeocodedLocationRef.current) >= MIN_MOVE_FOR_GEOCODE_METERS;

      const shouldGeocode = isFirstFix || movedEnough;
      const shouldSelect = (isFirstFix || forceSelect) && !userManuallySelectedRef.current;
      const shouldCenter = (isFirstFix || forceCenter) && !userPannedMapRef.current;

      setLocationStatus("found");
      setLocationError(null);
      setIsLocating(false);

      await applyLocation(location, {
        select: shouldSelect,
        center: shouldCenter,
        geocode: shouldGeocode,
        persist: shouldGeocode,
      });
    },
    [applyLocation]
  );

  const startWatchingLocation = useCallback(
    (options: { forceSelect?: boolean; forceCenter?: boolean } = {}) => {
      if (!navigator.geolocation) {
        setLocationStatus("denied");
        setLocationError("Geolocation is not supported by this browser.");
        setIsLocating(false);
        return;
      }

      setIsLocating(true);
      setLocationStatus("locating");
      setLocationError(null);

      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          void handlePositionUpdate(position, options);
        },
        (error) => {
          console.error("Error getting current location:", error);
          setIsLocating(false);
          setLocationStatus("denied");

          const messages: Record<number, string> = {
            1: "Location permission denied. Allow location access in your browser settings, then tap Refresh Location.",
            2: "Location unavailable. Check that GPS/location services are enabled on your device.",
            3: "Location request timed out. Try again or tap Refresh Location.",
          };
          setLocationError(messages[error.code] || "Could not detect your location.");

          const storedLocation = localStorage.getItem("userLocation");
          const storedCity = localStorage.getItem("userCity");
          if (storedLocation && storedCity) {
            try {
              const location = JSON.parse(storedLocation) as { lat: number; lng: number };
              setCurrentLocation(location);
              updateCurrentLocationMarker(location);
              onLocationChangeRef.current?.({ ...location, city: storedCity });
              leafletMapRef.current?.setView([location.lat, location.lng], 14);
            } catch {
              localStorage.removeItem("userLocation");
              localStorage.removeItem("userCity");
            }
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        }
      );
    },
    [handlePositionUpdate, updateCurrentLocationMarker]
  );

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    try {
      const map = L.map(mapRef.current, {
        center: [INDIA_CENTER.lat, INDIA_CENTER.lng],
        zoom: 5,
        zoomControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      incidentMarkersRef.current = L.layerGroup().addTo(map);

      map.on("dragstart", () => {
        userPannedMapRef.current = true;
      });

      map.on("click", async (event) => {
        userManuallySelectedRef.current = true;
        const location = { lat: event.latlng.lat, lng: event.latlng.lng };
        setSelectedLocation(location);
        onLocationSelectRef.current?.(location);
        map.setView([location.lat, location.lng], map.getZoom());

        const city = await getCityFromCoordinates(location.lat, location.lng);
        onLocationChangeRef.current?.({ ...location, city });
      });

      leafletMapRef.current = map;
      setMapStatus("ready");
    } catch (error) {
      console.error("Failed to initialize Leaflet map:", error);
      setMapStatus("error");
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      selectedMarkerRef.current = null;
      currentLocationMarkerRef.current = null;
      incidentMarkersRef.current = null;
      leafletMapRef.current?.remove();
      leafletMapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (mapStatus !== "ready") return;

    localStorage.removeItem("userLocation");
    localStorage.removeItem("userCity");
    startWatchingLocation({ forceSelect: true, forceCenter: true });
  }, [mapStatus, startWatchingLocation]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && mapStatus === "ready") {
        startWatchingLocation();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [mapStatus, startWatchingLocation]);

  useEffect(() => {
    if (!leafletMapRef.current || !incidentMarkersRef.current || mapStatus !== "ready") return;

    incidentMarkersRef.current.clearLayers();

    incidents.forEach((incident) => {
      if (!incident.location) return;

      const severity = getIncidentSeverity(incident);
      const marker = createCircleMarker(
        incident.location.lat,
        incident.location.lng,
        getSeverityHex(severity),
        10,
        buildIncidentPopup(incident)
      );

      incidentMarkersRef.current?.addLayer(marker);
    });
  }, [incidents, mapStatus]);

  useEffect(() => {
    if (!leafletMapRef.current || mapStatus !== "ready") return;

    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.remove();
      selectedMarkerRef.current = null;
    }

    if (selectedLocation) {
      selectedMarkerRef.current = createCircleMarker(
        selectedLocation.lat,
        selectedLocation.lng,
        SELECTED_REPORT_COLOR,
        12
      );
      selectedMarkerRef.current.addTo(leafletMapRef.current);
    }
  }, [selectedLocation, mapStatus]);

  const handleRefreshLocation = () => {
    userPannedMapRef.current = false;
    userManuallySelectedRef.current = false;
    hasFirstFixRef.current = false;
    lastGeocodedLocationRef.current = null;
    localStorage.removeItem("userLocation");
    localStorage.removeItem("userCity");
    startWatchingLocation({ forceSelect: true, forceCenter: true });
  };

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden" style={{ minHeight: "500px" }}>
      <div ref={mapRef} className="w-full h-full z-0" style={{ minHeight: "500px" }} />

      {mapStatus === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 z-40">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-lg font-medium">Loading map...</p>
          </div>
        </div>
      )}

      {mapStatus === "ready" && locationStatus === "locating" && (
        <div className="absolute top-4 left-4 z-[1000]">
          <Card className="p-3 bg-card/90 backdrop-blur-sm border-primary/30">
            <p className="text-sm font-medium flex items-center gap-2">
              <span className="animate-pulse h-2 w-2 rounded-full" style={{ backgroundColor: USER_LOCATION_COLOR }} />
              Detecting your location...
            </p>
          </Card>
        </div>
      )}

      {locationStatus === "denied" && locationError && (
        <div className="absolute top-4 left-4 right-20 z-[1000]">
          <Card className="p-3 bg-destructive/10 backdrop-blur-sm border-destructive/30">
            <p className="text-sm text-destructive">{locationError}</p>
          </Card>
        </div>
      )}

      {mapStatus === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-red-600 via-red-700 to-red-800 z-40">
          <div className="text-center text-white p-6">
            <h3 className="text-xl font-bold mb-2">Map Failed to Load</h3>
            <Button
              onClick={() => window.location.reload()}
              className="mt-4 bg-white text-red-800 hover:bg-gray-100"
            >
              Retry Loading
            </Button>
          </div>
        </div>
      )}

      <div className="absolute top-4 right-4 z-[1000]">
        <Button
          size="sm"
          onClick={handleRefreshLocation}
          disabled={isLocating}
          className="bg-card/80 backdrop-blur-sm hover:bg-card/90 text-foreground border border-border/50"
        >
          <MapPin className="h-4 w-4 mr-2" />
          {isLocating ? "Locating..." : "Refresh Location"}
        </Button>
      </div>

      <Card className="absolute bottom-4 left-4 p-3 bg-card/80 backdrop-blur-sm z-[1000] max-w-[200px]">
        <div className="text-xs font-medium mb-2">Map legend</div>
        <div className="space-y-2 text-xs">
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">You</div>
            <div className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-full border border-white"
                style={{ backgroundColor: USER_LOCATION_COLOR }}
              />
              <span>Your location</span>
            </div>
            <div className="flex items-center space-x-2">
              <div
                className="w-3.5 h-3.5 rounded-full border border-white"
                style={{ backgroundColor: SELECTED_REPORT_COLOR }}
              />
              <span>New report pin</span>
            </div>
          </div>
          <div className="space-y-1 border-t border-border/50 pt-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Incidents by severity
            </div>
            {[1, 2, 3, 4, 5].map((level) => (
              <div key={level} className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full border border-white"
                  style={{ backgroundColor: getSeverityHex(level) }}
                />
                <span>Level {level} — {getSeverityLabel(level)}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};
