import winston from "winston";
import "winston-daily-rotate-file";
import config from "./config";

const transport = new winston.transports.DailyRotateFile({
    dirname: config.LOG_DIR,
    filename: "error-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    maxFiles: config.LOG_MAX_FILES,
    level: "error",
});

const consoleTransport = new winston.transports.Console({
    level: "info",
});

const logger = winston.createLogger({
    transports: [transport, consoleTransport],
});

export default logger;
