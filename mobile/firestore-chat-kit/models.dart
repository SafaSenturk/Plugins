import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

DateTime? _date(Object? v) => v is Timestamp ? v.toDate() : null;

@immutable
class AppUser {
  const AppUser({
    required this.uid,
    required this.name,
    required this.email,
    this.about = '',
    this.colorIndex = 0,
    this.online = false,
    this.lastSeen,
  });

  final String uid;
  final String name;
  final String email;
  final String about;

  /// Picks the avatar gradient; chosen at sign-up and editable in the profile.
  final int colorIndex;
  final bool online;
  final DateTime? lastSeen;

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    return (parts.first[0] + (parts.length > 1 ? parts.last[0] : '')).toUpperCase();
  }

  factory AppUser.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data() ?? const {};
    return AppUser(
      uid: doc.id,
      name: d['name'] as String? ?? '',
      email: d['email'] as String? ?? '',
      about: d['about'] as String? ?? '',
      colorIndex: (d['colorIndex'] as num?)?.toInt() ?? 0,
      online: d['online'] as bool? ?? false,
      lastSeen: _date(d['lastSeen']),
    );
  }

  @override
  bool operator ==(Object other) =>
      other is AppUser &&
      other.uid == uid &&
      other.name == name &&
      other.about == about &&
      other.colorIndex == colorIndex &&
      other.online == online &&
      other.lastSeen == lastSeen;

  @override
  int get hashCode => Object.hash(uid, name, about, colorIndex, online, lastSeen);
}

@immutable
class LastMessage {
  const LastMessage({required this.text, required this.senderId, this.sentAt, this.deleted = false});

  final String text;
  final String senderId;
  final DateTime? sentAt;
  final bool deleted;
}

@immutable
class Chat {
  const Chat({
    required this.id,
    required this.members,
    this.lastMessage,
    this.updatedAt,
    this.unread = const {},
    this.typing = const {},
  });

  final String id;
  final List<String> members;
  final LastMessage? lastMessage;
  final DateTime? updatedAt;
  final Map<String, int> unread;

  /// Last time each member reported typing.
  final Map<String, DateTime> typing;

  String otherMember(String me) => members.firstWhere((m) => m != me, orElse: () => me);

  int unreadFor(String uid) => unread[uid] ?? 0;

  /// The other member counts as typing if they typed within the last few seconds.
  bool isTyping(String uid, {DateTime? now}) {
    final t = typing[uid];
    return t != null && (now ?? DateTime.now()).difference(t).inSeconds.abs() < 6;
  }

  /// One-to-one chats have a deterministic id, so both users open the same document.
  static String idFor(String a, String b) => a.compareTo(b) < 0 ? '${a}_$b' : '${b}_$a';

  factory Chat.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data() ?? const {};
    final last = d['lastMessage'] as Map<String, dynamic>?;
    return Chat(
      id: doc.id,
      members: (d['members'] as List?)?.cast<String>() ?? const [],
      lastMessage: last == null
          ? null
          : LastMessage(
              text: last['text'] as String? ?? '',
              senderId: last['senderId'] as String? ?? '',
              sentAt: _date(last['sentAt']),
              deleted: last['deleted'] as bool? ?? false,
            ),
      updatedAt: _date(d['updatedAt']),
      unread: {
        for (final e in ((d['unread'] as Map?) ?? const {}).entries)
          e.key as String: (e.value as num).toInt(),
      },
      typing: {
        for (final e in ((d['typing'] as Map?) ?? const {}).entries)
          e.key as String: ?_date(e.value),
      },
    );
  }
}

@immutable
class Message {
  const Message({
    required this.id,
    required this.senderId,
    required this.text,
    this.sentAt,
    this.readAt,
    this.deleted = false,
    this.edited = false,
    this.reactions = const {},
    this.pending = false,
  });

  final String id;
  final String senderId;
  final String text;

  /// Null until the server has stamped the message.
  final DateTime? sentAt;
  final DateTime? readAt;
  final bool deleted;
  final bool edited;

  /// uid → emoji
  final Map<String, String> reactions;

  /// Written locally but not yet confirmed by the server (offline or in flight).
  final bool pending;

  factory Message.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data() ?? const {};
    return Message(
      id: doc.id,
      senderId: d['senderId'] as String? ?? '',
      text: d['text'] as String? ?? '',
      sentAt: _date(d['sentAt']),
      readAt: _date(d['readAt']),
      deleted: d['deleted'] as bool? ?? false,
      edited: d['editedAt'] != null,
      reactions: ((d['reactions'] as Map?) ?? const {}).cast<String, String>(),
      pending: doc.metadata.hasPendingWrites,
    );
  }
}
