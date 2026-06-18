import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { toProjectData } from "@/lib/types";
import MarkupEditor from "@/components/MarkupEditor";

export default async function StaffProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      documents: {
        include: {
          pages: { include: { markers: { include: { directions: { orderBy: { order: "asc" } } } } } },
        },
      },
    },
  });

  if (!project) notFound();

  const host = (await headers()).get("host");
  const shareUrl = `${process.env.NODE_ENV === "production" ? "https" : "http"}://${host}/markup/${project.shareToken}`;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <p className="mt-1 text-sm text-gray-600">
          Client link:{" "}
          <a href={shareUrl} className="font-medium text-blue-600 underline">
            {shareUrl}
          </a>
        </p>
      </div>
      <MarkupEditor token={project.shareToken} project={toProjectData(project)} readOnly />
    </div>
  );
}
