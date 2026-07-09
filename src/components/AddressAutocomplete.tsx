import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";
import { GeocodedAddress, searchAddressSuggestions } from "@/lib/location-label";
import { cn } from "@/lib/utils";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: GeocodedAddress) => void;
  bias?: { lat: number; lng: number };
  placeholder?: string;
  id?: string;
  className?: string;
  externalLoading?: boolean;
}

export const AddressAutocomplete = ({
  value,
  onChange,
  onSelect,
  bias,
  placeholder = "Search for an address or place",
  id,
  className,
  externalLoading = false,
}: AddressAutocompleteProps) => {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<GeocodedAddress[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const skipSearchRef = useRef(false);

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }

    const query = value.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchAddressSuggestions(query, { bias, limit: 6 });
        setSuggestions(results);
        setIsOpen(results.length > 0);
        setActiveIndex(-1);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [value, bias?.lat, bias?.lng]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (suggestion: GeocodedAddress) => {
    skipSearchRef.current = true;
    onChange(suggestion.displayName);
    onSelect(suggestion);
    setSuggestions([]);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const showDropdown = isOpen && suggestions.length > 0;
  const loading = isSearching || externalLoading;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={cn("bg-muted/50 border-border/50 pr-10", className)}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-[10050] mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-border bg-card shadow-sm"
        >
          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion.lat}-${suggestion.lng}-${index}`} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors",
                  index === activeIndex ? "bg-muted" : "hover:bg-muted/60"
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(suggestion)}
              >
                <MapPin className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground truncate">
                    {suggestion.label || suggestion.displayName}
                  </span>
                  {suggestion.subtitle && (
                    <span className="block text-xs text-muted-foreground truncate">{suggestion.subtitle}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
