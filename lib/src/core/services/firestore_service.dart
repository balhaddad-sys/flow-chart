import 'package:cloud_firestore/cloud_firestore.dart';

import '../../models/course_model.dart';
import '../../models/file_model.dart';
import '../../models/question_model.dart';
import '../../models/section_model.dart';
import '../../models/stats_model.dart';
import '../../models/task_model.dart';
import '../../models/user_model.dart';

class FirestoreService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  // --- User ---

  DocumentReference _userDoc(String uid) => _db.doc('users/$uid');

  Future<UserModel?> getUser(String uid) async {
    final doc = await _userDoc(uid).get();
    if (!doc.exists) return null;
    return UserModel.fromFirestore(doc);
  }

  Future<void> createUser(String uid, Map<String, dynamic> data) async {
    await _userDoc(uid).set({
      ...data,
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> updateUser(String uid, Map<String, dynamic> data) async {
    await _userDoc(uid).update({
      ...data,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  // --- Courses ---

  CollectionReference _courses(String uid) =>
      _db.collection('users/$uid/courses');

  Stream<List<CourseModel>> watchCourses(String uid) {
    return _courses(uid).snapshots().map(
          (snap) =>
              snap.docs.map((d) => CourseModel.fromFirestore(d)).toList(),
        );
  }

  Future<String> createCourse(String uid, Map<String, dynamic> data) async {
    final ref = await _courses(uid).add({
      ...data,
      'createdAt': FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  Future<void> updateCourse(
    String uid,
    String courseId,
    Map<String, dynamic> data,
  ) async {
    await _courses(uid).doc(courseId).update(data);
  }

  // --- Files ---

  CollectionReference _files(String uid) =>
      _db.collection('users/$uid/files');

  Stream<List<FileModel>> watchFiles(String uid, {String? courseId}) {
    Query query = _files(uid);
    if (courseId != null) {
      query = query.where('courseId', isEqualTo: courseId);
    }
    return query.snapshots().map(
          (snap) =>
              snap.docs.map((d) => FileModel.fromFirestore(d)).toList(),
        );
  }

  Future<String> createFile(String uid, Map<String, dynamic> data) async {
    final ref = await _files(uid).add({
      ...data,
      'uploadedAt': FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  // --- Sections ---

  CollectionReference _sections(String uid) =>
      _db.collection('users/$uid/sections');

  Stream<List<SectionModel>> watchSections(
    String uid, {
    required String fileId,
  }) {
    return _sections(uid)
        .where('fileId', isEqualTo: fileId)
        .orderBy('orderIndex')
        .snapshots()
        .map(
          (snap) =>
              snap.docs.map((d) => SectionModel.fromFirestore(d)).toList(),
        );
  }

  Future<SectionModel?> getSection(String uid, String sectionId) async {
    final doc = await _sections(uid).doc(sectionId).get();
    if (!doc.exists) return null;
    return SectionModel.fromFirestore(doc);
  }

  // --- Files (single) ---

  Future<FileModel?> getFile(String uid, String fileId) async {
    final doc = await _files(uid).doc(fileId).get();
    if (!doc.exists) return null;
    return FileModel.fromFirestore(doc);
  }

  // --- Tasks ---

  CollectionReference _tasks(String uid) =>
      _db.collection('users/$uid/tasks');

  Stream<List<TaskModel>> watchTodayTasks(String uid, String courseId) {
    final now = DateTime.now();
    final startOfDay = DateTime(now.year, now.month, now.day);
    final endOfDay = startOfDay.add(const Duration(days: 1));

    return _tasks(uid)
        .where('courseId', isEqualTo: courseId)
        .where('dueDate', isGreaterThanOrEqualTo: Timestamp.fromDate(startOfDay))
        .where('dueDate', isLessThan: Timestamp.fromDate(endOfDay))
        .orderBy('dueDate')
        .orderBy('orderIndex')
        .snapshots()
        .map(
          (snap) =>
              snap.docs.map((d) => TaskModel.fromFirestore(d)).toList(),
        );
  }

  Stream<List<TaskModel>> watchAllTasks(String uid, String courseId) {
    return _tasks(uid)
        .where('courseId', isEqualTo: courseId)
        .orderBy('dueDate')
        .orderBy('orderIndex')
        .snapshots()
        .map(
          (snap) =>
              snap.docs.map((d) => TaskModel.fromFirestore(d)).toList(),
        );
  }

  Future<void> updateTask(
    String uid,
    String taskId,
    Map<String, dynamic> data,
  ) async {
    await _tasks(uid).doc(taskId).update(data);
  }

  Future<void> completeTask(String uid, String taskId) async {
    await _tasks(uid).doc(taskId).update({
      'status': 'DONE',
      'completedAt': FieldValue.serverTimestamp(),
    });
  }

  // --- Questions ---

  CollectionReference _questions(String uid) =>
      _db.collection('users/$uid/questions');

  Future<List<QuestionModel>> getQuestions(
    String uid, {
    required String courseId,
    String? sectionId,
    int limit = 20,
  }) async {
    Query query = _questions(uid).where('courseId', isEqualTo: courseId);
    if (sectionId != null) {
      query = query.where('sectionId', isEqualTo: sectionId);
    }
    final snap = await query.limit(limit).get();
    return snap.docs.map((d) => QuestionModel.fromFirestore(d)).toList();
  }

  // --- Attempts ---

  CollectionReference _attempts(String uid) =>
      _db.collection('users/$uid/attempts');

  Future<String> createAttempt(String uid, Map<String, dynamic> data) async {
    final ref = await _attempts(uid).add({
      ...data,
      'createdAt': FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  // --- Stats ---

  Future<StatsModel?> getStats(String uid, String courseId) async {
    final doc =
        await _db.doc('users/$uid/stats/$courseId').get();
    if (!doc.exists) return null;
    return StatsModel.fromFirestore(doc);
  }

  Stream<StatsModel?> watchStats(String uid, String courseId) {
    return _db
        .doc('users/$uid/stats/$courseId')
        .snapshots()
        .map((doc) => doc.exists ? StatsModel.fromFirestore(doc) : null);
  }
}
