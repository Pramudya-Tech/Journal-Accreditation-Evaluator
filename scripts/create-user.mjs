import readline from 'node:readline/promises';
import { Writable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { db,passwordHash } from '../src/db.mjs';
import { credentials,text } from '../src/validation.mjs';
if(!process.stdin.isTTY)throw new Error('Run in an interactive terminal. Passwords are entered privately, not as command arguments.');
const rl=readline.createInterface({input:process.stdin,output:process.stdout});
try {
  const name=await rl.question('Nama lengkap: '),email=await rl.question('Email: ');rl.close();
  let hidden=false;
  const output=new Writable({write(chunk,encoding,done){if(!hidden)process.stdout.write(chunk);done();}});
  const secret=readline.createInterface({input:process.stdin,output,terminal:true});
  process.stdout.write('Kata sandi (12–128 karakter; input disembunyikan): ');hidden=true;const password=await secret.question('');hidden=false;process.stdout.write('\n');
  process.stdout.write('Ulangi kata sandi: ');hidden=true;const confirm=await secret.question('');hidden=false;process.stdout.write('\n');secret.close();
  if(password!==confirm)throw new Error('Kata sandi tidak cocok.');
  const c=credentials({email,password}),n=text(name,120,'Nama',true),existing=db.prepare('SELECT id FROM users WHERE email=?').get(c.email);
  if(existing && !process.argv.includes('--reset'))throw new Error('Akun sudah ada. Gunakan npm run create-user -- --reset untuk reset yang disengaja.');
  const pw=await passwordHash(c.password);
  if(existing){db.prepare('UPDATE users SET password=?,name=? WHERE id=?').run(pw,n,existing.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(existing.id);}
  else db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(randomUUID(),c.email,n,pw,new Date().toISOString());
  console.log(existing?'Kata sandi diperbarui; sesi lama dicabut.':'Akun berhasil dibuat.');
}catch(e){console.error(e.message);process.exitCode=1;}finally{rl.close();db.close();}
