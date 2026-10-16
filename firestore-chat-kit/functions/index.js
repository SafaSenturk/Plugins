// Push notification for every new message.
//
// Deploy with `firebase deploy --only functions` (Cloud Functions require the
// Blaze pay-as-you-go plan). The app already stores each device's FCM token in
// users/{uid}.fcmTokens and opens the right chat when a notification is tapped.
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

exports.notifyNewMessage = onDocumentCreated(
  { document: 'chats/{chatId}/messages/{messageId}', region: 'europe-west1' },
  async (event) => {
    const message = event.data?.data();
    if (!message) return;
    const { chatId } = event.params;
    const db = getFirestore();

    const chat = (await db.doc(`chats/${chatId}`).get()).data();
    const recipientId = chat?.members?.find((m) => m !== message.senderId);
    if (!recipientId) return;

    const [sender, recipient] = await Promise.all([
      db.doc(`users/${message.senderId}`).get(),
      db.doc(`users/${recipientId}`).get(),
    ]);
    const tokens = recipient.get('fcmTokens') ?? [];
    if (tokens.length === 0) return;

    const response = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title: sender.get('name') ?? 'Pulse', body: message.text },
      data: { chatId },
      android: {
        priority: 'high',
        notification: { channelId: 'messages', tag: chatId },
      },
    });

    // Forget tokens of uninstalled apps so the list doesn't grow forever.
    const stale = response.responses
      .map((r, i) => (r.error?.code === 'messaging/registration-token-not-registered' ? tokens[i] : null))
      .filter(Boolean);
    if (stale.length > 0) {
      await recipient.ref.update({ fcmTokens: FieldValue.arrayRemove(...stale) });
    }
  },
);
