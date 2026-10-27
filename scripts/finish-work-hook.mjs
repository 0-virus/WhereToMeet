import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

let output = {};
try {
  const event = JSON.parse(readFileSync(0, 'utf8').replace(/^\uFEFF/, ''));
  if (event.hook_event_name === 'Stop' && !event.stop_hook_active && event.permission_mode !== 'plan') {
    if (typeof event.cwd !== 'string' || !event.cwd) throw new Error('missing cwd');
    const git = (...args) => execFileSync('git', ['-c', `safe.directory=${event.cwd}`, ...args], {
      cwd:event.cwd, encoding:'utf8', timeout:5000, stdio:['ignore','pipe','pipe']
    }).trim();
    const dirty = Boolean(git('status', '--porcelain'));
    let ahead = 0;
    try { ahead = Number(git('rev-list', '--count', '@{upstream}..HEAD')); }
    catch { /* 추적 브랜치가 없으면 변경 작업을 마치는 에이전트가 대상을 확인한다. */ }
    if (dirty || ahead > 0) output = {
      decision:'block',
      reason:'사용자가 작업 완료 후 자동 커밋·푸시를 요청했습니다. AGENTS.md에 따라 이번 작업의 검증과 당일 worklog 갱신을 마친 뒤, 이번 작업에 해당하는 파일만 커밋하고 현재 브랜치의 upstream으로 일반 push하세요. 사용자 기존 변경·비밀키는 포함하지 말고 변경이 없으면 빈 커밋을 만들지 마세요. 사용자 중단·커밋 금지 지시가 있거나 작업이 차단됐다면 이를 우선하고 실행하지 마세요. 충돌·권한·인증·upstream 문제가 있으면 강제 push나 자동 reset 없이 원인을 보고하세요. 완료 후 커밋과 원격 상태를 확인하세요.'
    };
  }
} catch {
  output = {systemMessage:'작업 종료 훅이 Git 상태를 확인하지 못했습니다. 자동 커밋·푸시 완료로 간주하지 말고 상태를 확인하세요.'};
}
console.log(JSON.stringify(output));
