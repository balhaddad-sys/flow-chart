import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  type DocumentData,
  type QueryConstraint,
  type DocumentReference,
  type CollectionReference,
  Timestamp,
} from "firebase/firestore";
import { db } from "./client";
import type { CourseModel } from "../types/course";
import type { FileModel } from "../types/file";
import type { SectionModel } from "../types/section";
import type { TaskModel } from "../types/task";
import type { QuestionModel } from "../types/question";
import type { AttemptModel } from "../types/attempt";
import type { StatsModel } from "../types/stats";
import type { UserModel } from "../types/user";

// --- Collection references ---

function userDoc(uid: string): DocumentReference {
  return doc(db, "users", uid);
}

function userCollection(uid: string, sub: string): CollectionReference {
  return collection(db, "users", uid, sub);
}

// --- Generic helpers ---

function withId<T extends DocumentData>(doc: { id: string; data: () => T | undefined }): T & { id: string } {
  return { ...doc.data()!, id: doc.id };
}

// --- User ---

export function subscribeUser(uid: string, cb: (user: UserModel | null) => void) {
  return onSnapshot(userDoc(uid), (snap) => {
    cb(snap.exists() ? ({ ...snap.data(), uid: snap.id } as UserModel) : null);
  });
}

export async function updateUser(uid: string, data: Partial<Omit<UserModel, "uid">>) {
  await updateDoc(userDoc(uid), { ...data, updatedAt: serverTimestamp() });
}

// --- Courses ---

export function subscribeCourses(uid: string, cb: (courses: CourseModel[]) => void) {
  const q = query(userCollection(uid, "courses"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => withId<CourseModel>(d as never)));
  });
}

export async function getCourse(uid: string, courseId: string): Promise<CourseModel | null> {
  const snap = await getDoc(doc(db, "users", uid, "courses", courseId));
  return snap.exists() ? withId<CourseModel>(snap as never) : null;
}

export async function updateCourse(uid: string, courseId: string, data: Partial<CourseModel>) {
  await updateDoc(doc(db, "users", uid, "courses", courseId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCourse(uid: string, courseId: string) {
  await deleteDoc(doc(db, "users", uid, "courses", courseId));
}

// --- Files ---

export function subscribeFiles(uid: string, courseId: string, cb: (files: FileModel[]) => void) {
  const q = query(
    userCollection(uid, "files"),
    where("courseId", "==", courseId),
    orderBy("uploadedAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => withId<FileModel>(d as never)));
  });
}

export async function getFile(uid: string, fileId: string): Promise<FileModel | null> {
  const snap = await getDoc(doc(db, "users", uid, "files", fileId));
  return snap.exists() ? withId<FileModel>(snap as never) : null;
}

// --- Sections ---

export function subscribeSections(
  uid: string,
  courseId: string,
  cb: (sections: SectionModel[]) => void
) {
  const q = query(
    userCollection(uid, "sections"),
    where("courseId", "==", courseId),
    orderBy("orderIndex", "asc")
  );
  return onSnapshot(q, (snap) => {
    // Sort by fileId then orderIndex to prevent cross-file interleaving
    const sections = snap.docs.map((d) => withId<SectionModel>(d as never));
    sections.sort((a, b) => {
      const fileCompare = (a.fileId ?? "").localeCompare(b.fileId ?? "");
      if (fileCompare !== 0) return fileCompare;
      return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
    });
    cb(sections);
  });
}

export function subscribeSectionsByFile(
  uid: string,
  fileId: string,
  cb: (sections: SectionModel[]) => void
) {
  const q = query(
    userCollection(uid, "sections"),
    where("fileId", "==", fileId),
    orderBy("orderIndex", "asc")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => withId<SectionModel>(d as never)));
  });
}

// --- Tasks ---

export function subscribeTasks(
  uid: string,
  courseId: string,
  cb: (tasks: TaskModel[]) => void,
  constraints?: QueryConstraint[],
  onError?: (err: Error) => void
) {
  const baseConstraints: QueryConstraint[] = [
    where("courseId", "==", courseId),
    orderBy("dueDate", "asc"),
    orderBy("orderIndex", "asc"),
  ];
  const q = query(userCollection(uid, "tasks"), ...baseConstraints, ...(constraints ?? []));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => withId<TaskModel>(d as never)));
    },
    (err) => {
      onError?.(err);
    }
  );
}

export function subscribeTodayTasks(
  uid: string,
  courseId: string,
  cb: (tasks: TaskModel[]) => void,
  onError?: (err: Error) => void
) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const q = query(
    userCollection(uid, "tasks"),
    where("courseId", "==", courseId),
    where("dueDate", ">=", Timestamp.fromDate(startOfDay)),
    where("dueDate", "<", Timestamp.fromDate(endOfDay)),
    orderBy("dueDate", "asc"),
    orderBy("orderIndex", "asc")
  );
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => withId<TaskModel>(d as never)));
    },
    (err) => {
      onError?.(err);
    }
  );
}

export async function updateTask(uid: string, taskId: string, data: Partial<TaskModel>) {
  await updateDoc(doc(db, "users", uid, "tasks", taskId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// --- Questions ---

export function subscribeQuestions(
  uid: string,
  courseId: string,
  sectionId: string,
  cb: (questions: QuestionModel[]) => void
) {
  const q = query(
    userCollection(uid, "questions"),
    where("courseId", "==", courseId),
    where("sectionId", "==", sectionId),
    orderBy("difficulty", "asc")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => withId<QuestionModel>(d as never)));
  });
}

// --- Attempts ---

export function subscribeAttempts(
  uid: string,
  courseId: string,
  cb: (attempts: AttemptModel[]) => void
) {
  const q = query(
    userCollection(uid, "attempts"),
    where("courseId", "==", courseId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => withId<AttemptModel>(d as never)));
  });
}

// --- Stats ---

export function subscribeStats(uid: string, courseId: string, cb: (stats: StatsModel | null) => void) {
  const statsRef = doc(db, "users", uid, "stats", courseId);
  return onSnapshot(statsRef, (snap) => {
    cb(snap.exists() ? ({ ...snap.data(), courseId: snap.id } as StatsModel) : null);
  });
}
