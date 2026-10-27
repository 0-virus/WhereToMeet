import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const script = resolve('scripts/finish-work-hook.mjs');
function repo() {
  const cwd = mkdtempSync(join(tmpdir(), 'finish-work-'));
  const git = (...args) => execFileSync('git', ['-c', `safe.directory=${cwd}`, ...args], {cwd, encoding:'utf8', stdio:['ignore','pipe','pipe']}).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Hook test');
  git('config', 'user.email', 'hook@example.invalid');
  git('commit', '--allow-empty', '-m', 'initial');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  git('config', 'remote.origin.url', 'https://example.invalid/repo');
  git('config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*');
  git('config', 'branch.main.remote', 'origin');
  git('config', 'branch.main.merge', 'refs/heads/main');
  return {cwd, git};
}
const run = (cwd, extra={}) => JSON.parse(execFileSync(process.execPath, [script], {
  input:JSON.stringify({cwd, hook_event_name:'Stop', ...extra}), encoding:'utf8'
}));

test('clean synced repository needs no continuation', () => {
  const {cwd}=repo(); assert.deepEqual(run(cwd), {});
});
test('dirty repository asks agent to finish without changing files or HEAD', () => {
  const {cwd,git}=repo(); const head=git('rev-parse','HEAD');
  writeFileSync(join(cwd,'task.txt'),'pending');
  assert.equal(run(cwd).decision,'block');
  assert.equal(git('rev-parse','HEAD'),head);
  assert.match(git('status','--porcelain'),/task.txt/);
});
test('unpushed commit triggers continuation without network access', () => {
  const {cwd,git}=repo(); git('commit','--allow-empty','-m','task');
  assert.equal(run(cwd).decision,'block');
});
test('continued turn, plan mode and other events do not loop', () => {
  const {cwd}=repo(); writeFileSync(join(cwd,'task.txt'),'pending');
  for(const extra of [{stop_hook_active:true},{permission_mode:'plan'},{hook_event_name:'Interrupt'}]) assert.deepEqual(run(cwd,extra),{});
});
test('outside a repository reports the check failure without exposing command output', () => {
  const cwd=mkdtempSync(join(tmpdir(),'finish-work-no-git-'));
  assert.match(run(cwd).systemMessage,/Git/);
});
