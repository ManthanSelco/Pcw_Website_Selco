// Tiny storage layer with two backends:
//  - MongoDB (when MONGODB_URI is set)            -> use on the server
//  - JSON file (data/db.json, when it is not set)  -> quick local testing
// Both expose the same small API so the rest of the app doesn't care.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const newId = () => crypto.randomUUID();

function matches(doc, filter = {}) {
  return Object.entries(filter).every(([k, v]) => {
    const val = k.split('.').reduce((o, p) => (o == null ? undefined : o[p]), doc);
    if (v && typeof v === 'object' && '$in' in v) return v.$in.includes(val);
    return val === v;
  });
}

function sortDocs(docs, sort) {
  if (!sort) return docs;
  const [[key, dir]] = Object.entries(sort);
  return docs.sort((a, b) => {
    const x = a[key] ?? '';
    const y = b[key] ?? '';
    if (x < y) return -1 * dir;
    if (x > y) return 1 * dir;
    return 0;
  });
}

const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));

class JsonStore {
  constructor(file) {
    this.file = file;
    this.kind = 'json';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8') || '{}') : {};
  }
  async connect() {}
  async close() {}
  save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
  collection(name) {
    const self = this;
    const list = () => (self.data[name] ||= []);
    return {
      async find(filter = {}, { sort, limit, skip = 0 } = {}) {
        let docs = sortDocs(list().filter((d) => matches(d, filter)), sort);
        docs = docs.slice(skip, limit ? skip + limit : undefined);
        return clone(docs);
      },
      async findOne(filter) {
        return clone(list().find((d) => matches(d, filter)) || null);
      },
      async count(filter = {}) {
        return list().filter((d) => matches(d, filter)).length;
      },
      async insertOne(doc) {
        const d = { _id: newId(), ...doc };
        list().push(d);
        self.save();
        return clone(d);
      },
      async updateOne(filter, set, { upsert = false } = {}) {
        const d = list().find((x) => matches(x, filter));
        if (!d) {
          if (!upsert) return null;
          const n = { ...filter, ...set };
          if (!n._id) n._id = newId();
          list().push(n);
          self.save();
          return clone(n);
        }
        Object.assign(d, set);
        self.save();
        return clone(d);
      },
      async deleteOne(filter) {
        const arr = list();
        const i = arr.findIndex((d) => matches(d, filter));
        if (i === -1) return false;
        arr.splice(i, 1);
        self.save();
        return true;
      },
    };
  }
}

class MongoStore {
  constructor(uri) {
    this.uri = uri;
    this.kind = 'mongo';
  }
  async connect() {
    const { MongoClient } = await import('mongodb');
    this.client = new MongoClient(this.uri, { serverSelectionTimeoutMS: 8000 });
    await this.client.connect();
    this.db = this.client.db(); // database name comes from the URI (…/pcw)
  }
  async close() {
    await this.client?.close();
  }
  collection(name) {
    const c = this.db.collection(name);
    return {
      async find(filter = {}, { sort, limit, skip = 0 } = {}) {
        let cur = c.find(filter);
        if (sort) cur = cur.sort(sort);
        if (skip) cur = cur.skip(skip);
        if (limit) cur = cur.limit(limit);
        return cur.toArray();
      },
      findOne: (filter) => c.findOne(filter),
      count: (filter = {}) => c.countDocuments(filter),
      async insertOne(doc) {
        const d = { _id: newId(), ...doc };
        await c.insertOne(d);
        return d;
      },
      async updateOne(filter, set, { upsert = false } = {}) {
        return c.findOneAndUpdate(filter, { $set: set }, { upsert, returnDocument: 'after' });
      },
      async deleteOne(filter) {
        const r = await c.deleteOne(filter);
        return r.deletedCount > 0;
      },
    };
  }
}

export function createStore({ mongoUri, jsonFile }) {
  return mongoUri ? new MongoStore(mongoUri) : new JsonStore(jsonFile);
}
