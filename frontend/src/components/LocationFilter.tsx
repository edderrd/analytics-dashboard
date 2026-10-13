import { Filter } from 'lucide-react';

/** Sentinel for "no filter" in both the URL and the <select>. */
export const ALL_LOCATIONS = '';

/**
 * Location picker: "All locations" plus one option per site.
 *
 * A native `<select>` is used deliberately over the Radix-based shadcn Select:
 * it is keyboard- and screen-reader-native without extra ARIA wiring, it works
 * reliably in jsdom for tests, and it adds no dependency. Styling comes from
 * Tailwind and sits inside the shadcn Card/Badge vocabulary (PLAN.md R15).
 */
export function LocationFilter({
  locations,
  value,
  onChange,
  disabled = false,
}: {
  locations: string[];
  value: string;
  onChange: (location: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="location-filter"
        className="inline-flex items-center gap-1.5 text-sm font-medium"
      >
        <Filter className="size-4" aria-hidden="true" />
        Location
      </label>
      <select
        id="location-filter"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value={ALL_LOCATIONS}>All locations</option>
        {locations.map((location) => (
          <option key={location} value={location}>
            {location}
          </option>
        ))}
      </select>
    </div>
  );
}