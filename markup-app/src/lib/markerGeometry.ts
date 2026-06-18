type Point = { x: number; y: number };

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function toSvgPoints(points: Point[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

/** Tip of an IE direction arrow, `size` units out from the marker center along `angleDeg`. */
export function arrowTipPoint(cx: number, cy: number, angleDeg: number, size: number): Point {
  const rad = toRad(angleDeg);
  return { x: cx + Math.cos(rad) * (size * 1.6), y: cy + Math.sin(rad) * (size * 1.6) };
}

/** Triangle pointing outward from (cx,cy) along angleDeg, starting just outside the marker circle. */
export function arrowPolygonPoints(
  cx: number,
  cy: number,
  angleDeg: number,
  size: number
): Point[] {
  const rad = toRad(angleDeg);
  const baseDistance = size * 0.6;
  const tipDistance = size * 1.6;
  const baseHalfWidth = size * 0.45;
  const perpRad = rad + Math.PI / 2;

  const baseCx = cx + Math.cos(rad) * baseDistance;
  const baseCy = cy + Math.sin(rad) * baseDistance;
  const tip = { x: cx + Math.cos(rad) * tipDistance, y: cy + Math.sin(rad) * tipDistance };
  const corner1 = {
    x: baseCx + Math.cos(perpRad) * baseHalfWidth,
    y: baseCy + Math.sin(perpRad) * baseHalfWidth,
  };
  const corner2 = {
    x: baseCx - Math.cos(perpRad) * baseHalfWidth,
    y: baseCy - Math.sin(perpRad) * baseHalfWidth,
  };

  return [tip, corner1, corner2];
}

/** Small flag triangle at a section line endpoint, pointing perpendicular to the line. */
export function sectionFlagPolygonPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  endpoint: "start" | "end",
  flipped: boolean,
  size: number
): Point[] {
  const lineRad = Math.atan2(y2 - y1, x2 - x1);
  const side = flipped ? -1 : 1;
  const viewRad = lineRad + (Math.PI / 2) * side;

  const [x, y] = endpoint === "start" ? [x1, y1] : [x2, y2];
  // Offset the whole flag out along the view direction so its base clears the
  // circular endpoint handle instead of sitting underneath it.
  const baseDistance = size * 1.1;
  const tipDistance = size * 2.3;
  const baseHalf = size * 0.5;

  const baseCx = x + Math.cos(viewRad) * baseDistance;
  const baseCy = y + Math.sin(viewRad) * baseDistance;
  const tip = { x: x + Math.cos(viewRad) * tipDistance, y: y + Math.sin(viewRad) * tipDistance };
  const corner1 = { x: baseCx + Math.cos(lineRad) * baseHalf, y: baseCy + Math.sin(lineRad) * baseHalf };
  const corner2 = { x: baseCx - Math.cos(lineRad) * baseHalf, y: baseCy - Math.sin(lineRad) * baseHalf };

  return [tip, corner1, corner2];
}
