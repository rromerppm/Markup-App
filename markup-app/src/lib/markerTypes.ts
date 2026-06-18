export type MarkerType = "IE" | "SECTION" | "NOTE";

export const MARKER_TYPES: MarkerType[] = ["IE", "SECTION", "NOTE"];

export const MARKER_TYPE_INFO: Record<
  MarkerType,
  { label: string; shortLabel: string; color: string }
> = {
  IE: { label: "IE Location", shortLabel: "IE", color: "#dc2626" },
  SECTION: { label: "Section Location", shortLabel: "S", color: "#2563eb" },
  NOTE: { label: "Note", shortLabel: "N", color: "#ca8a04" },
};
