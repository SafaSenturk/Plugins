import 'package:cloud_firestore/cloud_firestore.dart';

import 'models.dart';

/// All Firestore reads and writes for profiles, chats and messages.
class ChatRepository {
  ChatRepository(this._db);

  final FirebaseFirestore _db;

  CollectionReference<Map<String, dynamic>> get _users => _db.collection('users');
  CollectionReference<Map<String, dynamic>> get _chats => _db.collection('chats');
  CollectionReference<Map<String, dynamic>> _messages(String chatId) =>
      _chats.doc(chatId).collection('messages');

  // ── Users ──────────────────────────────────────────────────────────────

  Stream<AppUser?> watchUser(String uid) =>
      _users.doc(uid).snapshots().map((d) => d.exists ? AppUser.fromDoc(d) : null);

  /// Everyone except [exceptUid], filtered by name prefix.
  Stream<List<AppUser>> watchPeople({required String exceptUid, String search = ''}) {
    final q = search.trim().toLowerCase();
    Query<Map<String, dynamic>> query = _users.orderBy('nameLower').limit(50);
    if (q.isNotEmpty) {
      query = _users.orderBy('nameLower').startAt([q]).endAt(['$q']).limit(30);
    }
    return query.snapshots().map(
          (s) => s.docs.map(AppUser.fromDoc).where((u) => u.uid != exceptUid).toList(),
        );
  }

  Future<void> updateProfile(String uid, {required String name, required String about, required int colorIndex}) =>
      _users.doc(uid).update({
        'name': name.trim(),
        'nameLower': name.trim().toLowerCase(),
        'about': about.trim(),
        'colorIndex': colorIndex,
      });

  Future<void> setPresence(String uid, {required bool online}) => _users.doc(uid).update({
        'online': online,
        'lastSeen': FieldValue.serverTimestamp(),
      });

  Future<void> addPushToken(String uid, String token) =>
      _users.doc(uid).update({'fcmTokens': FieldValue.arrayUnion([token])});

  Future<void> removePushToken(String uid, String token) =>
      _users.doc(uid).update({'fcmTokens': FieldValue.arrayRemove([token])});

  // ── Chats ──────────────────────────────────────────────────────────────

  Stream<List<Chat>> watchChats(String uid) => _chats
      .where('members', arrayContains: uid)
      .orderBy('updatedAt', descending: true)
      .snapshots()
      .map((s) => s.docs.map(Chat.fromDoc).toList());

  Stream<Chat?> watchChat(String chatId) =>
      _chats.doc(chatId).snapshots().map((d) => d.exists ? Chat.fromDoc(d) : null);

  /// Newest first; the UI shows them in a reversed list.
  Stream<List<Message>> watchMessages(String chatId, {int limit = 60}) => _messages(chatId)
      .orderBy('sentAt', descending: true)
      .limit(limit)
      .snapshots(includeMetadataChanges: true)
      .map((s) => s.docs.map(Message.fromDoc).toList());

  /// Writes the message and updates the chat summary atomically. The chat
  /// document is created by the first message.
  Future<void> sendMessage({required String from, required String to, required String text}) {
    final chatId = Chat.idFor(from, to);
    final batch = _db.batch();
    final members = [from, to]..sort();
    batch.set(
      _chats.doc(chatId),
      {
        'members': members,
        // `deleted` is reset explicitly because merge keeps old nested fields.
        'lastMessage': {
          'text': text,
          'senderId': from,
          'sentAt': FieldValue.serverTimestamp(),
          'deleted': false,
        },
        'updatedAt': FieldValue.serverTimestamp(),
        'unread': {to: FieldValue.increment(1)},
        'typing': {from: FieldValue.delete()},
      },
      SetOptions(merge: true),
    );
    batch.set(_messages(chatId).doc(), {
      'senderId': from,
      'text': text,
      'sentAt': FieldValue.serverTimestamp(),
      'readAt': null,
      'reactions': <String, String>{},
    });
    return batch.commit();
  }

  /// Clears my unread counter and stamps the other person's messages as read.
  Future<void> markRead(String chatId, String me) async {
    final unread = await _messages(chatId).where('readAt', isNull: true).limit(100).get();
    final batch = _db.batch();
    for (final doc in unread.docs) {
      if (doc.data()['senderId'] == me) continue;
      batch.update(doc.reference, {'readAt': FieldValue.serverTimestamp()});
    }
    batch.update(_chats.doc(chatId), {'unread.$me': 0});
    await batch.commit();
  }

  Future<void> setTyping(String chatId, String me, {required bool typing}) => _chats.doc(chatId).update({
        'typing.$me': typing ? FieldValue.serverTimestamp() : FieldValue.delete(),
      });

  /// Soft-deletes a message; if it was the latest one the chat preview is hidden too.
  Future<void> deleteMessage(String chatId, String messageId, {required bool isLatest}) {
    final batch = _db.batch()
      ..update(_messages(chatId).doc(messageId), {'deleted': true, 'text': ''});
    if (isLatest) {
      batch.update(_chats.doc(chatId), {'lastMessage.text': '', 'lastMessage.deleted': true});
    }
    return batch.commit();
  }

  Future<void> editMessage(String chatId, String messageId, String text) =>
      _messages(chatId).doc(messageId).update({
        'text': text,
        'editedAt': FieldValue.serverTimestamp(),
      });

  /// Sets my reaction, or removes it when I pick the same emoji again.
  Future<void> react(String chatId, Message message, String me, String emoji) =>
      _messages(chatId).doc(message.id).update({
        'reactions.$me': message.reactions[me] == emoji ? FieldValue.delete() : emoji,
      });
}
