import Link from "next/link";
import { prisma } from "@/lib/db";
import NewProjectForm from "@/components/NewProjectForm";

export default async function StaffDashboard() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { documents: { include: { pages: { include: { markers: true } } } } },
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-bold">Site Markup Projects</h1>
      <NewProjectForm />

      <div className="flex flex-col gap-2">
        {projects.length === 0 && (
          <p className="text-sm text-gray-500">No projects yet. Create one above.</p>
        )}
        {projects.map((project) => {
          const markerCount = project.documents
            .flatMap((d) => d.pages)
            .flatMap((p) => p.markers).length;
          return (
            <Link
              key={project.id}
              href={`/staff/${project.id}`}
              className="flex items-center justify-between rounded-md border px-4 py-3 hover:bg-gray-50"
            >
              <div>
                <div className="font-medium">{project.name}</div>
                <div className="text-xs text-gray-500">
                  {project.createdAt.toLocaleDateString()} · {markerCount} markers
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  project.status === "submitted"
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {project.status}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
