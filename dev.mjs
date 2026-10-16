
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const servers = [
  {
    name: 'backend',
    cwd: path.join(ROOT, 'backend'),
    command: process.execPath,
    args: ['--watch', 'server.js'],
    env: { PORT: '3000' }
  },
  {
    name: 'frontend',
    cwd: path.join(ROOT, 'frontend'),
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'dev', '--', '--host', '0.0.0.0']
  }
];

const children = [];
let stopping = false;

function startServer({ name, cwd, command, args, env = {} }) {
  const isWindows = process.platform === 'win32';
  const child = isWindows && command === 'npm.cmd'
    ? spawn(
        process.env.ComSpec || 'cmd.exe',
        ['/d', '/s', '/c', 'npm run dev -- --host 0.0.0.0'],
        {
          cwd,
          env: { ...process.env, ...env },
          stdio: ['inherit', 'pipe', 'pipe'],
          windowsVerbatimArguments: true
        }
      )
    : spawn(command, args, {
        cwd,
        env: { ...process.env, ...env },
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: false
      });

  children.push(child);

  for (const [stream, label] of [
    [child.stdout, ''],
    [child.stderr, '']
  ]) {
    let buffer = '';

    stream.setEncoding('utf8');
    stream.on('data', chunk => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        console.log(`${name}> ${label}${line}`);
      }
    });

    stream.on('end', () => {
      if (buffer) console.log(`${name}> ${label}${buffer}`);
    });
  }

  child.on('error', error => {
    console.error(`${name}> Failed to start: ${error.message}`);
    shutdown();
  });

  child.on('exit', (code, signal) => {
    console.log(`${name}> exited (code: ${code}, signal: ${signal ?? 'none'})`);

    if (!stopping) {
      shutdown();
    }
  });
}

function shutdown() {
  if (stopping) return;
  stopping = true;

  console.log('\ndev> Stopping all servers...');

  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
      }
    }
  }, 2000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('dev> Starting ESP-RC...\n');

for (const server of servers) {
  startServer(server);
}
