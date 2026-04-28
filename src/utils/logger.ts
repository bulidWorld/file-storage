function nowStr() {
  return new Date().toISOString();
}

function format(level: string, ...args: unknown[]): string {
  return `[${nowStr()}] [${level}] ${args.map(a =>
    typeof a === 'object' ? JSON.stringify(a, (_, v) => typeof v === 'bigint' ? Number(v) : v) : String(a)
  ).join(' ')}\n`;
}

function clientLog(level: string, ...args: unknown[]) {
  const prefix = `[${nowStr()}] [${level}]`;
  const method = level === 'ERROR' ? console.error
    : level === 'WARN' ? console.warn
      : level === 'DEBUG' ? console.debug
        : console.log;
  method(prefix, ...args);
}

const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

let serverLoggerReady: Promise<{ write(level: string, ...args: unknown[]): void }> | null = null;

async function getServerLogger() {
  if (!serverLoggerReady) {
    serverLoggerReady = import('./server-logger');
  }
  return serverLoggerReady;
}

export const logger = {
  info(...args: unknown[]) {
    if (isNode) {
      getServerLogger().then(m => m.write('INFO', ...args)).catch(() => clientLog('INFO', ...args));
    } else {
      clientLog('INFO', ...args);
    }
  },
  warn(...args: unknown[]) {
    if (isNode) {
      getServerLogger().then(m => m.write('WARN', ...args)).catch(() => clientLog('WARN', ...args));
    } else {
      clientLog('WARN', ...args);
    }
  },
  error(...args: unknown[]) {
    if (isNode) {
      getServerLogger().then(m => m.write('ERROR', ...args)).catch(() => clientLog('ERROR', ...args));
    } else {
      clientLog('ERROR', ...args);
    }
  },
  debug(...args: unknown[]) {
    if (isNode) {
      if (process.env.NODE_ENV !== 'production') {
        getServerLogger().then(m => m.write('DEBUG', ...args)).catch(() => clientLog('DEBUG', ...args));
      }
    } else {
      clientLog('DEBUG', ...args);
    }
  },
};
