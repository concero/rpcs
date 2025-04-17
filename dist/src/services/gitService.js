"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.commitAndPushChanges = commitAndPushChanges;
const simple_git_1 = __importDefault(require("simple-git"));
async function commitAndPushChanges(repoPath, modifiedFiles) {
    const git = (0, simple_git_1.default)(repoPath);
    await git.add(modifiedFiles);
    await git.commit(`Update chain RPC files ${new Date().toISOString()}`);
    await git.push();
}
