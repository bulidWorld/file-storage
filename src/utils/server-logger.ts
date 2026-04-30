import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const LOG_DIR = process.env.LOG_DIR || '/var/log/app-file-storage';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function format(level: string, ...args: unknown[]): string {
  return `[${new Date().toISOString()}] [${level}] ${args.map(a =>
    typeof a === 'object' ? JSON.stringify(a, (_, v) => typeof v === 'bigint' ? Number(v) : v) : String(a)
  ).join(' ')}\n`;
}

function ensureDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

export const logger = {
  info(...args: unknown[]) {
    const msg = format('INFO', ...args);
    process.stdout.write(msg);
    ensureDir();
    writeFileSync(join(LOG_DIR, `app-${todayStr()}.log`), msg, { flag: 'a' });
  },
  warn(...args: unknown[]) {
    const msg = format('WARN', ...args);
    process.stderr.write(msg);
    ensureDir();
    writeFileSync(join(LOG_DIR, `app-${todayStr()}.log`), msg, { flag: 'a' });
    writeFileSync(join(LOG_DIR, `error-${todayStr()}.log`), msg, { flag: 'a' });
  },
  error(...args: unknown[]) {
    const msg = format('ERROR', ...args);
    process.stderr.write(msg);
    ensureDir();
    writeFileSync(join(LOG_DIR, `app-${todayStr()}.log`), msg, { flag: 'a' });
    writeFileSync(join(LOG_DIR, `error-${todayStr()}.log`), msg, { flag: 'a' });
  },
  debug(...args: unknown[]) {
    if (process.env.NODE_ENV !== 'production') {
      const msg = format('DEBUG', ...args);
      process.stdout.write(msg);
      ensureDir();
      writeFileSync(join(LOG_DIR, `app-${todayStr()}.log`), msg, { flag: 'a' });
    }
  },
};
