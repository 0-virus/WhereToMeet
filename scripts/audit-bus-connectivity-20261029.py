"""서울시 2026-09 관측 노선번호와 기존 위치 원본 대조. 카탈로그를 수정하지 않는다."""
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import sys
from collections import Counter, defaultdict

ROOT = Path(__file__).resolve().parents[1]
CSV_HASH = 'c9400f1f13faa92435d036ba4f7ebd227b4e6ef4558a966c90a4c49f26f5fbe3'
MODES = {'010': '서울간선버스', '020': '서울지선버스', '030': '서울마을버스',
         '040': '서울순환버스', '050': '서울광역버스', '051': '서울심야버스'}


def route_keys(rows):
    return {(r['교통수단타입코드'], r['노선번호']) for r in rows
            if r['교통수단타입코드'] in MODES}


def distance(a, b):
    lat1, lat2 = math.radians(a['lat']), math.radians(b['lat'])
    value = (math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)
             * math.sin(math.radians(b['lng']-a['lng'])/2)**2)
    return 6371000 * 2 * math.asin(min(1, math.sqrt(value)))


def main(csv_path, output):
    source_bytes = Path(csv_path).read_bytes()
    assert hashlib.sha256(source_bytes).hexdigest() == CSV_HASH, '다른 월/변경된 원문'
    manifest = json.loads((ROOT/'data/sources.json').read_text(encoding='utf-8'))
    for source in manifest['sources']:
        for file in source['files']:
            assert hashlib.sha256((ROOT/file['path']).read_bytes()).hexdigest() == file['sha256']
    raw = json.loads((ROOT/'data/raw/seoul-bus-20260902.json').read_text(encoding='utf-8'))
    rail = json.loads((ROOT/'data/raw/seoul-rail-20261002.json').read_text(encoding='utf-8'))['DATA']
    preview = json.loads((ROOT/'data/hubs.preview.json').read_text(encoding='utf-8'))
    assert preview['version'] == 'seoul-20261005-a74a00301aab'
    by_id = {r['NODE_ID']: r for r in raw}
    assert len(by_id) == len(raw) == 11236
    preview_ids = {h['sourceId'] for h in preview['hubs'] if h['kind'] == 'bus'}
    assert len(preview_ids) == 61 and all(not h['verified'] for h in preview['hubs'])
    rows = list(csv.DictReader(io.StringIO(source_bytes.decode('cp949'), newline='')))
    assert len(rows) == 42155 and all(None not in r and len(r) == 57 for r in rows)
    counts = [k for k in rows[0] if '총승객수' in k]
    assert len(counts) == 48
    assert {r['사용년월'] for r in rows} == {'202609'}
    assert {r['등록일자'] for r in rows} == {'20261003'}
    assert all(r[k].isascii() and r[k].isdigit() for r in rows for k in counts)
    assert all(any(int(r[k]) > 0 for k in counts) for r in rows), '0명 행을 운행 근거로 집계하지 않음'
    assert all(r['교통수단타입명'] == MODES.get(r['교통수단타입코드'], '기타') for r in rows)
    assert {r['교통수단타입코드'] for r in rows} == set(MODES) | {'~'}
    assert all((len(r['표준버스정류장ID']) == 9 and r['표준버스정류장ID'].isascii()
                and r['표준버스정류장ID'].isdigit()) or r['표준버스정류장ID'] == '~' for r in rows)
    assert len({tuple(r.values()) for r in rows}) == len(rows), '중복 원문 행'
    by_stop, route_names = defaultdict(list), defaultdict(set)
    for row in rows:
        by_stop[row['표준버스정류장ID']].append(row)
        route_names[(row['교통수단타입코드'], row['노선번호'])].add(row['노선명'])
    matched = by_stop.keys() & by_id.keys()
    assert len(matched) == 10657
    assert all({r['버스정류장ARS번호'] for r in by_stop[id]} == {by_id[id]['ARS_ID']} for id in matched)
    rail_points = [{'id': r['bldn_id'], 'name': r['bldn_nm'], 'lat': float(r['lat']), 'lng': float(r['lot'])}
                   for r in rail if r['lat'] and r['lot']]
    assert all(math.isfinite(p['lat']) and math.isfinite(p['lng']) and -90 <= p['lat'] <= 90
               and -180 <= p['lng'] <= 180 for p in rail_points)
    records = []
    for id in sorted(matched):
        stop = by_id[id]
        keys = sorted(route_keys(by_stop[id]))
        assert math.isfinite(stop['lat']) and math.isfinite(stop['lng'])
        nearest = min(rail_points, key=lambda rail: (distance(stop, rail), rail['id']))
        records.append({'sourceId': id, 'name': stop['name'], 'arsId': stop['ARS_ID'],
                        'sourceStopType': stop['type'], 'inPreview': id in preview_ids,
                        'observedRouteNumberCount': len(keys),
                        'observedRouteNumbers': [{'modeCode': code, 'number': number} for code, number in keys],
                        'sourceRowCount': len(by_stop[id]), 'nearestRawRailId': nearest['id'],
                        'nearestRawRailName': nearest['name'],
                        'nearestRawRailStraightMetres': distance(stop, nearest),
                        'releaseEligible': False})
    outside = [r for r in records if r['sourceStopType'] != '중앙차로' and r['observedRouteNumberCount'] > 0]
    order = lambda r: (-r['observedRouteNumberCount'], r['sourceId'])
    outside.sort(key=order)
    # 1km는 설명용 원본 점 간 직선거리 구간이며 보행/역세권/출시 선정 기준이 아니다.
    distant = [r for r in outside if r['nearestRawRailStraightMetres'] >= 1000]
    summary = {'rows': len(rows), 'rawLocationRows': len(raw), 'observedStopIdsIncludingUnknown': len(by_stop),
               'knownObservedStopIds': sum(id != '~' for id in by_stop),
               'matchedLocationIds': len(matched), 'observedIdsWithoutLocation': len(by_stop.keys()-by_id.keys()),
               'knownObservedIdsWithoutLocation': len(by_stop.keys()-by_id.keys()-{'~'}),
               'locationIdsWithoutObservation': len(by_id.keys()-by_stop.keys()), 'arsConflicts': 0,
               'unknownModeRows': sum(r['교통수단타입코드'] == '~' for r in rows),
               'unknownStopIdRows': len(by_stop.get('~', [])), 'zeroPassengerRows': 0,
               'rawRailPoints': len(rail_points), 'previewBusIds': len(preview_ids),
               'previewBusIdsWithObservation': len(preview_ids & by_stop.keys()),
               'matchedStopTypes': dict(sorted(Counter(by_id[id]['type'] for id in matched).items())),
               'outsideCentralLaneWithObservedRoute': len(outside),
               'outsideCentralLaneAtLeastRoutes': {str(n): sum(r['observedRouteNumberCount'] >= n for r in outside) for n in [2, 5, 10]},
               'outsideCentralLaneAtLeast1kmFromRawRail': len(distant),
               'outsideCentralLaneAtLeast1kmAnd5Routes': sum(r['observedRouteNumberCount'] >= 5 for r in distant),
               'routeNumberKeysWithMultipleNames': sum(len(v) > 1 for v in route_names.values())}
    assert summary['matchedLocationIds'] + summary['observedIdsWithoutLocation'] == len(by_stop)
    assert summary['matchedLocationIds'] + summary['locationIdsWithoutObservation'] == len(raw)
    assert all(not r['inPreview'] and not r['releaseEligible'] for r in outside)
    result = {'reviewedAt': '2026-10-29', 'purpose': '중앙차로 대리 기준의 누락과 후속 검수 후보 파악',
              'source': {'id': 'OA-12913', 'title': '서울시 버스노선별 정류장별 시간대별 승하차 인원 정보',
                         'sourceUrl': 'https://data.seoul.go.kr/dataList/OA-12913/S/1/datasetView.do',
                         'month': '202609', 'registeredAt': '2026-10-03', 'fileListedDate': '2026-10-06',
                         'retrievedAt': '2026-10-29', 'encoding': 'cp949', 'bytes': len(source_bytes), 'sha256': CSV_HASH,
                         'license': '공공누리 1유형·서울특별시 출처표시',
                         'downloadUrl': 'https://datafile.seoul.go.kr/bigfile/iot/inf/nio_download.do?&useCache=false',
                         'downloadForm': {'infId': 'OA-12913', 'seq': '114', 'seqNo': '', 'infSeq': '3'}},
              'locationSources': manifest['sources'], 'catalogVersion': preview['version'],
              'method': ['표준 정류소 ID의 정확한 일치와 ARS 일치만 사용. 이름/최근접 좌표로 합치지 않음.',
                         '같은 정류소의 (교통수단타입코드, 노선번호)를 한 번 집계. 기타는 제외.',
                         '순번·방향·노선명 변형으로 노선 수를 늘리지 않음. 실제 노선 ID·현재 시간표의 전수 연결 수가 아님.',
                         '주간·심야를 포함한 한 달의 관측이며 같은 약속 시각에 모든 노선을 이용할 수 있다는 뜻이 아님.',
                         '9월 승하차 관측은 현재 운행·모든 경기/인천 노선·보행 접근·공공 만남 지점의 증거가 아님.',
                         '철도 원본 전체의 가장 가까운 점까지 Haversine 직선거리. 출입구·보행거리·운영 상태가 아님.',
                         '상위30개씩은 수동 검수 우선순위. 방향별 정류소를 독립 만남 지점으로 확정하거나 자동 채택하지 않음.'],
              'summary': summary, 'currentPreview': [r for r in records if r['inPreview']],
              'previewIdsWithoutObservation': sorted(preview_ids-by_stop.keys()),
              'outsideCentralLaneTop30': outside[:30], 'outsideCentralLaneAtLeast1kmTop30': distant[:30],
              'routeNumberKeysWithMultipleNames': [{'modeCode': k[0], 'number': k[1], 'names': sorted(v)}
                                                  for k, v in sorted(route_names.items()) if len(v) > 1]}
    Path(output).write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    # 원본의 방향/순번 중복과 알 수 없는 수단이 노선 수를 부풀리지 않는지 확인.
    fixture = [{'교통수단타입코드': code, '노선번호': number}
               for code, number in [('010', '470'), ('010', '470'), ('051', 'N37'), ('~', '470')]]
    assert route_keys(fixture) == {('010', '470'), ('051', 'N37')}
    assert route_keys([]) == set()
    assert distance({'lat': 37, 'lng': 127}, {'lat': 37, 'lng': 127}) == 0
    assert abs(distance({'lat': 0, 'lng': 0}, {'lat': 1, 'lng': 0}) - 111194.9266) < 0.001
    if len(sys.argv) != 3:
        raise SystemExit('사용법: python scripts/audit-bus-connectivity-20261029.py 원문.csv 결과.json')
    main(sys.argv[1], sys.argv[2])
