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
    await _userDoc(
      uid,
    ).update({...data, 'updatedAt': FieldValue.serverTimestamp()});
  }

  // --- Courses ---

  CollectionReference _courses(String uid) =>
      _db.collection('users/$uid/courses');

  Stream<List<CourseModel>> watchCourses(String uid) {
    return _courses(uid).snapshots().map(
      (snap) => snap.docs.map((d) => CourseModel.fromFirestore(d)).toList(),
    );
  }

  Future<String> createCourse(String uid, Map<String, dynamic> data) async {
    final ref = await _courses(
      uid,
    ).add({...data, 'createdAt': FieldValue.serverTimestamp()});
    return ref.id;
  }

  Future<CourseModel?> getCourse(String uid, String courseId) async {
    final doc = await _courses(uid).doc(courseId).get();
    if (!doc.exists) return null;
    return CourseModel.fromFirestore(doc);
  }

  Future<void> updateCourse(
    String uid,
    String courseId,
    Map<String, dynamic> data,
  ) async {
    await _courses(uid).doc(courseId).update(data);
  }

  Future<void> deleteCourse(String uid, String courseId) async {
    await _courses(uid).doc(courseId).delete();
  }

  // --- Files ---

  CollectionReference _files(String uid) => _db.collection('users/$uid/files');

  Stream<List<FileModel>> watchFiles(String uid, {String? courseId}) {
    Query query = _files(uid);
    if (courseId != null) {
      query = query.where('courseId', isEqualTo: courseId);
    }
    return query.snapshots().map(
      (snap) => snap.docs.map((d) => FileModel.fromFirestore(d)).toList(),
    );
  }

  Future<String> createFile(
    String uid,
    String fileId,
    Map<String, dynamic> data,
  ) async {
    await _files(uid).doc(fileId).set({
      ...data,
      'uploadedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
    return fileId;
  }

  Future<void> deleteFile(String uid, String fileId) async {
    await _files(uid).doc(fileId).delete();
  }

  // --- Sections ---

  CollectionReference _sections(String uid) =>
      _db.collection('users/$uid/sections');

  Stream<List<SectionModel>> watchSections(
    String uid, {
    required String fileId,
  }) {
    // Single equality filter — no composite index needed. Sort client-side.
    return _sections(uid)
        .where('fileId', isEqualTo: fileId)
        .snapshots()
        .map((snap) {
          final sections =
              snap.docs.map((d) => SectionModel.fromFirestore(d)).toList();
          sections.sort((a, b) => a.orderIndex.compareTo(b.orderIndex));
          return sections;
        });
  }

  Stream<List<SectionModel>> watchSectionsByCourse(
    String uid,
    String courseId,
  ) {
    // Single equality filter — no composite index needed. Sort client-side.
    return _sections(uid)
        .where('courseId', isEqualTo: courseId)
        .snapshots()
        .map((snap) {
          final sections =
              snap.docs.map((d) => SectionModel.fromFirestore(d)).toList();
          sections.sort((a, b) => a.orderIndex.compareTo(b.orderIndex));
          return sections;
        });
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

  CollectionReference _tasks(String uid) => _db.collection('users/$uid/tasks');

  Stream<List<TaskModel>> watchTodayTasks(String uid, String courseId) {
    final now = DateTime.now();
    final startOfDay = DateTime(now.year, now.month, now.day);
    final endOfDay = startOfDay.add(const Duration(days: 1));

    // Filter by courseId only (single-field auto-index, no composite needed).
    // Date range and sort applied client-side.
    return _tasks(uid)
        .where('courseId', isEqualTo: courseId)
        .snapshots()
        .map((snap) {
          final tasks = snap.docs
              .map((d) => TaskModel.fromFirestore(d))
              .where(
                (t) =>
                    !t.dueDate.isBefore(startOfDay) &&
                    t.dueDate.isBefore(endOfDay),
              )
              .toList();
          tasks.sort((a, b) => a.orderIndex.compareTo(b.orderIndex));
          return tasks;
        });
  }

  Stream<List<TaskModel>> watchAllTasks(String uid, String courseId) {
    // Single equality filter on courseId only — no composite index required.
    // Results are sorted client-side by dueDate then orderIndex.
    return _tasks(uid)
        .where('courseId', isEqualTo: courseId)
        .snapshots()
        .map((snap) {
          final tasks =
              snap.docs.map((d) => TaskModel.fromFirestore(d)).toList();
          tasks.sort((a, b) {
            final d = a.dueDate.compareTo(b.dueDate);
            return d != 0 ? d : a.orderIndex.compareTo(b.orderIndex);
          });
          return tasks;
        });
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
    final ref = await _attempts(
      uid,
    ).add({...data, 'createdAt': FieldValue.serverTimestamp()});
    return ref.id;
  }

  // --- Stats ---

  Future<StatsModel?> getStats(String uid, String courseId) async {
    final doc = await _db.doc('users/$uid/stats/$courseId').get();
    if (!doc.exists) return null;
    return StatsModel.fromFirestore(doc);
  }

  Stream<StatsModel?> watchStats(String uid, String courseId) {
    return _db
        .doc('users/$uid/stats/$courseId')
        .snapshots()
        .map((doc) => doc.exists ? StatsModel.fromFirestore(doc) : null);
  }

  // --- Chat Threads ---

  CollectionReference _chatThreads(String uid) =>
      _db.collection('users/$uid/chatThreads');

  CollectionReference _chatMessages(String uid) =>
      _db.collection('users/$uid/chatMessages');

  int _toMillis(dynamic value) {
    if (value is Timestamp) return value.millisecondsSinceEpoch;
    if (value is DateTime) return value.millisecondsSinceEpoch;
    return 0;
  }

  Stream<List<Map<String, dynamic>>> watchChatThreads(
    String uid, {
    String? courseId,
  }) {
    Query query = _chatThreads(uid);
    if (courseId != null && courseId.trim().isNotEmpty) {
      query = query.where('courseId', isEqualTo: courseId.trim());
    }

    return query.snapshots().map((snap) {
      final threads =
          snap.docs.map((d) {
            final data = d.data() as Map<String, dynamic>;
            return {...data, 'id': d.id};
          }).toList();

      threads.sort(
        (a, b) =>
            _toMillis(b['updatedAt']).compareTo(_toMillis(a['updatedAt'])),
      );
      return threads;
    });
  }

  Future<String> createChatThread(
    String uid, {
    required String courseId,
    required String title,
  }) async {
    final ref = await _chatThreads(uid).add({
      'courseId': courseId,
      'title': title,
      'lastMessage': '',
      'messageCount': 0,
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  Stream<List<Map<String, dynamic>>> watchChatMessages(
    String uid,
    String threadId,
  ) {
    return _chatMessages(
      uid,
    ).where('threadId', isEqualTo: threadId).snapshots().map((snap) {
      final messages =
          snap.docs.map((d) {
            final data = d.data() as Map<String, dynamic>;
            return {...data, 'id': d.id};
          }).toList();

      messages.sort(
        (a, b) =>
            _toMillis(a['createdAt']).compareTo(_toMillis(b['createdAt'])),
      );
      return messages;
    });
  }
}
