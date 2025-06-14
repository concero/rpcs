import { runRpcService } from "./services/rpcService";
import config from "./constants/config";
import cron from "node-cron";

try {
  if (process.argv.includes("--run-once")) {
    runRpcService();
  } else {
    cron.schedule(config.CRON_SCHEDULE, async () => {
      await runRpcService();
    });
  }
} catch (err) {
  console.error(err);
}
