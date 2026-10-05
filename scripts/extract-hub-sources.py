"""Extract the public bus XLSX into JSON using only Python's standard library.

Run from repository root after downloading the official source. This preserves
the original values; candidate selection and review live in build-hubs.mjs.
"""
import json
from pathlib import Path
import xml.etree.ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with ZipFile(ROOT / 'data/raw/seoul-bus-20260902.xlsx') as archive:
    strings = [''.join(e.itertext()) for e in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('s:si', NS)]
    sheet = ET.fromstring(archive.read('xl/worksheets/sheet1.xml'))
    rows = []
    for row in sheet.findall('s:sheetData/s:row', NS):
        values = [None] * 6
        for cell in row.findall('s:c', NS):
            column = ''.join(c for c in cell.attrib['r'] if c.isalpha())
            if column not in 'ABCDEF' or len(column) != 1:
                continue
            value = cell.find('s:v', NS)
            if value is not None:
                text = value.text
                values[ord(column) - ord('A')] = strings[int(text)] if cell.get('t') == 's' else float(text)
        if any(v is not None for v in values):
            rows.append(values)
assert rows[0] == ['NODE_ID', 'ARS_ID', '정류소명', 'X좌표', 'Y좌표', '정류소타입'], 'Source schema changed'
records = [{'NODE_ID': str(int(r[0])), 'ARS_ID': str(r[1]), 'name': r[2], 'lng': r[3], 'lat': r[4], 'type': r[5]} for r in rows[1:]]
(ROOT / 'data/raw/seoul-bus-20260902.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Extracted {len(records)} source bus records')
