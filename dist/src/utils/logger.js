"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.error = exports.warn = exports.info = exports.debug = exports.setLogLevel = void 0;
const winston_1 = __importDefault(require("winston"));
require("winston-daily-rotate-file");
const config_1 = __importDefault(require("../constants/config"));
const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};
const validateLogLevel = (level) => {
    if (level in LOG_LEVELS)
        return level;
    console.warn(`Invalid log level "${level}", defaulting to "info"`);
    return "info";
};
const customFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.colorize(), winston_1.default.format.printf(({ level, message, timestamp }) => {
    return `${timestamp} ${level}: ${message}`;
}));
const fileTransport = new winston_1.default.transports.DailyRotateFile({
    dirname: config_1.default.LOG_DIR,
    filename: "error-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    maxFiles: config_1.default.LOG_MAX_FILES,
    level: "error",
});
const consoleTransport = new winston_1.default.transports.Console({
    format: customFormat,
    level: validateLogLevel(config_1.default.LOG_LEVEL),
});
const logger = winston_1.default.createLogger({
    levels: LOG_LEVELS,
    transports: [fileTransport, consoleTransport],
});
const setLogLevel = (level) => {
    consoleTransport.level = level;
    logger.info(`Log level set to: ${level}`);
};
exports.setLogLevel = setLogLevel;
const debug = (message) => logger.debug(message);
exports.debug = debug;
const info = (message) => logger.info(message);
exports.info = info;
const warn = (message) => logger.warn(message);
exports.warn = warn;
const error = (message) => {
    if (message instanceof Error) {
        logger.error(message.stack || message.message);
    }
    else {
        logger.error(message);
    }
};
exports.error = error;
exports.default = logger;
