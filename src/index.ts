import { main } from "./main";
import config from "./constants/config";
import cron from "node-cron";
import { error } from "./utils/logger";

try {
    if (process.argv.includes("--run-once")) {
        main();
    } else {
        cron.schedule(config.CRON_SCHEDULE, async () => {
            await main();
        });
    }
} catch (err) {
    error(err);
}
