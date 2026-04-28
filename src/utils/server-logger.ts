'use server';

import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const LOG_DIR = process.env.LOG_DIR || '/var/log/app-file-storage';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const streams: Record<string, ReturnType<typeof createWriteStream>> = {};

function getStream(filename: string) {
  if (!streams[filename]) {
    if (!existsSync(LOG_DIR)) {
      mkdirSync(LOG_DIR, { recursive: true });
    }
    streams[filename] = createWriteStream(join(LOG_DIR, filename), { flags: 'a' });
  }
  return streams[filename];
}

function format(level: string, ...args: unknown[]): string {
  return `[${new Date().toISOString()}] [${level}] ${args.map(a =>
    typeof a === 'object' ? JSON.stringify(a, (_, v) => typeof v === 'bigint' ? Number(v) : v) : String(a)
  ).join(' ')}\n`;
}

export function write(level: string, ...args: unknown[]) {
  const msg = format(level, ...args);
  getStream(`app-${todayStr()}.log`).write(msg);
  if (level === 'ERROR' || level === 'WARN') {
    getStream(`error-${todayStr()}.log`).write(msg);
  }
}
