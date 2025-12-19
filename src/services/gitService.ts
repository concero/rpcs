import simpleGit, { CheckRepoActions, SimpleGit } from "simple-git";
import { promises as fs } from "fs";
import path from "path";
import { debug, error, info, warn } from "../utils/logger";
import config from "../constants/config";

/**
 * Custom error classes for git operations
 */
class GitServiceError extends Error {
    constructor(
        message: string,
        public readonly operation: string,
        public readonly cause?: Error,
    ) {
        super(message);
        this.name = "GitServiceError";
    }
}

class GitAuthenticationError extends GitServiceError {
    constructor(message: string, cause?: Error) {
        super(message, "authentication", cause);
        this.name = "GitAuthenticationError";
    }
}

class GitRepositoryError extends GitServiceError {
    constructor(message: string, cause?: Error) {
        super(message, "repository", cause);
        this.name = "GitRepositoryError";
    }
}

/**
 * Git service configuration interface
 */
interface GitServiceConfig {
    repoPath: string;
    commitMessage?: string;
    authorName?: string;
    authorEmail?: string;
    branch?: string;
    dryRun?: boolean;
}

/**
 * Git operation result interface
 */
interface GitOperationResult {
    success: boolean;
    filesAdded: string[];
    commitHash?: string;
    pushedToRemote: boolean;
    message: string;
}

/**
 * Get validated git configuration
 */
function getGitConfig(repoPath: string): GitServiceConfig {
    const gitConfig = config.GIT;

    return {
        repoPath,
        commitMessage:
            gitConfig.COMMIT_MESSAGE || `Update chain RPC files ${new Date().toISOString()}`,
        authorName: gitConfig.AUTHOR_NAME || "RPC Service",
        authorEmail: gitConfig.AUTHOR_EMAIL || "rpcs@concero.io",
        branch: gitConfig.BRANCH || "main",
        dryRun: gitConfig.DRY_RUN || false,
    };
}

/**
 * Validate that a path exists and is accessible
 */
async function validatePath(filePath: string): Promise<void> {
    try {
        await fs.access(filePath);
    } catch (err) {
        throw new GitServiceError(
            `Path does not exist or is not accessible: ${filePath}`,
            "validation",
            err instanceof Error ? err : undefined,
        );
    }
}

/**
 * Validate that the repository path is a valid git repository
 */
async function validateGitRepository(git: SimpleGit): Promise<void> {
    try {
        const isRepo = await git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT);
        if (!isRepo) {
            throw new GitRepositoryError("Directory is not a git repository root");
        }
    } catch (err) {
        throw new GitRepositoryError(
            "Failed to validate git repository",
            err instanceof Error ? err : undefined,
        );
    }
}

/**
 * Validate that files exist and are within the repository
 */
async function validateModifiedFiles(modifiedFiles: string[], repoPath: string): Promise<string[]> {
    const validFiles: string[] = [];

    for (const file of modifiedFiles) {
        try {
            // Resolve the full path
            const fullPath = path.resolve(repoPath, file);

            // Check if file exists
            await validatePath(fullPath);

            // Check if file is within the repository
            const relativePath = path.relative(repoPath, fullPath);
            if (relativePath.startsWith("..")) {
                warn(`File outside repository ignored: ${file}`);
                continue;
            }

            validFiles.push(file);
        } catch (err) {
            warn(`Invalid file ignored: ${file} - ${err}`);
        }
    }

    return validFiles;
}

/**
 * Check git repository status and handle any conflicts
 */
async function checkRepositoryStatus(git: SimpleGit): Promise<void> {
    try {
        const status = await git.status();

        if (status.conflicted.length > 0) {
            throw new GitRepositoryError(
                `Repository has merge conflicts: ${status.conflicted.join(", ")}`,
            );
        }

        if (status.files.length > 100) {
            warn(`Repository has many uncommitted changes: ${status.files.length} files`);
        }

        debug(`Repository status: ${status.files.length} changes, branch: ${status.current}`);
    } catch (err) {
        throw new GitRepositoryError(
            "Failed to check repository status",
            err instanceof Error ? err : undefined,
        );
    }
}

/**
 * Configure git user for the commit
 */
async function configureGitUser(git: SimpleGit, config: GitServiceConfig): Promise<void> {
    try {
        if (config.authorName) {
            await git.addConfig("user.name", config.authorName);
        }

        if (config.authorEmail) {
            await git.addConfig("user.email", config.authorEmail);
        }
    } catch (err) {
        throw new GitServiceError(
            "Failed to configure git user",
            "configuration",
            err instanceof Error ? err : undefined,
        );
    }
}

/**
 * Add files to git staging area
 */
async function addFilesToGit(git: SimpleGit, files: string[]): Promise<void> {
    try {
        debug(`Adding ${files.length} files to git`);
        await git.add(files);

        // Verify files were added
        const status = await git.status();
        const stagedFiles = status.staged.length;

        if (stagedFiles === 0) {
            warn("No files were staged - they may have no changes");
        } else {
            debug(`Successfully staged ${stagedFiles} files`);
        }
    } catch (err) {
        throw new GitServiceError(
            "Failed to add files to git",
            "add",
            err instanceof Error ? err : undefined,
        );
    }
}

/**
 * Create a git commit
 */
