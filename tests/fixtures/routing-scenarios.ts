// Resolve names against the source-backed catalog; never geocode personal addresses.
// Intent tags describe test coverage to investigate, not observed transport modes.
// Coordinates are source-backed public places, not field-reviewed entrances.
export const publicOrigins: Record<string, { lat: number; lng: number; sourceUrl: string; checkedAt: string }> = {
  // Official Seoul station master snapshot 2026-10-02, exact record IDs below.
  // These are fixed PUBLIC test origins, independent of candidate selection.
  '강남': { lat: 37.49799, lng: 127.027912, sourceUrl: 'https://data.seoul.go.kr/dataList/OA-21232/S/1/datasetView.do#0222', checkedAt: '2026-10-05' },
  '홍대입구': { lat: 37.55679, lng: 126.923708, sourceUrl: 'https://data.seoul.go.kr/dataList/OA-21232/S/1/datasetView.do#0239', checkedAt: '2026-10-05' },
  '노원': { lat: 37.65627, lng: 127.063276, sourceUrl: 'https://data.seoul.go.kr/dataList/OA-21232/S/1/datasetView.do#0411', checkedAt: '2026-10-05' },
  '사당': { lat: 37.476538, lng: 126.981544, sourceUrl: 'https://data.seoul.go.kr/dataList/OA-21232/S/1/datasetView.do#0226', checkedAt: '2026-10-05' },
  '서울역': { lat: 37.556228, lng: 126.972135, sourceUrl: 'https://data.seoul.go.kr/dataList/OA-21232/S/1/datasetView.do#0150', checkedAt: '2026-10-05' },
  '왕십리': { lat: 37.561238, lng: 127.036954, sourceUrl: 'https://data.seoul.go.kr/dataList/OA-21232/S/1/datasetView.do#0208', checkedAt: '2026-10-05' },
  '잠실': { lat: 37.513262, lng: 127.100159, sourceUrl: 'https://data.seoul.go.kr/dataList/OA-21232/S/1/datasetView.do#0216', checkedAt: '2026-10-05' },
  '신도림': { lat: 37.508961, lng: 126.891084, sourceUrl: 'https://data.seoul.go.kr/dataList/OA-21232/S/1/datasetView.do#0234', checkedAt: '2026-10-05' },
  '종로3가': { lat: 37.570406, lng: 126.991847, sourceUrl: 'https://data.seoul.go.kr/dataList/OA-21232/S/1/datasetView.do#0153', checkedAt: '2026-10-05' },
  '수원메쎄': { lat: 37.2668587922, lng: 126.9971971906, sourceUrl: 'https://data.visitkorea.or.kr/linkedview/3075791', checkedAt: '2026-10-05' },
  '인천 개항장 거리': { lat: 37.4729337678, lng: 126.621006246, sourceUrl: 'https://data.visitkorea.or.kr/linkedview/947611', checkedAt: '2026-10-05' },
  '권선배움마루': { lat: 37.2429924723286, lng: 127.020076949893, sourceUrl: 'https://yeyak.syf.or.kr/www/119', checkedAt: '2026-10-05' },
  '판교역서편(07-455)': { lat: 37.394698, lng: 127.109602833, sourceUrl: 'https://www.seongnam.go.kr/contents/down/10458_9.pdf', checkedAt: '2026-10-05' },
  '태평2동행정복지센터(05-058)': { lat: 37.44709883, lng: 127.1375, sourceUrl: 'https://www.seongnam.go.kr/contents/down/10458_9.pdf', checkedAt: '2026-10-05' },
};
export const scenarioDefinitions = [
  { id: 'weekday-east-west', origins: ['강남', '홍대입구'], day: 'weekday', time: '19:00', intent: 'rail' },
  { id: 'weekday-north-south', origins: ['노원', '사당'], day: 'weekday', time: '19:30', intent: 'rail' },
  { id: 'weekday-suwon-three', origins: ['수원메쎄', '서울역', '왕십리'], day: 'weekday', time: '18:30', intent: 'cross-region' },
  { id: 'weekday-incheon-four', origins: ['인천 개항장 거리', '홍대입구', '노원', '사당'], day: 'weekday', time: '20:00', intent: 'cross-region' },
  { id: 'weekend-east-west', origins: ['강남', '홍대입구'], day: 'weekend', time: '15:00', intent: 'rail' },
  { id: 'weekend-north-south', origins: ['노원', '사당'], day: 'weekend', time: '14:00', intent: 'mixed' },
  { id: 'weekend-cross-region-four', origins: ['수원메쎄', '인천 개항장 거리', '왕십리', '판교역서편(07-455)'], day: 'weekend', time: '16:00', intent: 'cross-region' },
  { id: 'weekday-bus-morning', origins: ['판교역서편(07-455)', '태평2동행정복지센터(05-058)'], day: 'weekday', time: '08:30', intent: 'bus' },
  { id: 'weekday-suwon-bus', origins: ['권선배움마루', '강남'], day: 'weekday', time: '12:30', intent: 'bus' },
  { id: 'weekday-late', origins: ['홍대입구', '잠실'], day: 'weekday', time: '23:30', intent: 'last-service' },
  { id: 'weekday-midnight', origins: ['서울역', '노원'], day: 'weekday', time: '00:20', intent: 'midnight' },
  { id: 'weekend-midnight', origins: ['신도림', '강남'], day: 'weekend', time: '00:30', intent: 'midnight' },
  { id: 'weekend-early', origins: ['서울역', '왕십리'], day: 'weekend', time: '05:30', intent: 'first-service' },
  { id: 'same-origin-two', origins: ['강남', '강남'], day: 'any', time: '15:00', intent: 'same-origin' },
  { id: 'same-origin-four', origins: ['서울역', '서울역', '서울역', '서울역'], day: 'any', time: '18:00', intent: 'same-origin' },
  { id: 'duplicate-plus-distant', origins: ['홍대입구', '홍대입구', '잠실'], day: 'any', time: '17:30', intent: 'same-origin' },
  { id: 'transfer-north', origins: ['노원', '왕십리', '종로3가'], day: 'any', time: '16:30', intent: 'transfer' },
  { id: 'bus-rail-transfer', origins: ['판교역서편(07-455)', '신도림', '잠실'], day: 'any', time: '17:00', intent: 'mixed' },
  { id: 'late-four', origins: ['노원', '신도림', '잠실', '홍대입구'], day: 'any', time: '23:50', intent: 'last-service' },
  { id: 'early-four', origins: ['노원', '사당', '종로3가', '왕십리'], day: 'any', time: '06:00', intent: 'first-service' },
] as const;
