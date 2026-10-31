import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

export async function uploadFile(
  file: File,
  folder: string,
): Promise<string> {
  const safe = file.name.replace(/[^\w.-]+/g, "_");
  const path = `${folder}/${Date.now()}_${safe}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, {
    contentType: file.type || "image/jpeg",
  });
  return getDownloadURL(storageRef);
}

export async function uploadRemoteImage(
  url: string,
  folder: string,
): Promise<string> {
  if (url.includes("firebasestorage.googleapis.com")) return url;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Téléchargement image impossible (${response.status})`);
  const blob = await response.blob();
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, {
    contentType: blob.type || "image/jpeg",
  });
  return getDownloadURL(storageRef);
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 100);
}
