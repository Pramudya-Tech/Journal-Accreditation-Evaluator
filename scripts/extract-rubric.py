"""Read-only OOXML extraction. No Excel dependency; source text is preserved."""
import sys, json, re, zipfile, hashlib
from pathlib import Path
from xml.etree import ElementTree as E

source = Path(sys.argv[1])
out = Path(__file__).resolve().parents[1] / 'public' / 'rubric.json'
ns = {'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(source) as z:
    strings = [''.join(x.itertext()) for x in E.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',ns)] if 'xl/sharedStrings.xml' in z.namelist() else []
    rows = E.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('.//m:row',ns)
    sections, section, criterion = [], None, None
    for row in rows:
        vals = {}
        for cell in row.findall('m:c',ns):
            v=cell.find('m:v',ns)
            value=strings[int(v.text)] if cell.get('t')=='s' and v is not None else (''.join(cell.find('m:is',ns).itertext()) if cell.get('t')=='inlineStr' else (v.text if v is not None else ''))
            vals[re.sub(r'\d','',cell.get('r'))]=value
        text=vals.get('C',''); rn=int(row.get('r'))
        if vals.get('A','').isdigit() and text:
            section={'id':int(vals['A']), 'title':text, 'sourceRow':rn,'criteria':[]}
            sections.append(section); criterion=None
            if section['id']==1:
                criterion={'id':'1','letter':'','title':text,'sourceRow':rn,'options':[]}
                section['criteria'].append(criterion)
        elif vals.get('B','').strip() in list('abcdefghi') and section:
            letter=vals['B'].strip()
            criterion={'id':f"{section['id']}{letter}",'letter':letter,'title':text,'sourceRow':rn,'options':[]}
            section['criteria'].append(criterion)
        elif criterion and re.search(r'\(Skor\s*(-?\d+(?:\.\d+)?)\)',text):
            score=float(re.search(r'\(Skor\s*(-?\d+(?:\.\d+)?)\)',text).group(1))
            criterion['options'].append({'score':score,'label':text,'sourceCell':f'C{rn}'})
    for sec in sections:
        for c in sec['criteria']:
            if sec['id']==8:
                c['options'].append({'score':0,'label':'Tidak ada disinsentif yang teridentifikasi setelah verifikasi bukti (0).','appAdded':True})
            c['max']=max(o['score'] for o in c['options'])
        sec['max']=sum(c['max'] for c in sec['criteria'])
data={'version':'borang-upload-2026-09-28','sourceFilename':source.name,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sheet':'Borang','maximum':sum(s['max'] for s in sections),'rankFormulaCell':'D159','rankBands':[{'min':90,'label':'SINTA 1'},{'min':80,'label':'SINTA 2'},{'min':70,'label':'SINTA 3'},{'min':60,'label':'SINTA 4'},{'min':None,'label':'Tidak Terakreditasi (model borang)'}],'sections':sections}
out.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'sections':[(s['id'],s['title'],len(s['criteria']),s['max']) for s in sections],'criteria':sum(len(s['criteria']) for s in sections),'sourceOptions':sum(len(c['options']) for s in sections for c in s['criteria'])-2,'max':data['maximum']},ensure_ascii=False))
