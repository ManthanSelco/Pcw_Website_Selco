// Runs backend (port 4000) and frontend dev server (port 5173) together.
import { spawn } from 'node:child_process';

const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';
const run = (name, args) => {
  const p = spawn(npm, args, { stdio: 'inherit', shell: isWin });
  p.on('exit', (code) => {
    console.log(`[${name}] stopped (${code})`);
    process.exit(code ?? 0);
  });
  return p;
};

const procs = [run('server', ['run', 'dev', '--prefix', 'server']), run('client', ['run', 'dev', '--prefix', 'client'])];
const stop = () => procs.forEach((p) => p.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
console.log('\nOpen http://localhost:5173\n');
