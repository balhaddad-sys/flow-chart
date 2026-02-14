import { ref, uploadBytesResumable, getDownloadURL, type UploadTask } from "firebase/storage";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { storage, db } from "./client";

const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percent: number;
  state: "running" | "paused" | "success" | "canceled" | "error";
}

function getExtension(mimeType: string): string {
  switch (mimeType) {
    case "application/pdf":
      return "pdf";
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      return "pptx";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "docx";
    default:
      return "bin";
  }
}

export function validateFile(file: File): string | null {
  if (!SUPPORTED_MIME_TYPES.includes(file.type as (typeof SUPPORTED_MIME_TYPES)[number])) {
    return "Unsupported file type. Please upload PDF, PPTX, or DOCX files.";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "File is too large. Maximum size is 100MB.";
  }
  return null;
}

export async function uploadFile(
  uid: string,
  courseId: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ fileId: string; uploadTask: UploadTask }> {
  const fileId = crypto.randomUUID();
  const ext = getExtension(file.type);
  const storagePath = `users/${uid}/uploads/${fileId}.${ext}`;

  // Create Firestore metadata document BEFORE upload (metadata-first pattern)
  const fileRef = doc(db, "users", uid, "files", fileId);
  await setDoc(fileRef, {
    courseId,
    originalName: file.name,
    storagePath,
    sizeBytes: file.size,
    mimeType: file.type,
    meta: {},
    status: "UPLOADED",
    sectionCount: 0,
    uploadedAt: serverTimestamp(),
  });

  // Upload to Storage
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      originalName: file.name,
      uploadedBy: uid,
    },
  });

  if (onProgress) {
    uploadTask.on("state_changed", (snapshot) => {
      onProgress({
        bytesTransferred: snapshot.bytesTransferred,
        totalBytes: snapshot.totalBytes,
        percent: Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        state: snapshot.state,
      });
    });
  }

  // Clean up Firestore doc if upload fails
  uploadTask.catch(async () => {
    await deleteDoc(fileRef).catch(() => {});
  });

  return { fileId, uploadTask };
}

export async function getFileDownloadUrl(storagePath: string): Promise<string> {
  return getDownloadURL(ref(storage, storagePath));
}

/** Read a text file from Cloud Storage via its download URL (avoids CORS issues with getBytes). */
export async function getTextBlob(storagePath: string): Promise<string> {
  const url = await getDownloadURL(ref(storage, storagePath));
  const res = await fetch(url);
  return res.text();
}
