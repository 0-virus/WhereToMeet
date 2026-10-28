"""정류장 마스터와 9월 위치·노선 좌표 대조. 최신 표시를 현장 승인으로 바꾸지 않는다."""
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import runpy
import sys

ROOT = Path(__file__).resolve().parents[1]
MASTER_HASH = '224bc5a152e5ca92d93a9d1fc57928c07406f77159659f16faa19280b55207b1'
PRIOR = 'data/review-evidence/bus-route-links-2026-10-29.json'
PRIOR_HASH = '496595341bea71a6270e11c38c3c0ee149d43414046906078f2833ab88ba1c22'
distance = runpy.run_path(str(ROOT/'scripts/audit-bus-connectivity-20261029.py'))['distance']
FIELDS = {'name': 'crtr_nm', 'ARS_ID': 'crtr_no', 'type': 'crtr_type', 'lat': 'lat', 'lng': 'lot'}


def changes(original, current):
    return {old: {'before': original[old], 'after': current[new]}
            for old, new in FIELDS.items() if original[old] != current[new]}


def main(master_path, output):
    blob = Path(master_path).read_bytes()
    assert hashlib.sha256(blob).hexdigest() == MASTER_HASH, '다른 마스터 원문'
    prior_text = (ROOT/PRIOR).read_text(encoding='utf-8')
    assert hashlib.sha256(prior_text.encode()).hexdigest() == PRIOR_HASH, '선행 검수 근거 변경'
    prior = json.loads(prior_text)
    manifest = json.loads((ROOT/'data/sources.json').read_text(encoding='utf-8'))
    for source in manifest['sources']:
        for file in source['files']:
            assert hashlib.sha256((ROOT/file['path']).read_bytes()).hexdigest() == file['sha256']
    raw = {r['NODE_ID']: r for r in json.loads((ROOT/'data/raw/seoul-bus-20260902.json').read_text(encoding='utf-8'))}
    rows = json.loads(blob)['DATA']
    assert len(rows) == 11503
    assert all(set(r) == {'crtr_id', 'crtr_nm', 'crtr_no', 'crtr_type', 'lat', 'lot', 'bus_arvl_info_guidem_instl'} for r in rows)
    assert all(type(r['crtr_id']) is int and 100000000 <= r['crtr_id'] <= 999999999 for r in rows)
    assert all(isinstance(r[k], str) and r[k] for r in rows for k in ('crtr_nm', 'crtr_no', 'crtr_type'))
    assert all(type(r[k]) in (int, float) and math.isfinite(r[k]) for r in rows for k in ('lat', 'lot'))
    assert all(-90 <= r['lat'] <= 90 and -180 <= r['lot'] <= 180 for r in rows)
    master = {str(r['crtr_id']): r for r in rows}
    assert len(master) == len(rows), '중복 정류소 ID'
    matched = master.keys() & raw.keys()
    changed = [{'sourceId': key, 'changes': changes(raw[key], master[key])}
               for key in sorted(matched) if changes(raw[key], master[key])]
    changed_ids = {r['sourceId'] for r in changed}
    targets = {r['sourceId'] for r in prior['reviewedStops']}
    preview = {r['sourceId'] for r in prior['reviewedStops'] if r['inPreview']}
    coordinate_checks = []
    for old in prior['coordinateDifferencesOver100m']:
        key = old['sourceId']
        r = master[key]
        point = {'lat': r['lat'], 'lng': r['lot']}
        coordinate_checks.append({'sourceId': key, 'originalName': old['name'], 'masterName': r['crtr_nm'],
                                  'masterArsId': r['crtr_no'], 'arsMatchesLocationSource': r['crtr_no'] == raw[key]['ARS_ID'],
                                  'masterPoint': point,
                                  'equalsLocationSourcePoint': point == old['locationSourcePoint'],
                                  'equalsRouteSourcePoint': point == old['routeSourcePoint'],
                                  'distanceToLocationSourceMetres': distance(point, old['locationSourcePoint']),
                                  'distanceToRouteSourceMetres': distance(point, old['routeSourcePoint']),
                                  'coordinateResolution': 'unresolved', 'releaseEligible': False})
    added = master.keys()-raw.keys()
    summary = {'masterRows': len(rows), 'locationRows': len(raw), 'matchedLocationIds': len(matched),
               'locationIdsMissingFromMaster': len(raw.keys()-master.keys()), 'additionalMasterIds': len(added),
               'changedExistingStops': len(changed),
               'changedCoordinateStops': sum('lat' in r['changes'] or 'lng' in r['changes'] for r in changed),
               'changedByField': {field: sum(field in r['changes'] for r in changed) for field in FIELDS},
               'additionalMasterIdsByType': dict(sorted(Counter(master[key]['crtr_type'] for key in added).items())),
               'reviewTargets': len(targets), 'targetsMissingFromMaster': len(targets-master.keys()),
               'changedTargets': len(targets & changed_ids), 'previewBusIds': len(preview),
               'previewBusIdsMissingFromMaster': len(preview-master.keys()), 'changedPreviewBusIds': len(preview & changed_ids),
               'priorCoordinateConflictStops': len(coordinate_checks),
               'masterExactlyMatchesLocationPoint': sum(r['equalsLocationSourcePoint'] for r in coordinate_checks),
               'masterExactlyMatchesRoutePoint': sum(r['equalsRouteSourcePoint'] for r in coordinate_checks)}
    result = {'reviewedAt': '2026-10-29',
              'source': {'id': 'OA-21231', 'sourceUrl': 'https://data.seoul.go.kr/dataList/OA-21231/S/1/datasetView.do',
                         'pageDataUpdatedAt': '2026-10-22', 'retrievedAt': '2026-10-29',
                         'bytes': len(blob), 'sha256': MASTER_HASH, 'license': '공공누리 1유형·서울특별시 출처표시',
                         'downloadUrl': 'https://datafile.seoul.go.kr/bigfile/iot/sheet/json/download.do',
                         'downloadForm': {'srvType': 'S', 'infId': 'OA-21231', 'serviceKind': '1', 'pageNo': '1',
                                          'gridTotalCnt': '', 'ssUserId': 'SAMPLE_VIEW', 'strWhere': '',
                                          'strOrderby': 'CRTR_ID ASC', 'filterCol': '필터선택', 'txtFilter': ''}},
              'priorEvidence': {'path': PRIOR, 'normalizedLfSha256': PRIOR_HASH},
              'method': ['정류소 ID 정확한 일치만 사용하며 명칭·ARS·유형·좌표 차이를 별도로 보존.',
                         '페이지 갱신일은 각 정류소의 현장 조사일이 아니다. 같은 서울시 TOPIS 원천의 일치를 독립 현장 증거로 세지 않음.',
                         '신규 ID는 두 파일의 차집합이며 신규 설치나 출시 후보 확정이 아님. 가상정류장·선착장도 포함될 수 있음.',
                         '현재 후보 61개·검수 대상 120개의 미변경은 이 다섯 필드만의 대조 결과이며 현재 운행·보행·대기 공간 승인 아님.',
                         '좌표에 다수결을 적용하거나 자동 교체하지 않음. 충돌 판정은 모두 미해결로 유지.'],
              'summary': summary, 'changedExistingStops': changed,
              'additionalMasterIds': sorted(added), 'coordinateConflictChecks': coordinate_checks}
    Path(output).write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    original = {'name': '가', 'ARS_ID': '01001', 'type': '일반차로', 'lat': 37, 'lng': 127}
    current = {new: original[old] for old, new in FIELDS.items()}
    assert changes(original, current) == {}
    assert changes(original, {**current, 'lat': 37.1}) == {'lat': {'before': 37, 'after': 37.1}}
    assert changes(original, {**current, 'crtr_no': '1001'}) == {'ARS_ID': {'before': '01001', 'after': '1001'}}
    if len(sys.argv) != 3:
        raise SystemExit('사용법: python scripts/audit-bus-stopmaster-20261029.py 원문.json 결과.json')
    main(sys.argv[1], sys.argv[2])
