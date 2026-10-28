"""2026-10-28 철도 표본의 보행 자료 대조. 설치/좌표 대응은 승인으로 전환하지 않는다."""
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import re
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
CSV = 'data/raw/seoulmetro-elevators-20260901.csv'
COORDS = 'data/raw/seoul-elevator-coordinates-20261028.json'
REPORT = 'data/review-evidence/rail-access-2026-10-28.json'
ZIP_HASH = '9f3e27c068a046b352deafbc9e196dc94c80c8478bf03170c78d2936de80a6a7'
MAP_URL = 'https://data.seoul.go.kr/dataList/OA-11984/S/1/datasetView.do'
OBSERVATIONS = {
 'seoul-rail-0219': '도면은 B1 대합실·B2 승강장과 여러 외부 엘리베이터를 표시한다. CSV 외부 설치행은 1·6·4번 출구 측이다. 좌표 노드별 출구번호 연결과 현재 공공 대기 지점은 미확인이다.',
 'seoul-rail-0225': '도면의 B1 대합실·B2 승강장, 3번 출구 쪽 외부 엘리베이터는 CSV 124행 안내와 일치한다. 원본 거점 좌표와 공공 대기 공간의 동일성·현재 접근성은 미확인이다.',
 'seoul-rail-2546': 'CSV 471행의 근접 출입구는 4번, 상세위치는 3번 출구 측으로 서로 다르다. 도면은 B1·B2 대합실과 B3 승강장의 층별 연결을 보여주지만 어느 안내가 현재 정확한지 확정하지 못했다. 운영기관 또는 현장 확인이 필요하다.',
 'seoul-rail-2731': '도면은 B3 대합실·B4 승강장과 여러 출입구·외부 엘리베이터를 표시한다. CSV는 5·10번 출구 측을 안내한다. 같은 역명 좌표 노드의 최단 직선거리도 약187m이므로 원본 거점의 대표점 승인은 보류한다.',
 "seoul-rail-0318": "안국 도면은 B1·B2 대합실과 B3 승강장을 표시하며 6번 출구 쪽 외부 엘리베이터가 보인다. CSV 215행의 6번 출구 측·B2~지상1층과 대조했다. 공공 만남 지점의 좌표는 미확인이다.",
 "seoul-rail-0337": "대청 도면은 B1·B2 대합실과 B3 승강장, 8번 출구 쪽 외부 엘리베이터를 표시한다. CSV 265행의 8번 출구 측과 대조했다. 도면의 연결통로 표시를 현재 공공 대기 공간으로 승인하지 않는다.",
 "seoul-rail-2516": "발산 도면은 B1 대합실·B2 승강장과 7번 출구 쪽 외부 엘리베이터를 표시한다. CSV 387행의 7번 출구 측과 대조했다. 현재 좌표와 외부 대기 지점의 동일성은 미확인이다.",
 "seoul-rail-2521": "목동 도면은 B1 대합실·B2 승강장과 5번 출구 쪽 외부 엘리베이터를 표시한다. CSV 401행의 5번 출구 측과 대조했다. 최근접 노드 거리만으로 좌표를 옮기지 않는다.",
 "seoul-rail-2559": "개롱 도면은 B1 대합실·B2 승강장과 3·4번 출구 사이 외부 엘리베이터를 표시한다. CSV 545행과 대조했다. 지상 횡단·대기 공간은 도면에 충분히 나타나지 않는다.",
 "seoul-rail-2612": "역촌 도면은 B1 대합실·B4 승강장과 4번 출구 쪽 외부 엘리베이터를 표시한다. CSV 555행과 대조했다. 원본 좌표의 층과 현재 공공 대기 공간은 미확인이다.",
 "seoul-rail-2620": "월드컵경기장 도면은 B1 대합실·B2 승강장, 2번 출구 쪽 외부 엘리베이터와 경기장 측 동선을 표시한다. CSV 576행은 2번 출구 측 B2~지상1층이다. 실제 정차층·지상 보행 지점 연결은 별도 확인해야 한다.",
 "seoul-rail-2622": "망원 도면은 B1 대합실·B2 승강장과 2번 출구 쪽 외부 엘리베이터를 표시한다. CSV 582행은 2번 출구 측·합정 방면4-4 및 B2~지상1층을 안내한다. 노드와 설치 호기의 동일성은 미확인이다.",
 "seoul-rail-2624": "상수 도면은 B1·B2 대합실과 B3 승강장, 3번 출구 쪽 외부 엘리베이터 및 층간 장애인 리프트를 표시한다. CSV는 엘리베이터3행이 있어 도면의 현재성·층간 연결을 추가 확인해야 한다.",
 "seoul-rail-2711": "장암 도면은 지상1층 대합실·승강장과 1번 출구의 높이 차이·엘리베이터2대를 표시한다. CSV 670·671행은 지상1~2층이다. 지상 표시만으로 같은 평면 보행 연결을 가정하지 않는다. 좌표 자료 대응은 없다.",
 "seoul-rail-2737": "내방 도면은 B1·B2 대합실·B3 승강장과 3·5번 출구 쪽 외부 엘리베이터를 표시한다. CSV 754·755행과 대조했다. 서로 다른 방향 참가자의 지상 공공 만남 지점은 미지정이다.",
 "seoul-rail-2813": "강동구청 도면은 B1·B2 대합실·B3 승강장과 외부 엘리베이터를 표시한다. CSV 818행은 4번 출구 측 B2~지상1층이다. 도면의 지상 엘리베이터 위치를 WGS84 노드와 정확히 연결하지 못했다.",
 "seoul-rail-2822": "산성 도면은 B1·B2 대합실·B3 승강장과 여러 층간 경사형 엘리베이터 및 3번 출구 쪽 외부 엘리베이터를 표시한다. CSV 855행은 3번 출구 측 B1~지상1층이다. 좌표 자료 대응은 없으며 경사 구간·공공 대기 지점 확인이 필요하다.",
}

