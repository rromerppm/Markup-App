import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { toProjectData } from "@/lib/types";
import MarkupEditor from "@/components/MarkupEditor";

export default async function MarkupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const project = await prisma.project.findUnique({
    where: { shareToken: token },
    include: {
      documents: {
        include: {
          pages: { include: { markers: { include: { directions: { orderBy: { order: "asc" } } } } } },
        },
      },
    },
  });

  if (!project) notFound();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <p className="mt-1 text-sm text-gray-600">
          Place IE and Section markers on the plan below, then submit when you&apos;re done.
        </p>
      </div>
      <MarkupEditor token={token} project={toProjectData(project)} />
    </div>
  );
}
