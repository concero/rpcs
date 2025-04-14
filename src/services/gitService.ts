import simpleGit from "simple-git";

export async function commitAndPushChanges(
  repoPath: string,
  modifiedFiles: string[],
): Promise<void> {
  const git = simpleGit(repoPath);
  await git.add(modifiedFiles);
  await git.commit(`Update chain RPC files ${new Date().toISOString()}`);
  await git.push();
}
