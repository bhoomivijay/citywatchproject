const placeCache = new Map<string, string>();
const pendingLookups = new Map<string, Promise<string>>();

export function formatNearLocation(
  placeName: string | undefined | null,
  lat: number,
  lng: number
): string {
  const coords = `${Number(lat).toFixed(3)}, ${Number(lng).toFixed(3)}`;
  if (!placeName || !placeName.trim()) {
    return `near unknown area (${coords})`;
  }
  return `near ${placeName.trim()} (${coords})`;
}

function cacheKey(lat: number, lng: number): string {
  return `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
}

function uniqueParts(parts: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  for (const part of parts) {
    const cleaned = (part || "").trim();
    if (!cleaned) continue;
    if (!out.length || out[out.length - 1].toLowerCase() !== cleaned.toLowerCase()) {
      out.push(cleaned);
    }
  }
  return out;
}

async function lookupPhoton(lat: number, lng: number): Promise<string> {
  const response = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Photon ${response.status}`);
  const data = await response.json();
  const props = data?.features?.[0]?.properties || {};

  // Prefer precise local cues over broad city names.
  const parts = uniqueParts([
    props.name && props.name.length < 40 ? props.name : undefined,
    props.street,
    props.district,
    props.suburb,
    props.neighbourhood,
    props.city || props.town || props.village,
    props.county,
  ]);

  // Drop tiny generic city-only result if we can compose something better.
  if (parts.length === 0) {
    return props.state || "";
  }

  // Keep 2-3 most useful parts: e.g. "Main Subway, Brammapuram"
  return parts.slice(0, 3).join(", ");
}

async function lookupBigDataCloud(lat: number, lng: number): Promise<string> {
  const url =
    `https://api.bigdatacloud.net/data/reverse-geocode-client` +
    `?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`BigDataCloud ${response.status}`);
  const data = await response.json();

  const admin = Array.isArray(data?.localityInfo?.administrative)
    ? data.localityInfo.administrative
    : [];
  const informative = Array.isArray(data?.localityInfo?.informative)
    ? data.localityInfo.informative
    : [];

  // Prefer finer admin levels (neighbourhood-like) over city/state.
  const byLevel = [...admin]
    .filter((a: any) => typeof a?.name === "string" && a.name.trim())
    .sort((a: any, b: any) => Number(b.adminLevel || 0) - Number(a.adminLevel || 0));

  const fineNames = byLevel
    .map((a: any) => String(a.name).trim())
    .filter((name: string) => !/india|asia|railway|council|subcontinent|mainland/i.test(name));

  const parts = uniqueParts([
    fineNames[0],
    fineNames[1],
    data.locality,
    data.city,
    informative.find((i: any) => /nagar|colony|market|road|street/i.test(String(i?.name || "")))?.name,
  ]);

  return parts.slice(0, 2).join(", ");
}

async function lookupNominatim(lat: number, lng: number): Promise<string> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
      },
    }
  );
  const text = await response.text();
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  const data = JSON.parse(text);
  const address = data?.address || {};
  const parts = uniqueParts([
    data?.name,
    address.amenity,
    address.building,
    [address.house_number, address.road].filter(Boolean).join(" "),
    address.neighbourhood || address.suburb || address.quarter,
    address.village || address.town || address.city || address.municipality,
  ]);
  return parts.slice(0, 3).join(", ");
}

/** Free reverse geocode with multiple providers + cache. */
export async function getNearestPlaceName(lat: number, lng: number): Promise<string> {
  const key = cacheKey(lat, lng);
  if (placeCache.has(key)) {
    return placeCache.get(key)!;
  }
  if (pendingLookups.has(key)) {
    return pendingLookups.get(key)!;
  }

  const lookup = (async () => {
    // Photon first: often returns street / landmark precision.
    const providers = [lookupPhoton, lookupBigDataCloud, lookupNominatim];
    let best = "";

    for (const provider of providers) {
      try {
        const place = (await provider(lat, lng)).trim();
        if (!place) continue;
        // Prefer more specific (comma-separated / longer) results.
        if (!best || place.split(",").length > best.split(",").length || place.length > best.length + 8) {
          best = place;
        }
        // Early exit if we already have street-level detail.
        if (/,/.test(best) || /\b(road|street|nagar|colony|market|subway|lane|avenue|marg)\b/i.test(best)) {
          placeCache.set(key, best);
          return best;
        }
      } catch (error) {
        console.warn("Place provider failed:", error);
      }
    }

    if (best) {
      placeCache.set(key, best);
      return best;
    }
    return "";
  })();

  pendingLookups.set(key, lookup);
  try {
    return await lookup;
  } finally {
    pendingLookups.delete(key);
  }
}

export async function resolveNearLocationLabel(args: {
  lat: number;
  lng: number;
  existingAddress?: string | null;
}): Promise<string> {
  const existing = args.existingAddress?.trim();
  if (
    existing &&
    !/^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(existing) &&
    !existing.toLowerCase().includes("unknown")
  ) {
    const short = existing.split(",").slice(0, 3).join(",").trim() || existing;
    return formatNearLocation(short, args.lat, args.lng);
  }

  const place = await getNearestPlaceName(args.lat, args.lng);
  return formatNearLocation(place || "unknown area", args.lat, args.lng);
}
