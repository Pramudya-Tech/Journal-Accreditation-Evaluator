import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
export const dataDir = resolve(process.env.DATA_DIR || './data');
mkdirSync(dataDir, { recursive:true, mode:0o700 });
export const db = new DatabaseSync(join(dataDir, 'evaluator.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS evaluations(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,title TEXT NOT NULL,payload TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS eval_owner ON evaluations(user_id);
CREATE TABLE IF NOT EXISTS ai_reports(eval_id TEXT NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,criterion_id TEXT NOT NULL,source_hash TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(eval_id,criterion_id));
CREATE TABLE IF NOT EXISTS ai_usage(user_id TEXT NOT NULL,day TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,day));
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,user_id TEXT NOT NULL,eval_id TEXT,action TEXT NOT NULL,created_at TEXT NOT NULL);`);
export const hash = value => createHash('sha256').update(value).digest('hex');
export async function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64, { N:32768,r:8,p:1,maxmem:67108864 });
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  const [,salt,key] = stored.split(':');
  const derived = await derive(password, salt, 64, { N:32768,r:8,p:1,maxmem:67108864 });
  return timingSafeEqual(derived, Buffer.from(key,'hex'));
}
export function audit(userId, evalId, action) { db.prepare('INSERT INTO audit(user_id,eval_id,action,created_at) VALUES(?,?,?,?)').run(userId,evalId,action,new Date().toISOString()); }