async function createCommit(git: SimpleGit, message: string): Promise<string> {
    try {
        debug(`Creating commit with message: ${message}`);
        const commitResult = await git.commit(message);

        if (!commitResult.commit) {
            throw new GitServiceError("Commit was not created successfully", "commit");
        }

        info(`Created commit: ${commitResult.commit}`);
        return commitResult.commit;
    } catch (err) {
        throw new GitServiceError(
            "Failed to create commit",
            "commit",
            err instanceof Error ? err : undefined,
        );
    }
}

/**
 * Push changes to remote repository
 */
async function pushToRemote(git: SimpleGit, branch: string): Promise<void> {
    try {
        debug(`Pushing to remote branch: ${branch}`);

        // Check if remote exists
        const remotes = await git.getRemotes(true);
        if (remotes.length === 0) {
            throw new GitServiceError("No git remotes configured", "push");
        }

        await git.push("origin", branch);
        info(`Successfully pushed to remote branch: ${branch}`);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        // Check for authentication errors
        if (
            errorMessage.includes("authentication failed") ||
            errorMessage.includes("Permission denied") ||
            errorMessage.includes("401")
        ) {
            throw new GitAuthenticationError(
                "Git authentication failed - check credentials",
                err instanceof Error ? err : undefined,
            );
        }

        throw new GitServiceError(
            "Failed to push to remote",
            "push",
            err instanceof Error ? err : undefined,
        );
    }
}

/**
 * Perform dry run of git operations
 */
async function performDryRun(
    git: SimpleGit,
    files: string[],
    message: string,
): Promise<GitOperationResult> {
    try {
        // Check what would be added
        const status = await git.status();
        const filesToAdd = files.filter(file => status.files.some(f => f.path === file));

        info(`DRY RUN: Would add ${filesToAdd.length} files`);
        info(`DRY RUN: Would create commit: ${message}`);
        info(`DRY RUN: Would push to remote`);

        return {
            success: true,
            filesAdded: filesToAdd,
            pushedToRemote: false,
            message: "Dry run completed successfully",
        };
    } catch (err) {
        throw new GitServiceError(
            "Dry run failed",
            "dryrun",
            err instanceof Error ? err : undefined,
        );
    }
}

/**
 * Main function to commit and push changes to git repository
 */
export async function commitAndPushChanges(
    repoPath: string,
    modifiedFiles: string[],
): Promise<GitOperationResult> {
    const gitConfig = getGitConfig(repoPath);

    try {
        // Validate inputs
        if (!repoPath || typeof repoPath !== "string") {
            throw new GitServiceError("Repository path is required", "validation");
        }

        if (!Array.isArray(modifiedFiles) || modifiedFiles.length === 0) {
            throw new GitServiceError(
                "Modified files array is required and cannot be empty",
                "validation",
            );
        }

        // Validate repository path
        await validatePath(repoPath);

        // Initialize git client
        const git = simpleGit(repoPath);

        // Validate git repository
        await validateGitRepository(git);

        // Check repository status
        await checkRepositoryStatus(git);

        // Validate modified files
        const validFiles = await validateModifiedFiles(modifiedFiles, repoPath);

        if (validFiles.length === 0) {
            return {
                success: false,
                filesAdded: [],
                pushedToRemote: false,
                message: "No valid files to commit",
            };
        }

        // Handle dry run
        if (gitConfig.dryRun) {
            return await performDryRun(git, validFiles, gitConfig.commitMessage!);
        }

        // Configure git user
        await configureGitUser(git, gitConfig);

        // Add files to staging
        await addFilesToGit(git, validFiles);

        // Create commit
        const commitHash = await createCommit(git, gitConfig.commitMessage!);

        // Push to remote
        await pushToRemote(git, gitConfig.branch!);

        return {
            success: true,
            filesAdded: validFiles,
            commitHash,
            pushedToRemote: true,
            message: `Successfully committed and pushed ${validFiles.length} files`,
        };
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        error(`Git operation failed: ${errorMessage}`);

        // Re-throw with proper error type
        if (err instanceof GitServiceError) {
            throw err;
        }

        throw new GitServiceError(
            `Git operation failed: ${errorMessage}`,
            "unknown",
            err instanceof Error ? err : undefined,
        );
    }
}

/**
 * Check if git repository is clean (no uncommitted changes)
 */
export async function isRepositoryClean(repoPath: string): Promise<boolean> {
    try {
        await validatePath(repoPath);
        const git = simpleGit(repoPath);
        await validateGitRepository(git);

        const status = await git.status();
        return status.files.length === 0;
    } catch (err) {
        error(`Failed to check repository status: ${err}`);
        return false;
    }
}

/**
 * Get current git branch
 */
export async function getCurrentBranch(repoPath: string): Promise<string | null> {
    try {
        await validatePath(repoPath);
        const git = simpleGit(repoPath);
        await validateGitRepository(git);

        const status = await git.status();
        return status.current || null;
    } catch (err) {
        error(`Failed to get current branch: ${err}`);
        return null;
    }
}

/**
 * Get the last commit hash
 */
export async function getLastCommitHash(repoPath: string): Promise<string | null> {
    try {
        await validatePath(repoPath);
        const git = simpleGit(repoPath);
        await validateGitRepository(git);

        const log = await git.log({ maxCount: 1 });
        return log.latest?.hash || null;
    } catch (err) {
        error(`Failed to get last commit hash: ${err}`);
        return null;
    }
}
