function _instanceof(left, right) {
    if (right != null && typeof Symbol !== "undefined" && right[Symbol.hasInstance]) {
        return !!right[Symbol.hasInstance](left);
    } else {
        return left instanceof right;
    }
}
import winston from "winston";
import "winston-daily-rotate-file";
import config from "../constants/config";
var LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};
var validateLogLevel = function(level) {
    if (level in LOG_LEVELS) return level;
    console.warn('Invalid log level "'.concat(level, '", defaulting to "info"'));
    return "info";
};
var customFormat = winston.format.combine(winston.format.timestamp(), winston.format.colorize(), winston.format.printf(function(param) {
    var level = param.level, message = param.message, timestamp = param.timestamp;
    return "".concat(timestamp, " ").concat(level, ": ").concat(message);
}));
var fileTransport = new winston.transports.DailyRotateFile({
    dirname: config.LOG_DIR,
    filename: "error-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    maxFiles: config.LOG_MAX_FILES,
    level: "error"
});
var consoleTransport = new winston.transports.Console({
    format: customFormat,
    level: validateLogLevel(config.LOG_LEVEL)
});
var logger = winston.createLogger({
    levels: LOG_LEVELS,
    transports: [
        fileTransport,
        consoleTransport
    ]
});
export var setLogLevel = function(level) {
    consoleTransport.level = level;
    logger.info("Log level set to: ".concat(level));
};
export var debug = function(message) {
    return logger.debug(message);
};
export var info = function(message) {
    return logger.info(message);
};
export var warn = function(message) {
    return logger.warn(message);
};
export var error = function(message) {
    if (_instanceof(message, Error)) {
        logger.error(message.stack || message.message);
    } else {
        logger.error(message);
    }
};
export default logger;
