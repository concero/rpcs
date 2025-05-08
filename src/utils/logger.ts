import winston from "winston";
import "winston-daily-rotate-file";
import config from "../constants/config";

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

const validateLogLevel = (level: string): LogLevel => {
  if (level in LOG_LEVELS) return level as LogLevel;
  // Use standard output instead of logger to avoid circular dependency
  process.stderr.write(`Warning: Invalid log level "${level}", defaulting to "info"\n`);
  return "info";
};

const customFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp }) => {
    return `${timestamp} ${level}: ${message}`;
  }),
);

const fileTransport = new winston.transports.DailyRotateFile({
  dirname: config.LOG_DIR,
  filename: "error-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  maxFiles: config.LOG_MAX_FILES,
  level: "error",
});

const consoleTransport = new winston.transports.Console({
  format: customFormat,
  level: validateLogLevel(config.LOG_LEVEL),
});

const logger = winston.createLogger({
  levels: LOG_LEVELS,
  transports: [fileTransport, consoleTransport],
});

export const setLogLevel = (level: LogLevel) => {
  consoleTransport.level = level;
  logger.info(`Log level set to: ${level}`);
};

export const debug = (message: string) => logger.debug(message);
export const info = (message: string) => logger.info(message);
export const warn = (message: string) => logger.warn(message);
export const error = (message: string | Error) => {
  if (message instanceof Error) {
    logger.error(message.stack || message.message);
  } else {
    logger.error(message);
  }
};

export default logger;
