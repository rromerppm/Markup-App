import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { deleteFile } from "@/lib/storage";

// Cleans up files that were uploaded directly to Blob from the browser but
// never made it into a project (e.g. the page-metadata POST to /api/projects
// failed after the files were already up) — otherwise they'd be orphaned.
export async function DELETE(request: Request) {
  const { urls } = (await request.json()) as { urls?: string[] };
  if (Array.isArray(urls)) {
    await Promise.all(urls.map((url) => deleteFile(url)));
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/png"],
        addRandomSuffix: false,
      }),
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload token generation failed" },
      { status: 400 }
    );
  }
}