def digest(data):
    return hashlib.sha256(data).hexdigest()

def normalized(name):
    return re.sub(r'\([^)]*\)', '', name).replace(' ', '').removesuffix('역')

def map_station(entry):
    return normalized(re.sub(r'^p?\d+[.\s_-]*', '', Path(entry).stem))

def distance(hub, node):
    match = re.fullmatch(r'POINT\(([-.0-9]+) ([-.0-9]+)\)', node['node_wkt'])
    if not match:
        raise ValueError('잘못된 WGS84 POINT')
    lng, lat = map(float, match.groups())
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise ValueError('좌표 범위 오류')
    a, b = math.radians(hub['lat']), math.radians(lat)
    value = math.sin((b-a)/2)**2 + math.cos(a)*math.cos(b)*math.sin(math.radians(lng-hub['lng'])/2)**2
    return 6371000 * 2 * math.asin(min(1, math.sqrt(value)))


def main(archive):
    csv_bytes, coord_bytes = (ROOT/CSV).read_bytes(), (ROOT/COORDS).read_bytes()
    if digest(csv_bytes) != '87553e6baf464cb855d690ef259dee04df1ea6bae4e1d83638c1cb044e01d3c0' or digest(coord_bytes) != '21e7b16aa633da2b622dea7fac434b27b06c0cc3fc2763cdd064a03aa9155658':
        raise ValueError('검수 원문 해시 불일치')
    with open(archive, 'rb') as source:
        if hashlib.file_digest(source, 'sha256').hexdigest() != ZIP_HASH:
            raise ValueError('공식 안내도 ZIP 해시 불일치')
    elevators = list(csv.DictReader(io.StringIO(csv_bytes.decode('cp949'))))
    nodes = json.loads(coord_bytes)['DATA']
    assert len(elevators) == 868 and len(nodes) == 552
    assert len({r['연번'] for r in elevators}) == len(elevators)
    assert len({r['node_id'] for r in nodes}) == len(nodes)
    assert {r['데이터 기준일자'] for r in elevators} == {'2026-09-01'}
    catalog = json.loads((ROOT/'data/hubs.sample.json').read_text('utf8'))
    if catalog['version'] != 'seoul-20261005-2b17e7c9e6f7':
        raise ValueError('표본 변경: 새 검수가 필요함')
    rail = {r['bldn_id']: r for r in json.loads((ROOT/'data/raw/seoul-rail-20261002.json').read_text('utf8'))['DATA']}
    results = []
    with zipfile.ZipFile(archive) as maps:
        entries = [i for i in maps.infolist() if not i.is_dir()]
        for hub in catalog['hubs']:
            if hub['kind'] != 'rail':
                continue
            name = normalized(hub['name'])
            matching_elevators = [r for r in elevators if normalized(r['역  명']) == name]
            matching_nodes = [r for r in nodes if normalized(r['sbwy_stn_nm']) == name]
            matching_maps = [i for i in entries if map_station(i.filename) == name]
            distances = sorted([(distance(hub, r), r['node_id']) for r in matching_nodes])
            map_records = [{'entry':i.filename, 'sha256':digest(maps.read(i)), 'bytes':i.file_size} for i in matching_maps]
            inspected = hub['id'] in OBSERVATIONS
            if inspected:
                assert len(map_records) == 1
            if hub['id'] in ['seoul-rail-0219','seoul-rail-0225','seoul-rail-2546','seoul-rail-2731']:
                local_map = 'data/review-evidence/maps/'+hub['id']+'.jpg'
                assert digest((ROOT/local_map).read_bytes()) == map_records[0]['sha256']
                map_records[0]['localFile'] = local_map
            results.append({
                'hubId':hub['id'], 'name':hub['name'], 'sourceRoute':rail[hub['sourceId']]['route'],
                'elevatorRecordNumbers':[r['연번'] for r in matching_elevators],
                'groundFloor1RecordNumbers':[r['연번'] for r in matching_elevators if any(r[side+'층(지상_지하)']=='지상' and r[side+'층(운행역층)']=='1' for side in ['시작','종료'])],
                'coordinateNodes':[{'nodeId':r['node_id'], 'sourceStationCode':r['sbwy_stn_cd'], 'sourceStationName':r['sbwy_stn_nm']} for r in matching_nodes],
                'nearestNodeId':distances[0][1] if distances else None,
                'nearestStraightLineMeters':round(distances[0][0],1) if distances else None,
                'maps':map_records, 'mapVisuallyInspected':inspected,
                'note':OBSERVATIONS.get(hub['id'], '자료 대응 후보만 추출. 정확한 대표점·현재 보행 접근성은 미검증.'),
                'representativePointChecked':False, 'pedestrianAccessChecked':False, 'releaseEligible':False,
            })
    assert len(results) == 50 and len({r['hubId'] for r in results}) == 50
    assert len([r for r in results if r['mapVisuallyInspected']]) == 17
    report = {
        'checkedAt':'2026-10-28', 'catalogVersion':catalog['version'],
        'catalogSha256':digest((ROOT/'data/hubs.sample.json').read_bytes()),
        'scope':'현재 철도 표본50개. 이름의 괄호·공백·역 접미사를 제거한 대조 후보이며 기관 간 역코드 동일성이나 현재 위치·가동·보행 접근성을 승인하지 않음.',
        'distanceMethod':'WGS84 Haversine, 구 반지름6371000m. 같은 정규화 역명 노드 중 최소 직선거리이며 보행거리·정확한 출구 대응·중복 판정이 아님.',
        'groundFloorRule':'시작 또는 종료가 지상1층인 설치행만 분류. 지상2·3층도 존재하므로 지상이라는 값만으로 외부 출입구로 판정하지 않음.',
        'sources':[
            {'id':'15044261','sourceUrl':'https://www.data.go.kr/data/15044261/fileData.do','sourceDate':'2026-09-01','retrievedAt':'2026-10-28','rows':len(elevators),'path':CSV,'sha256':digest(csv_bytes),'encoding':'cp949','license':'공공데이터포털 이용허락범위 제한 없음','downloadUrl':'https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000007647020&fileDetailSn=1&insertDataPrcus=N'},
            {'id':'OA-21212','sourceUrl':'https://data.seoul.go.kr/dataList/OA-21212/S/1/datasetView.do','surveyYear':2020,'retrievedAt':'2026-10-28','rows':len(nodes),'path':COORDS,'sha256':digest(coord_bytes),'license':'공공누리1유형·서울특별시 출처표시','downloadUrl':'https://datafile.seoul.go.kr/bigfile/iot/sheet/json/download.do','downloadForm':{'srvType':'S','infId':'OA-21212','serviceKind':'0','pageNo':'1','ssUserId':'SAMPLE_VIEW','strWhere':'','strOrderby':'SGG_CD ASC'},'countNote':'연결된 공공데이터포털의 과거 설명643행과 현재 다운로드552행이 다름. 이번 조회 원문552행만 사용.'},
            {'id':'OA-11984','sourceUrl':MAP_URL,'fileListedDate':'2026-08-24','retrievedAt':'2026-10-28','filename':'역이용안내도.zip','bytes':254865166,'sha256':ZIP_HASH,'entries':len(entries),'license':'공공누리1유형·서울교통공사 출처표시','downloadUrl':'https://datafile.seoul.go.kr/bigfile/iot/inf/nio_download.do?&useCache=false','downloadForm':{'infId':'OA-11984','infSeq':'3','seq':'4','seqNo':''},'dateNote':'목록 수정일은 도면별 조사일이 아님. ZIP 전체는 저장소에 넣지 않고 직접 본17장 중 핵심 사례4장만 원형 보존. 나머지는 ZIP 내부 경로·해시로 식별.'},
        ],
        'summary':{'railSample':len(results),'withElevatorRecords':sum(bool(r['elevatorRecordNumbers']) for r in results),'withCoordinateNodes':sum(bool(r['coordinateNodes']) for r in results),'withMapCandidates':sum(bool(r['maps']) for r in results),'visuallyInspectedMaps':17,'fullyReviewed':0},
        'results':results,
    }
    (ROOT/REPORT).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8',newline='\n')
    print(json.dumps(report['summary'],ensure_ascii=False))

if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('사용법: python scripts/audit-hub-access-20261028.py <공식 역이용안내도 ZIP 경로>')
    main(sys.argv[1])
