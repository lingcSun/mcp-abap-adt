export function createLogger(name: string) {
  const log = (level: string, message: string) => {
    if (process.env.SAP_LOG_LEVEL === "debug")
      process.stderr.write(
        JSON.stringify({ level, service: name, message }) + "\n",
      );
  };
  return {
    error: (m: string, _?: unknown) => log("error", m),
    warn: (m: string, _?: unknown) => log("warn", m),
    info: (m: string, _?: unknown) => log("info", m),
    debug: (m: string, _?: unknown) => log("debug", m),
  };
}
export type Logger = ReturnType<typeof createLogger>;
