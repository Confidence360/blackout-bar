// /api/wechat-webhook.js

require('dotenv').config();

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Prevent multiple inits on serverless
if (!global._firebaseApp) {
  global._firebaseApp = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { table, status, timestamp } = req.body;

    if (!table || !status) {
      return res.status(400).json({ error: 'Missing required fields: table or status' });
    }

    const orderTime = timestamp ? new Date(timestamp) : new Date();
    const snapshot = await db.collection('orders')
      .where('table', '==', table)
      .where('timestamp', '>=', new Date(orderTime.getTime() - 2 * 60 * 1000))
      .get();

    const batch = db.batch();

    snapshot.forEach(doc => {
      batch.update(doc.ref, { status });
    });

    await batch.commit();

    return res.status(200).json({ message: 'Order(s) updated successfully' });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
