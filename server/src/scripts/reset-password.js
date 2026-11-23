// npm run reset-password -- NewPassword123   (if you forget the admin password)
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { createStore } from '../lib/store.js';

const pw = process.argv[2];
if (!pw || pw.length < 8) {
  console.error('Give a new password (min 8 characters):  npm run reset-password -- NewPassword123');
  process.exit(1);
}
const store = createStore(config);
await store.connect();
const admins = store.collection('admins');
const [admin] = await admins.find({}, { limit: 1 });
const hash = await bcrypt.hash(pw, 10);
if (admin) await admins.updateOne({ _id: admin._id }, { passwordHash: hash });
else await admins.insertOne({ username: config.adminUsername, passwordHash: hash, createdAt: new Date().toISOString() });
console.log(`Password changed for admin "${admin?.username || config.adminUsername}".`);
await store.close();
