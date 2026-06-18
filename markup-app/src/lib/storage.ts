import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";

const STORAGE_DIR = path.join(process.cwd(), "public", "uploads");

/**
 * Local filesystem storage. Swap this module for an S3/R2-backed
 * implementation later without touching callers — they only deal in
 * (key, publicUrl) pairs.
 */
export async function saveFile(key: string, data: Buffer): Promise<string> {
  await mkdir(STORAGE_DIR, { recursive: true });
  await writeFile(path.join(STORAGE_DIR, key), data);
  return `/uploads/${key}`;
}

export async function deleteFile(key: string): Promise<void> {
  await unlink(path.join(STORAGE_DIR, key)).catch(() => {});
}
