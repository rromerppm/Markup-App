"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { loadImageDimensions, rasterizePdf } from "@/lib/clientUpload";

export default function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !name.trim()) return;

    setBusy(true);
    setError(null);

    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const formData = new FormData();
      formData.set("name", name.trim());
      formData.set("originalFilename", file.name);

      if (isPdf) {
        setProgress("Rendering PDF pages...");
        const pages = await rasterizePdf(file);
        formData.set("kind", "pdf");
        formData.set("meta", JSON.stringify(pages.map((p) => ({ width: p.width, height: p.height }))));
        pages.forEach((p, i) => formData.set(`file-${i}`, p.blob, `page-${i}.png`));
      } else {
        setProgress("Reading image...");
        const { width, height } = await loadImageDimensions(file);
        formData.set("kind", "image");
        formData.set("meta", JSON.stringify([{ width, height }]));
        formData.set("file-0", file, file.name);
      }

      setProgress("Uploading...");
      const res = await fetch("/api/projects", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).error ?? "Upload failed");
      const { id } = await res.json();
      router.push(`/staff/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-lg font-semibold">New project</h2>
      <label className="flex flex-col gap-1 text-sm">
        Project name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. 123 Main St - Floors 1-3"
          className="rounded border px-3 py-2"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Site plan (image or PDF)
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="rounded border px-3 py-2"
          required
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy || !file || !name.trim()}
        className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? progress ?? "Working..." : "Create project"}
      </button>
    </form>
  );
}
