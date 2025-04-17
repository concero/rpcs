"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const rpcService_1 = require("./services/rpcService");
const config_1 = __importDefault(require("./constants/config"));
const node_cron_1 = __importDefault(require("node-cron"));
try {
    if (process.argv.includes("--run-once")) {
        (0, rpcService_1.runRpcService)();
    }
    else {
        node_cron_1.default.schedule(config_1.default.CRON_SCHEDULE, async () => {
            await (0, rpcService_1.runRpcService)();
        });
    }
}
catch (err) {
    console.error(err);
}
