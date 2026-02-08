import 'dart:convert';
import 'dart:html' as html show window;

/// Local cache for offline-first support using browser localStorage.
/// Caches today's tasks and queues pending mutations for sync.
/// Web-compatible replacement for sqflite.
class LocalCacheService {
  static const String _tasksKey = 'medq_cached_tasks';
  static const String _mutationsKey = 'medq_pending_mutations';
  static const String _mutationIdKey = 'medq_mutation_id_counter';

  // --- Cached Tasks ---

  Future<void> cacheTasks(List<Map<String, dynamic>> tasks) async {
    final existing = _readTasksMap();
    for (final task in tasks) {
      final id = task['id'] as String;
      existing[id] = task;
    }
    _writeTasksMap(existing);
  }

  Future<List<Map<String, dynamic>>> getCachedTasks(String courseId) async {
    final all = _readTasksMap();
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
    final mutations = _readMutations();
    final nextId = _nextMutationId();
    mutations.add({
      'id': nextId,
      'collection': collection,
      'docId': docId,
      'operationType': operationType,
      'data': data,
      'createdAt': DateTime.now().millisecondsSinceEpoch,
    });
    _writeMutations(mutations);
  }

  Future<List<PendingMutation>> getPendingMutations() async {
    final mutations = _readMutations();
    mutations.sort((a, b) =>
        (a['createdAt'] as int).compareTo(b['createdAt'] as int));
    return mutations.map(PendingMutation.fromMap).toList();
  }

  Future<void> clearPendingMutations(List<int> ids) async {
    final mutations = _readMutations();
    final idSet = ids.toSet();
    mutations.removeWhere((m) => idSet.contains(m['id']));
    _writeMutations(mutations);
  }

  Future<void> clearAll() async {
    html.window.localStorage.remove(_tasksKey);
    html.window.localStorage.remove(_mutationsKey);
    html.window.localStorage.remove(_mutationIdKey);
  }

  // --- Internal helpers ---

  Map<String, Map<String, dynamic>> _readTasksMap() {
    final raw = html.window.localStorage[_tasksKey];
    if (raw == null || raw.isEmpty) return {};
    final decoded = jsonDecode(raw) as Map<String, dynamic>;
    return decoded.map(
      (k, v) => MapEntry(k, Map<String, dynamic>.from(v as Map)),
    );
  }

  void _writeTasksMap(Map<String, Map<String, dynamic>> tasks) {
    html.window.localStorage[_tasksKey] = jsonEncode(tasks);
  }

  List<Map<String, dynamic>> _readMutations() {
    final raw = html.window.localStorage[_mutationsKey];
    if (raw == null || raw.isEmpty) return [];
    final decoded = jsonDecode(raw) as List;
    return decoded
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  void _writeMutations(List<Map<String, dynamic>> mutations) {
    html.window.localStorage[_mutationsKey] = jsonEncode(mutations);
  }

  int _nextMutationId() {
    final raw = html.window.localStorage[_mutationIdKey];
    final current = raw != null ? int.parse(raw) : 0;
    final next = current + 1;
    html.window.localStorage[_mutationIdKey] = next.toString();
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
