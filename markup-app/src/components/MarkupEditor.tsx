"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { MARKER_TYPES, MARKER_TYPE_INFO, type MarkerType } from "@/lib/markerTypes";
import { arrowPolygonPoints, arrowTipPoint, sectionFlagPolygonPoints, toSvgPoints } from "@/lib/markerGeometry";
import type { MarkerData, ProjectData } from "@/lib/types";

type DragTarget =
  | { kind: "point"; markerId: string; field: "primary" | "secondary" }
  | { kind: "direction"; markerId: string; index: number };

type Draft = {
  type: MarkerType;
  start: { x: number; y: number };
  startClient: { x: number; y: number };
  current: { x: number; y: number };
  currentClient: { x: number; y: number };
};

const MIN_SECTION_DRAG_PX = 15;

function emptyCounts(): Record<MarkerType, number> {
  return { IE: 0, SECTION: 0, NOTE: 0 };
}

function countByType(markers: MarkerData[]): Record<MarkerType, number> {
  const counts = emptyCounts();
  for (const m of markers) {
    counts[m.type] += m.type === "IE" ? Math.max(1, m.directions.length) : 1;
  }
  return counts;
}

export default function MarkupEditor({
  token,
  project,
  readOnly = false,
}: {
  token: string;
  project: ProjectData;
  readOnly?: boolean;
}) {
  const [pages, setPages] = useState(project.pages);
  const [status, setStatus] = useState(project.status);
  const [activePageId, setActivePageId] = useState(pages[0]?.id ?? "");
  const [selectedTool, setSelectedTool] = useState<MarkerType | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const locked = readOnly || status === "submitted";
  const activePage = pages.find((p) => p.id === activePageId) ?? pages[0];
  const selectedMarker = activePage?.markers.find((m) => m.id === selectedMarkerId) ?? null;

  const currentPageCounts = useMemo(
    () => countByType(activePage?.markers ?? []),
    [activePage]
  );
  const overallCounts = useMemo(
    () => countByType(pages.flatMap((p) => p.markers)),
    [pages]
  );

  function updatePageMarkers(pageId: string, updater: (markers: MarkerData[]) => MarkerData[]) {
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, markers: updater(p.markers) } : p))
    );
  }

  function relativePosition(clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  }

  function nextLabel(type: MarkerType) {
    const count = (activePage?.markers ?? []).filter((m) => m.type === type).length + 1;
    return `${MARKER_TYPE_INFO[type].label} ${count}`;
  }

  async function patchMarker(markerId: string, body: Record<string, unknown>) {
    try {
      await fetch(`/api/markup/${token}/markers/${markerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      setError("Failed to save change");
    }
  }

  // --- Placing new markers (click-drag draft on the image) ---

  function handleStartDraft(e: React.PointerEvent) {
    if (locked || !selectedTool || !activePage) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const start = relativePosition(e.clientX, e.clientY);
    const startClient = { x: e.clientX, y: e.clientY };
    setDraft({ type: selectedTool, start, startClient, current: start, currentClient: startClient });
  }

  function handleDraftMove(e: React.PointerEvent) {
    if (!draft) return;
    const current = relativePosition(e.clientX, e.clientY);
    const currentClient = { x: e.clientX, y: e.clientY };
    setDraft((prev) => (prev ? { ...prev, current, currentClient } : prev));
  }

  async function handleDraftEnd(e: React.PointerEvent) {
    if (!draft || !activePage) return;
    const final = draft;
    setDraft(null);
    const dist = Math.hypot(
      final.currentClient.x - final.startClient.x,
      final.currentClient.y - final.startClient.y
    );

    let body: Record<string, unknown>;
    if (final.type === "NOTE") {
      body = { pageId: activePage.id, type: "NOTE", x: final.start.x, y: final.start.y, label: nextLabel("NOTE") };
    } else if (final.type === "IE") {
      body = {
        pageId: activePage.id,
        type: "IE",
        x: final.start.x,
        y: final.start.y,
        label: nextLabel("IE"),
        directions: [0, 90, 180, 270],
      };
    } else {
      if (dist < MIN_SECTION_DRAG_PX) return;
      body = {
        pageId: activePage.id,
        type: "SECTION",
        x: final.start.x,
        y: final.start.y,
        x2: final.current.x,
        y2: final.current.y,
        label: nextLabel("SECTION"),
      };
    }

    try {
      const res = await fetch(`/api/markup/${token}/markers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to add marker");
      const marker: MarkerData = await res.json();
      updatePageMarkers(activePage.id, (markers) => [...markers, marker]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add marker");
    }
  }

  // --- Dragging existing geometry (a point, or one IE direction arrow) ---

  function handlePointPointerDown(e: React.PointerEvent, markerId: string, field: "primary" | "secondary") {
    if (locked) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setSelectedMarkerId(markerId);
    setDragTarget({ kind: "point", markerId, field });
  }

  function handleDirectionPointerDown(e: React.PointerEvent, markerId: string, index: number) {
    if (locked) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setSelectedMarkerId(markerId);
    setDragTarget({ kind: "direction", markerId, index });
  }

  function handleDragMove(e: React.PointerEvent) {
    if (!dragTarget || !activePage) return;
    if (dragTarget.kind === "point") {
      const { x, y } = relativePosition(e.clientX, e.clientY);
      updatePageMarkers(activePage.id, (markers) =>
        markers.map((m) =>
          m.id !== dragTarget.markerId ? m : dragTarget.field === "primary" ? { ...m, x, y } : { ...m, x2: x, y2: y }
        )
      );
    } else {
      const marker = activePage.markers.find((m) => m.id === dragTarget.markerId);
      const rect = containerRef.current?.getBoundingClientRect();
      if (!marker || !rect) return;
      const centerClientX = rect.left + marker.x * rect.width;
      const centerClientY = rect.top + marker.y * rect.height;
      const angle = (Math.atan2(e.clientY - centerClientY, e.clientX - centerClientX) * 180) / Math.PI;
      updatePageMarkers(activePage.id, (markers) =>
        markers.map((m) =>
          m.id !== dragTarget.markerId
            ? m
            : { ...m, directions: m.directions.map((a, i) => (i === dragTarget.index ? angle : a)) }
        )
      );
    }
  }

  async function handleDragEnd() {
    if (!dragTarget || !activePage) return;
    const target = dragTarget;
    setDragTarget(null);
    const marker = activePage.markers.find((m) => m.id === target.markerId);
    if (!marker) return;

    if (target.kind === "point") {
      const body = target.field === "primary" ? { x: marker.x, y: marker.y } : { x2: marker.x2, y2: marker.y2 };
      await patchMarker(marker.id, body);
    } else {
      await patchMarker(marker.id, { directions: marker.directions });
    }
  }

  // --- Selected-marker panel actions ---

  async function handleDeleteMarker(markerId: string) {
    if (!activePage) return;
    try {
      const res = await fetch(`/api/markup/${token}/markers/${markerId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to delete marker");
      updatePageMarkers(activePage.id, (markers) => markers.filter((m) => m.id !== markerId));
      setSelectedMarkerId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete marker");
    }
  }

  async function handleNoteChange(markerId: string, note: string) {
    if (!activePage) return;
    updatePageMarkers(activePage.id, (markers) =>
      markers.map((m) => (m.id === markerId ? { ...m, note } : m))
    );
    await patchMarker(markerId, { note });
  }

  async function handleAddDirection(markerId: string) {
    if (!activePage) return;
    const marker = activePage.markers.find((m) => m.id === markerId);
    if (!marker || marker.directions.length >= 4) return;
    const lastAngle = marker.directions[marker.directions.length - 1] ?? 0;
    const directions = [...marker.directions, (lastAngle + 90) % 360];
    updatePageMarkers(activePage.id, (markers) => markers.map((m) => (m.id === markerId ? { ...m, directions } : m)));
    await patchMarker(markerId, { directions });
  }

  async function handleRemoveDirection(markerId: string, index: number) {
    if (!activePage) return;
    const marker = activePage.markers.find((m) => m.id === markerId);
    if (!marker || marker.directions.length <= 1) return;
    const directions = marker.directions.filter((_, i) => i !== index);
    updatePageMarkers(activePage.id, (markers) => markers.map((m) => (m.id === markerId ? { ...m, directions } : m)));
    await patchMarker(markerId, { directions });
  }

  async function handleToggleFlip(markerId: string) {
    if (!activePage) return;
    const marker = activePage.markers.find((m) => m.id === markerId);
    if (!marker) return;
    const flipped = !marker.flipped;
    setSelectedMarkerId(markerId);
    updatePageMarkers(activePage.id, (markers) => markers.map((m) => (m.id === markerId ? { ...m, flipped } : m)));
    await patchMarker(markerId, { flipped });
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/markup/${token}/submit`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to submit");
      setStatus("submitted");
      setSelectedMarkerId(null);
      setSelectedTool(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  const placementHint =
    selectedTool === "NOTE"
      ? "Click the document to place a Note"
      : selectedTool === "IE"
      ? "Click to place an IE Location — it places with all 4 directions; select it afterward to remove the ones you don't need or drag any arrow to re-aim it"
      : selectedTool
      ? `Click and drag on the document to aim the ${MARKER_TYPE_INFO[selectedTool].label}`
      : null;

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {locked && (
        <div className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600">
          {status === "submitted"
            ? "This markup has been submitted and is now read-only."
            : "This markup is read-only."}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto border-b pb-2">
        {pages.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setActivePageId(p.id);
              setSelectedMarkerId(null);
              setSelectedTool(null);
            }}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
              p.id === activePageId
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Page {p.pageNumber}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {!locked && (
          <div className="flex flex-wrap items-center gap-2">
            {MARKER_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedTool(selectedTool === type ? null : type)}
                style={{ borderColor: MARKER_TYPE_INFO[type].color }}
                className={`flex items-center gap-2 rounded-md border-2 px-3 py-1.5 text-sm font-medium ${
                  selectedTool === type ? "bg-gray-900 text-white" : "bg-white text-gray-800"
                }`}
              >
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ background: MARKER_TYPE_INFO[type].color }}
                />
                {MARKER_TYPE_INFO[type].label}
              </button>
            ))}
            {placementHint && <span className="text-sm text-gray-500">{placementHint}</span>}
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-sm">
          {MARKER_TYPES.map((type) => (
            <div key={type} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: MARKER_TYPE_INFO[type].color }}
              />
              <span className="font-semibold">{currentPageCounts[type]}</span>
              <span className="text-gray-500">{MARKER_TYPE_INFO[type].shortLabel} this page</span>
            </div>
          ))}
        </div>
      </div>

      {activePage && (
        <div
          ref={containerRef}
          className="relative inline-block select-none overflow-hidden rounded-lg border bg-gray-50"
        >
          <img
            src={activePage.imagePath}
            alt={`Page ${activePage.pageNumber}`}
            draggable={false}
            onPointerDown={handleStartDraft}
            onPointerMove={handleDraftMove}
            onPointerUp={handleDraftEnd}
            className={`block w-[900px] max-w-full touch-none ${selectedTool ? "cursor-crosshair" : ""}`}
          />

          <svg
            viewBox={`0 0 ${activePage.width} ${activePage.height}`}
            className="absolute inset-0 h-full w-full"
            style={{ pointerEvents: "none" }}
          >
            {activePage.markers.map((m) => {
              if (m.type === "SECTION" && m.x2 != null && m.y2 != null) {
                const x1 = m.x * activePage.width;
                const y1 = m.y * activePage.height;
                const x2 = m.x2 * activePage.width;
                const y2 = m.y2 * activePage.height;
                const flagSize = activePage.width * 0.02;
                return (
                  <g key={m.id}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={MARKER_TYPE_INFO.SECTION.color}
                      strokeWidth={activePage.width * 0.004}
                      style={{ pointerEvents: locked ? "none" : "auto", cursor: "pointer" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFlip(m.id);
                      }}
                    />
                    <polygon
                      points={toSvgPoints(sectionFlagPolygonPoints(x1, y1, x2, y2, "start", m.flipped, flagSize))}
                      fill={MARKER_TYPE_INFO.SECTION.color}
                    />
                    <polygon
                      points={toSvgPoints(sectionFlagPolygonPoints(x1, y1, x2, y2, "end", m.flipped, flagSize))}
                      fill={MARKER_TYPE_INFO.SECTION.color}
                    />
                  </g>
                );
              }
              if (m.type === "IE") {
                const cx = m.x * activePage.width;
                const cy = m.y * activePage.height;
                const size = activePage.width * 0.022;
                const showDeleteBadges = selectedMarkerId === m.id && !locked && m.directions.length > 1;
                return (
                  <g key={m.id}>
                    {m.directions.map((angle, i) => (
                      <polygon
                        key={i}
                        points={toSvgPoints(arrowPolygonPoints(cx, cy, angle, size))}
                        fill={MARKER_TYPE_INFO.IE.color}
                        style={{ pointerEvents: locked ? "none" : "auto", cursor: "grab" }}
                        onPointerDown={(e) => handleDirectionPointerDown(e, m.id, i)}
                        onPointerMove={handleDragMove}
                        onPointerUp={handleDragEnd}
                      />
                    ))}
                    {showDeleteBadges &&
                      m.directions.map((angle, i) => {
                        const tip = arrowTipPoint(cx, cy, angle, size);
                        return (
                          <g
                            key={`del-${i}`}
                            style={{ pointerEvents: "auto", cursor: "pointer" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveDirection(m.id, i);
                            }}
                          >
                            <circle cx={tip.x} cy={tip.y} r={size * 0.32} fill="#dc2626" stroke="white" strokeWidth={size * 0.06} />
                            <text
                              x={tip.x}
                              y={tip.y}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize={size * 0.45}
                              fill="white"
                            >
                              ×
                            </text>
                          </g>
                        );
                      })}
                  </g>
                );
              }
              return null;
            })}

            {draft && draft.type === "SECTION" && (
              <line
                x1={draft.start.x * activePage.width}
                y1={draft.start.y * activePage.height}
                x2={draft.current.x * activePage.width}
                y2={draft.current.y * activePage.height}
                stroke={MARKER_TYPE_INFO.SECTION.color}
                strokeDasharray="6 4"
                strokeWidth={activePage.width * 0.004}
              />
            )}
          </svg>

          {activePage.markers.map((m) => (
            <Fragment key={m.id}>
              <div
                onPointerDown={(e) => handlePointPointerDown(e, m.id, "primary")}
                onPointerMove={handleDragMove}
                onPointerUp={handleDragEnd}
                style={{
                  left: `${m.x * 100}%`,
                  top: `${m.y * 100}%`,
                  background: MARKER_TYPE_INFO[m.type].color,
                  transform: "translate(-50%, -50%)",
                }}
                title={m.label}
                className={`absolute flex h-7 w-7 touch-none items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow ${
                  locked ? "" : "cursor-move"
                } ${selectedMarkerId === m.id ? "ring-2 ring-black ring-offset-1" : ""}`}
              >
                {MARKER_TYPE_INFO[m.type].shortLabel}
              </div>
              {m.type === "SECTION" && m.x2 != null && m.y2 != null && (
                <div
                  onPointerDown={(e) => handlePointPointerDown(e, m.id, "secondary")}
                  onPointerMove={handleDragMove}
                  onPointerUp={handleDragEnd}
                  title={m.label}
                  style={{
                    left: `${m.x2 * 100}%`,
                    top: `${m.y2 * 100}%`,
                    background: MARKER_TYPE_INFO.SECTION.color,
                    transform: "translate(-50%, -50%)",
                  }}
                  className={`absolute h-4 w-4 touch-none rounded-full border-2 border-white shadow ${
                    locked ? "" : "cursor-move"
                  } ${selectedMarkerId === m.id ? "ring-2 ring-black ring-offset-1" : ""}`}
                />
              )}
              {selectedMarkerId === m.id && !locked && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteMarker(m.id);
                  }}
                  title="Delete this marker"
                  style={{
                    left: `${m.x * 100}%`,
                    top: `${m.y * 100}%`,
                    transform: "translate(-50%, -50%) translate(12px, -12px)",
                  }}
                  className="absolute flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white shadow ring-2 ring-white hover:bg-red-700"
                >
                  ×
                </button>
              )}
              {selectedMarkerId === m.id && !locked && m.type === "IE" && m.directions.length < 4 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddDirection(m.id);
                  }}
                  title="Add another direction to this marker"
                  style={{
                    left: `${m.x * 100}%`,
                    top: `${m.y * 100}%`,
                    transform: "translate(-50%, -50%) translate(12px, 12px)",
                  }}
                  className="absolute flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow ring-2 ring-white hover:bg-blue-700"
                >
                  +
                </button>
              )}
            </Fragment>
          ))}
        </div>
      )}

      {selectedMarker && !locked && (
        <div className="rounded-md border bg-white p-3 text-sm shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold">{selectedMarker.label}</span>
            <button
              onClick={() => handleDeleteMarker(selectedMarker.id)}
              className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              Delete marker
            </button>
          </div>

          {selectedMarker.type === "IE" && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-gray-500">
                Directions ({selectedMarker.directions.length}/4) — drag an arrow on the canvas to aim it:
              </span>
              {selectedMarker.directions.map((_, i) => (
                <span key={i} className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-1">
                  Dir {i + 1}
                  {selectedMarker.directions.length > 1 && (
                    <button
                      onClick={() => handleRemoveDirection(selectedMarker.id, i)}
                      className="flex h-4 w-4 items-center justify-center rounded-full text-red-600 hover:bg-red-200"
                      aria-label={`Remove direction ${i + 1}`}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              {selectedMarker.directions.length < 4 && (
                <button
                  onClick={() => handleAddDirection(selectedMarker.id)}
                  className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-gray-50"
                >
                  + Add direction
                </button>
              )}
            </div>
          )}

          {selectedMarker.type === "SECTION" && (
            <p className="mb-2 text-xs text-gray-500">Click the line itself to flip the view direction.</p>
          )}

          <textarea
            key={selectedMarker.id}
            defaultValue={selectedMarker.note ?? ""}
            placeholder="Add a note..."
            onBlur={(e) => handleNoteChange(selectedMarker.id, e.target.value)}
            className="w-full rounded border px-2 py-1"
            rows={2}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <span className="font-medium text-gray-800">Project totals:</span>
          {MARKER_TYPES.map((type) => (
            <span key={type}>
              {MARKER_TYPE_INFO[type].shortLabel}: {overallCounts[type]}
            </span>
          ))}
        </div>
        {!readOnly &&
          (status === "submitted" ? (
            <span className="font-medium text-green-700">Submitted</span>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit markup"}
            </button>
          ))}
      </div>
    </div>
  );
}
