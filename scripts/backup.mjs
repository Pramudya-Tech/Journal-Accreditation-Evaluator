import { DatabaseSync,backup } from 'node:sqlite';
import { mkdirSync,existsSync } from 'node:fs';
import { resolve,join } from 'node:path';
const source=resolve(process.env.DATA_DIR || './data','evaluator.sqlite');
if(!existsSync(source))throw new Error('Database belum ada. Jalankan aplikasi terlebih dahulu.');
const folder=resolve('backups');mkdirSync(folder,{recursive:true,mode:0o700});
const target=join(folder,`evaluator-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`);
const db=new DatabaseSync(source,{readOnly:true});
try{await backup(db,target);console.log('Backup konsisten dibuat: '+target);}finally{db.close();}
