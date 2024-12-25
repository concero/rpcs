import runService from "./serviceRunner";
import config from "./config";
import cron from "node-cron";

try {
  if (process.argv.includes("--run-once")) {
    runService();
  } else {
    cron.schedule(config.CRON_SCHEDULE, async () => {
      await runService();
    });
  }
} catch (err) {
  console.error(err);
}
