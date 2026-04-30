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

export const logger = {
  info(...args: unknown[]) {
    clientLog('INFO', ...args);
  },
  warn(...args: unknown[]) {
    clientLog('WARN', ...args);
  },
  error(...args: unknown[]) {
    clientLog('ERROR', ...args);
  },
  debug(...args: unknown[]) {
    clientLog('DEBUG', ...args);
  },
};
