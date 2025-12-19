import config from "../constants/config";
import { info } from "./logger";

export function shouldCommitChanges(modifiedFiles: string[]): boolean {
    if (config.GIT.ENABLE_GIT_SERVICE && modifiedFiles.length > 0) {
        info(`Committing ${modifiedFiles.length} modified files to git repository`);
        return true;
    } else if (!config.GIT.ENABLE_GIT_SERVICE) {
        info("Git service is disabled, skipping commit and push");
        return false;
    } else {
        info("No files were modified, skipping git operations");
        return false;
    }
}
