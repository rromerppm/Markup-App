import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MARKER_TYPES } from "@/lib/markerTypes";
import { toMarkerData } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();
  const { pageId, type, x, y, x2, y2, label, note, directions } = body;

  if (
    typeof pageId !== "string" ||
    !MARKER_TYPES.includes(type) ||
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof label !== "string"
  ) {
    return NextResponse.json({ error: "Invalid marker" }, { status: 400 });
  }

  if (type === "SECTION" && (typeof x2 !== "number" || typeof y2 !== "number")) {
    return NextResponse.json({ error: "Section markers need a second endpoint" }, { status: 400 });
  }

  if (
    type === "IE" &&
    (!Array.isArray(directions) ||
      directions.length < 1 ||
      directions.length > 4 ||
      !directions.every((d) => typeof d === "number"))
  ) {
    return NextResponse.json({ error: "IE markers need 1-4 directions" }, { status: 400 });
  }

  const page = await prisma.page.findFirst({
    where: { id: pageId, document: { project: { shareToken: token } } },
    include: { document: { include: { project: true } } },
  });

  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }
  if (page.document.project.status === "submitted") {
    return NextResponse.json(
      { error: "This markup has already been submitted" },
      { status: 403 }
    );
  }

  const marker = await prisma.marker.create({
    data: {
      pageId,
      type,
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
      x2: type === "SECTION" ? Math.min(1, Math.max(0, x2)) : null,
      y2: type === "SECTION" ? Math.min(1, Math.max(0, y2)) : null,
      label,
      note: typeof note === "string" ? note : null,
      directions:
        type === "IE"
          ? { create: directions.map((angle: number, order: number) => ({ angle, order })) }
          : undefined,
    },
    include: { directions: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(toMarkerData(marker));
}
