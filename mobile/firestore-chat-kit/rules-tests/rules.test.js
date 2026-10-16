// Firestore security rules tests, run against the local emulator:
//   cd rules-tests && npm install && npm test
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

let env;
const chatId = 'alice_bob';

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-pulse',
    firestore: { rules: readFileSync('../firestore.rules', 'utf8') },
  });
});

after(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/alice'), { name: 'Alice' });
    await setDoc(doc(db, 'users/bob'), { name: 'Bob' });
    await setDoc(doc(db, `chats/${chatId}`), { members: ['alice', 'bob'] });
    await setDoc(doc(db, `chats/${chatId}/messages/m1`), { senderId: 'alice', text: 'hi', readAt: null });
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const anonymous = () => env.unauthenticatedContext().firestore();

describe('users', () => {
  test('signed-in users can read profiles, guests cannot', async () => {
    await assertSucceeds(getDoc(doc(as('bob'), 'users/alice')));
    await assertFails(getDoc(doc(anonymous(), 'users/alice')));
  });

  test('a user can only edit their own profile', async () => {
    await assertSucceeds(updateDoc(doc(as('alice'), 'users/alice'), { name: 'Alice B.' }));
    await assertFails(updateDoc(doc(as('bob'), 'users/alice'), { name: 'Hacked' }));
  });
});

describe('chats', () => {
  test('only members can read a chat and its messages', async () => {
    await assertSucceeds(getDoc(doc(as('bob'), `chats/${chatId}`)));
    await assertSucceeds(getDoc(doc(as('bob'), `chats/${chatId}/messages/m1`)));
    await assertFails(getDoc(doc(as('eve'), `chats/${chatId}`)));
    await assertFails(getDoc(doc(as('eve'), `chats/${chatId}/messages/m1`)));
  });

  test('a chat id must match its two members', async () => {
    const db = as('carol');
    await assertSucceeds(setDoc(doc(db, 'chats/alice_carol'), { members: ['alice', 'carol'] }));
    await assertFails(setDoc(doc(db, 'chats/wrong_id'), { members: ['alice', 'carol'] }));
    await assertFails(setDoc(doc(db, 'chats/alice_bob2'), { members: ['alice', 'bob2'] }));
  });

  test('the first message can create the chat in the same batch', async () => {
    const db = as('carol');
    const batch = writeBatch(db);
    batch.set(doc(db, 'chats/alice_carol'), { members: ['alice', 'carol'] });
    batch.set(doc(db, 'chats/alice_carol/messages/x'), {
      senderId: 'carol', text: 'hello', sentAt: serverTimestamp(), readAt: null,
    });
    await assertSucceeds(batch.commit());
  });

  test('members cannot be changed', async () => {
    await assertFails(updateDoc(doc(as('alice'), `chats/${chatId}`), { members: ['alice', 'eve'] }));
  });
});

describe('messages', () => {
  test('you can only send as yourself', async () => {
    const msg = (senderId) => ({ senderId, text: 'yo', readAt: null });
    await assertSucceeds(setDoc(doc(as('bob'), `chats/${chatId}/messages/m2`), msg('bob')));
    await assertFails(setDoc(doc(as('bob'), `chats/${chatId}/messages/m3`), msg('alice')));
  });

  test('messages must have 1–2000 characters', async () => {
    const db = as('bob');
    await assertFails(setDoc(doc(db, `chats/${chatId}/messages/e`), { senderId: 'bob', text: '' }));
    await assertFails(setDoc(doc(db, `chats/${chatId}/messages/l`), { senderId: 'bob', text: 'x'.repeat(2001) }));
  });

  test('the recipient can mark as read and react, but not edit the text', async () => {
    const ref = doc(as('bob'), `chats/${chatId}/messages/m1`);
    await assertSucceeds(updateDoc(ref, { readAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { 'reactions.bob': '🔥' }));
    await assertFails(updateDoc(ref, { text: 'changed by bob' }));
  });

  test('the sender can edit and delete their own message', async () => {
    const ref = doc(as('alice'), `chats/${chatId}/messages/m1`);
    await assertSucceeds(updateDoc(ref, { text: 'hi there', editedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { deleted: true, text: '' }));
  });

  test('outsiders cannot write into a chat', async () => {
    await assertFails(setDoc(doc(as('eve'), `chats/${chatId}/messages/m9`), { senderId: 'eve', text: 'spam' }));
  });
});
