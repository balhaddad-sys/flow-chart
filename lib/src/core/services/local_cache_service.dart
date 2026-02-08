import 'dart:convert';

import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart' as p;

/// Local SQLite cache for offline-first support.
/// Caches today's tasks and queues pending mutations for sync.
class LocalCacheService {
  static const String _dbName = 'medq_cache.db';
  static const int _dbVersion = 1;

  Database? _db;

  Future<Database> get database async {
    _db ??= await _initDb();
    return _db!;
  }

  Future<Database> _initDb() async {
    final dbPath = await getDatabasesPath();
    final path = p.join(dbPath, _dbName);

    return openDatabase(
      path,
      version: _dbVersion,
      onCreate: _onCreate,
    );
  }

  Future<void> _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE cached_tasks (
        id TEXT PRIMARY KEY,
        courseId TEXT NOT NULL,
        data TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    ''');

    await db.execute('''
      CREATE TABLE pending_mutations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection TEXT NOT NULL,
        docId TEXT NOT NULL,
        operationType TEXT NOT NULL,
        data TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      )
    ''');
  }

  // --- Cached Tasks ---

  Future<void> cacheTasks(List<Map<String, dynamic>> tasks) async {
    final db = await database;
    final batch = db.batch();
    for (final task in tasks) {
      batch.insert(
        'cached_tasks',
        {
          'id': task['id'],
          'courseId': task['courseId'],
          'data': jsonEncode(task),
          'updatedAt': DateTime.now().millisecondsSinceEpoch,
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  Future<List<Map<String, dynamic>>> getCachedTasks(String courseId) async {
    final db = await database;
    final results = await db.query(
      'cached_tasks',
      where: 'courseId = ?',
      whereArgs: [courseId],
    );
    return results
        .map((r) => jsonDecode(r['data'] as String) as Map<String, dynamic>)
        .toList();
  }

  // --- Pending Mutations ---

  Future<void> addPendingMutation({
    required String collection,
    required String docId,
    required String operationType,
    required Map<String, dynamic> data,
  }) async {
    final db = await database;
    await db.insert('pending_mutations', {
      'collection': collection,
      'docId': docId,
      'operationType': operationType,
      'data': jsonEncode(data),
      'createdAt': DateTime.now().millisecondsSinceEpoch,
    });
  }

  Future<List<PendingMutation>> getPendingMutations() async {
    final db = await database;
    final results = await db.query(
      'pending_mutations',
      orderBy: 'createdAt ASC',
    );
    return results.map(PendingMutation.fromRow).toList();
  }

  Future<void> clearPendingMutations(List<int> ids) async {
    final db = await database;
    final placeholders = ids.map((_) => '?').join(',');
    await db.delete(
      'pending_mutations',
      where: 'id IN ($placeholders)',
      whereArgs: ids,
    );
  }

  Future<void> clearAll() async {
    final db = await database;
    await db.delete('cached_tasks');
    await db.delete('pending_mutations');
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

  factory PendingMutation.fromRow(Map<String, dynamic> row) {
    return PendingMutation(
      id: row['id'] as int,
      collection: row['collection'] as String,
      docId: row['docId'] as String,
      operationType: row['operationType'] as String,
      data: jsonDecode(row['data'] as String) as Map<String, dynamic>,
      createdAt: DateTime.fromMillisecondsSinceEpoch(row['createdAt'] as int),
    );
  }
}
