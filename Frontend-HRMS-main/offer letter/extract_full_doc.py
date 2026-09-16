import zipfile
import xml.etree.ElementTree as ET

docx_path = r'c:\Users\shiva\OneDrive\Desktop\hrms-lastest\Frontend-HRMS-main\offer letter\VR PI Offer Desineedi Mohitha 8,00,000 - Copy.docx'

with zipfile.ZipFile(docx_path, 'r') as z:
    tree = ET.fromstring(z.read('word/document.xml'))

namespaces = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
}

body = tree.find('w:body', namespaces)
elements = list(body)

out = []
page = 1
for elem in elements:
    tag = elem.tag.split('}')[-1]
    if tag == 'p':
        breaks = elem.findall('.//w:br[@w:type="page"]', namespaces)
        last_breaks = elem.findall('.//w:lastRenderedPageBreak', namespaces)
        if breaks or last_breaks:
            page += 1
            out.append(f'<!-- PAGE BREAK (Page {page}) -->\n<hr class="page-break" data-page="{page}"/>\n')
            
        runs_text = []
        for r in elem.findall('.//w:r', namespaces):
            is_bold = r.find('.//w:b', namespaces) is not None
            is_underline = r.find('.//w:u', namespaces) is not None
            is_italic = r.find('.//w:i', namespaces) is not None
            t = ''.join([node.text for node in r.findall('.//w:t', namespaces) if node.text])
            if t:
                curr = t
                if is_bold:
                    curr = f'<strong>{curr}</strong>'
                if is_italic:
                    curr = f'<em>{curr}</em>'
                if is_underline:
                    curr = f'<u>{curr}</u>'
                runs_text.append(curr)
        p_text = ''.join(runs_text).strip()
        if p_text:
            out.append(f'<p>{p_text}</p>')
    elif tag == 'tbl':
        out.append('<table border="1" cellpadding="6" cellspacing="0" style="width:100%; border-collapse:collapse; margin: 12px 0;">')
        for tr in elem.findall('.//w:tr', namespaces):
            row_cells = []
            for tc in tr.findall('.//w:tc', namespaces):
                tc_runs = []
                for r in tc.findall('.//w:r', namespaces):
                    is_bold = r.find('.//w:b', namespaces) is not None
                    t = ''.join([node.text for node in r.findall('.//w:t', namespaces) if node.text])
                    if t:
                        if is_bold:
                            tc_runs.append(f'<strong>{t}</strong>')
                        else:
                            tc_runs.append(t)
                cell_content = ''.join(tc_runs).strip()
                row_cells.append(cell_content)
            out.append('  <tr>' + ''.join([f'<td style="padding:6px 8px; border:1px solid #cbd5e1;">{c}</td>' for c in row_cells]) + '</tr>')
        out.append('</table>')

full_html = '\n'.join(out)
with open(r'c:\Users\shiva\OneDrive\Desktop\hrms-lastest\Frontend-HRMS-main\offer letter\full_14_pages.html', 'w', encoding='utf-8') as f:
    f.write(full_html)

print(f'Successfully exported complete document! Total pages: {page}, Total output length: {len(full_html)} chars')
