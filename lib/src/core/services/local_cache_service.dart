import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Local cache for offline-first support using SharedPreferences.
/// Caches today's tasks and queues pending mutations for sync.
/// Web-compatible replacement for sqflite.
class LocalCacheService {
  static const String _tasksKey = 'medq_cached_tasks';
  static const String _mutationsKey = 'medq_pending_mutations';
  static const String _mutationIdKey = 'medq_mutation_id_counter';

  SharedPreferences? _prefs;

  Future<SharedPreferences> get _preferences async {
    _prefs ??= await SharedPreferences.getInstance();
    return _prefs!;
  }

  // --- Cached Tasks ---

  Future<void> cacheTasks(List<Map<String, dynamic>> tasks) async {
    final prefs = await _preferences;
    final existing = _readTasksMap(prefs);
    for (final task in tasks) {
      final id = task['id'] as String;
      existing[id] = task;
    }
    await prefs.setString(_tasksKey, jsonEncode(existing));
  }

  Future<List<Map<String, dynamic>>> getCachedTasks(String courseId) async {
    final prefs = await _preferences;
    final all = _readTasksMap(prefs);
    return all.values
        .where((t) => t['courseId'] == courseId)
        .toList();
  }

  // --- Pending Mutations ---

  Future<void> addPendingMutation({
    required String collection,
    required String docId,
    required String operationType,
    required Map<String, dynamic> data,
  }) async {
    final prefs = await _preferences;
    final mutations = _readMutations(prefs);
    final nextId = _nextMutationId(prefs);
    mutations.add({
      'id': nextId,
      'collection': collection,
      'docId': docId,
      'operationType': operationType,
      'data': data,
      'createdAt': DateTime.now().millisecondsSinceEpoch,
    });
    await prefs.setString(_mutationsKey, jsonEncode(mutations));
  }

  Future<List<PendingMutation>> getPendingMutations() async {
    final prefs = await _preferences;
    final mutations = _readMutations(prefs);
    mutations.sort((a, b) =>
        (a['createdAt'] as int).compareTo(b['createdAt'] as int));
    return mutations.map(PendingMutation.fromMap).toList();
  }

  Future<void> clearPendingMutations(List<int> ids) async {
    final prefs = await _preferences;
    final mutations = _readMutations(prefs);
    final idSet = ids.toSet();
    mutations.removeWhere((m) => idSet.contains(m['id']));
    await prefs.setString(_mutationsKey, jsonEncode(mutations));
  }

  Future<void> clearAll() async {
    final prefs = await _preferences;
    await prefs.remove(_tasksKey);
    await prefs.remove(_mutationsKey);
    await prefs.remove(_mutationIdKey);
  }

  // --- Internal helpers ---

  Map<String, Map<String, dynamic>> _readTasksMap(SharedPreferences prefs) {
    final raw = prefs.getString(_tasksKey);
    if (raw == null || raw.isEmpty) return {};
    final decoded = jsonDecode(raw) as Map<String, dynamic>;
    return decoded.map(
      (k, v) => MapEntry(k, Map<String, dynamic>.from(v as Map)),
    );
  }

  List<Map<String, dynamic>> _readMutations(SharedPreferences prefs) {
    final raw = prefs.getString(_mutationsKey);
    if (raw == null || raw.isEmpty) return [];
    final decoded = jsonDecode(raw) as List;
    return decoded
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  int _nextMutationId(SharedPreferences prefs) {
    final current = prefs.getInt(_mutationIdKey) ?? 0;
    final next = current + 1;
    prefs.setInt(_mutationIdKey, next);
    return next;
  }
}

class PendingMutation {
  final int id;
  final String collection;
  final String docId;
  final String operationType;
  final Map<String, dynamic> data;
  final DateTime createdAt;

  const PendingMutation({
    required this.id,
    required this.collection,
    required this.docId,
    required this.operationType,
    required this.data,
    required this.createdAt,
  });

  factory PendingMutation.fromMap(Map<String, dynamic> map) {
    return PendingMutation(
      id: map['id'] as int,
      collection: map['collection'] as String,
      docId: map['docId'] as String,
      operationType: map['operationType'] as String,
      data: Map<String, dynamic>.from(map['data'] as Map),
      createdAt:
          DateTime.fromMillisecondsSinceEpoch(map['createdAt'] as int),
    );
  }
}
