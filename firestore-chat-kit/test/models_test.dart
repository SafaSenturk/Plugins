import 'package:flutter_test/flutter_test.dart';

import '../models.dart';

void main() {
  group('Chat', () {
    test('one-to-one chat ids do not depend on who starts the chat', () {
      expect(Chat.idFor('alice', 'bob'), 'alice_bob');
      expect(Chat.idFor('bob', 'alice'), 'alice_bob');
    });

    test('finds the other member and their unread count', () {
      const chat = Chat(id: 'a_b', members: ['a', 'b'], unread: {'a': 3});
      expect(chat.otherMember('a'), 'b');
      expect(chat.otherMember('b'), 'a');
      expect(chat.unreadFor('a'), 3);
      expect(chat.unreadFor('b'), 0);
    });

    test('typing expires after a few seconds without a new ping', () {
      final now = DateTime(2026, 10, 16, 12);
      final chat = Chat(id: 'a_b', members: const ['a', 'b'], typing: {'b': now.subtract(const Duration(seconds: 2))});
      expect(chat.isTyping('b', now: now), isTrue);
      expect(chat.isTyping('b', now: now.add(const Duration(seconds: 10))), isFalse);
      expect(chat.isTyping('a', now: now), isFalse);
    });
  });
}
