const serviceAccount = require("./service-account.json");
const admin = require("firebase-admin");
// todo: encrypt service account and pull from cloud
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const db = admin.firestore();

module.exports = { admin, db };
