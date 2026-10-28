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
      reason:'미커밋 파일 또는 미푸시 커밋이 있습니다. 먼저 AGENTS.md에 따라 이번 작업에 실제 프로젝트 진행과 관련된 수정이 있었는지 확인하세요. 단순 조회·질문 답변·상태 재확인·실행 방법 안내뿐이었다면 worklog를 만들거나 커밋·푸시하지 말고 종료하세요. 기존 변경·미푸시 커밋만으로 이번 작업의 변경이라고 판단하지 마세요. 코드·설정·데이터·계획·지침 수정이나 새로운 검증 결과·차단 조건을 남긴 문서 변경이 있을 때만 필요한 검증과 당일 worklog 갱신 후 이번 작업 파일만 커밋하고 현재 upstream으로 일반 push하세요. 사용자의 명시적인 커밋·푸시 요청은 별도로 따르세요. 사용자 기존 변경·비밀키·임시 파일은 제외하고 빈 커밋은 만들지 마세요. 사용자 중단·커밋 금지 또는 작업 차단 시에는 실행하지 마세요. 충돌·권한·인증·upstream 문제는 강제 push나 자동 reset 없이 보고하고, 수행한 커밋·푸시의 로컬·원격 상태를 확인하세요.'
    };
  }
} catch {
  output = {systemMessage:'작업 종료 훅이 Git 상태를 확인하지 못했습니다. 자동 커밋·푸시 완료로 간주하지 말고 상태를 확인하세요.'};
}
console.log(JSON.stringify(output));
