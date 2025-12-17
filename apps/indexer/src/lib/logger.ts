/**
 * Simple logger utility for Indexer service
 */

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
}

function timestamp() {
  return new Date().toISOString()
}

export function info(message: string, ...args: any[]) {
  console.log(`${colors.cyan}[${timestamp()}] INFO:${colors.reset}`, message, ...args)
}

export function success(message: string, ...args: any[]) {
  console.log(`${colors.green}[${timestamp()}] SUCCESS:${colors.reset}`, message, ...args)
}

export function warn(message: string, ...args: any[]) {
  console.log(`${colors.yellow}[${timestamp()}] WARN:${colors.reset}`, message, ...args)
}

export function error(message: string, ...args: any[]) {
  console.error(`${colors.red}[${timestamp()}] ERROR:${colors.reset}`, message, ...args)
}

export function debug(message: string, ...args: any[]) {
  if (process.env.DEBUG) {
    console.log(`${colors.dim}[${timestamp()}] DEBUG:${colors.reset}`, message, ...args)
  }
}

export function socket(message: string, ...args: any[]) {
  console.log(`${colors.magenta}[${timestamp()}] SOCKET:${colors.reset}`, message, ...args)
}

export function api(method: string, path: string, status: number, duration?: number) {
  const color = status >= 500 ? colors.red : status >= 400 ? colors.yellow : colors.green
  const durationStr = duration ? ` (${duration}ms)` : ""
  console.log(
    `${colors.blue}[${timestamp()}] API:${colors.reset}`,
    `${color}${method}${colors.reset}`,
    path,
    `${color}${status}${colors.reset}${durationStr}`
  )
}

export default {
  info,
  success,
  warn,
  error,
  debug,
  socket,
  api,
}

