import winston from "winston";
import "winston-daily-rotate-file";
declare const LOG_LEVELS: {
    readonly error: 0;
    readonly warn: 1;
    readonly info: 2;
    readonly debug: 3;
};
type LogLevel = keyof typeof LOG_LEVELS;
declare const logger: winston.Logger;
export declare const setLogLevel: (level: LogLevel) => void;
export declare const debug: (message: string) => winston.Logger;
export declare const info: (message: string) => winston.Logger;
export declare const warn: (message: string) => winston.Logger;
export declare const error: (message: string | Error) => void;
export default logger;
