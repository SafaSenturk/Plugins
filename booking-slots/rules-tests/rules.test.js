// Firestore security rules tests, run against the local emulator:
//   cd rules-tests && npm ci && npm test
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, deleteDoc, doc, getDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

let env;
const tomorrow = () => Timestamp.fromDate(new Date(Date.now() + 24 * 3600 * 1000));

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-glow',
    firestore: { rules: readFileSync('../firestore.rules', 'utf8') },
  });
});

after(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/owner'), { name: 'Owner', role: 'admin' });
    await setDoc(doc(db, 'users/ann'), { name: 'Ann', role: 'customer', demoOwner: false });
    await setDoc(doc(db, 'users/bob'), { name: 'Bob', role: 'customer', demoOwner: false });
    await setDoc(doc(db, 'services/cut'), { nameEn: 'Cut', price: 500, durationMin: 30 });
    await setDoc(doc(db, 'appointments/annA'), { uid: 'ann', status: 'pending', slotIds: ['elena_20991231_1000'] });
    await setDoc(doc(db, 'slots/elena_20991231_1000'), {
      staffId: 'elena', day: '20991231', time: '1000', uid: 'ann', appointmentId: 'annA',
    });
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();

/** Books one slot the way the app does: appointment + slot in one batch. */
function book(db, uid, { id = 'new', slot = 'elena_20991230_1100', status = 'pending', bookedFor = uid } = {}) {
  const [staffId, day, time] = slot.split('_');
  const batch = writeBatch(db);
  batch.set(doc(db, `appointments/${id}`), {
    uid: bookedFor, status, start: tomorrow(), slotIds: [slot], serviceId: 'cut',
  });
  batch.set(doc(db, `slots/${slot}`), { staffId, day, time, uid, appointmentId: id });
  return batch.commit();
}

describe('profiles', () => {
  test('nobody can make themselves an admin', async () => {
    await assertFails(updateDoc(doc(as('ann'), 'users/ann'), { role: 'admin' }));
    await assertFails(setDoc(doc(as('carl'), 'users/carl'), { name: 'Carl', role: 'admin' }));
    await assertSucceeds(setDoc(doc(as('carl'), 'users/carl'), { name: 'Carl', role: 'customer' }));
  });

  test('users can turn demo owner mode on for themselves only', async () => {
    await assertSucceeds(updateDoc(doc(as('ann'), 'users/ann'), { demoOwner: true }));
    await assertFails(updateDoc(doc(as('ann'), 'users/bob'), { demoOwner: true }));
  });
});

describe('catalog', () => {
  test('is readable but not writable from the app', async () => {
    await assertSucceeds(getDoc(doc(as('ann'), 'services/cut')));
    await assertFails(updateDoc(doc(as('owner'), 'services/cut'), { price: 1 }));
  });
});

describe('booking', () => {
  test('a customer books a free slot for themselves as pending', async () => {
    await assertSucceeds(book(as('bob'), 'bob'));
  });

  test('cannot book for someone else or skip approval', async () => {
    await assertFails(book(as('bob'), 'bob', { bookedFor: 'ann' }));
    await assertFails(book(as('bob'), 'bob', { status: 'confirmed' }));
  });

  test('a taken slot cannot be booked twice', async () => {
    await assertFails(book(as('bob'), 'bob', { slot: 'elena_20991231_1000' }));
  });

  test('slot ids must match their staff, day and time', async () => {
    const db = as('bob');
    const batch = writeBatch(db);
    batch.set(doc(db, 'appointments/x'), { uid: 'bob', status: 'pending', start: tomorrow(), slotIds: ['s'] });
    batch.set(doc(db, 'slots/fake_id'), { staffId: 'elena', day: '20991230', time: '1100', uid: 'bob', appointmentId: 'x' });
    await assertFails(batch.commit());
  });
});

describe('managing bookings', () => {
  test('customers only see their own bookings, the owner sees all', async () => {
    await assertSucceeds(getDoc(doc(as('ann'), 'appointments/annA')));
    await assertFails(getDoc(doc(as('bob'), 'appointments/annA')));
    await assertSucceeds(getDoc(doc(as('owner'), 'appointments/annA')));
  });

  test('a customer can cancel but not confirm their own booking', async () => {
    const ref = doc(as('ann'), 'appointments/annA');
    await assertFails(updateDoc(ref, { status: 'confirmed' }));
    await assertSucceeds(updateDoc(ref, { status: 'cancelled' }));
  });

  test('the owner can confirm any booking', async () => {
    await assertSucceeds(updateDoc(doc(as('owner'), 'appointments/annA'), { status: 'confirmed' }));
  });

  test('demo owner mode only works on your own bookings', async () => {
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'users/ann'), { demoOwner: true }));
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'users/bob'), { demoOwner: true }));
    await assertSucceeds(updateDoc(doc(as('ann'), 'appointments/annA'), { status: 'confirmed' }));
    await assertFails(updateDoc(doc(as('bob'), 'appointments/annA'), { status: 'declined' }));
  });

  test('only the booker or the owner can free a slot', async () => {
    await assertFails(deleteDoc(doc(as('bob'), 'slots/elena_20991231_1000')));
    await assertSucceeds(deleteDoc(doc(as('owner'), 'slots/elena_20991231_1000')));
  });
});
