import zipfile
import xml.etree.ElementTree as ET

docx_path = r'c:\Users\shiva\OneDrive\Desktop\hrms-lastest\Frontend-HRMS-main\offer letter\VR PI Offer Desineedi Mohitha 8,00,000 - Copy.docx'

with zipfile.ZipFile(docx_path, 'r') as z:
    doc_xml = z.read('word/document.xml')
    tree = ET.fromstring(doc_xml)
    namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    
    for i, p in enumerate(tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p')):
        if i > 25:
            break
        text = ''.join([node.text for node in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if node.text])
        if text.strip():
            # check pPr
            pPr = p.find('w:pPr', namespaces)
            jc = pPr.find('w:jc', namespaces) if pPr is not None else None
            align = jc.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val') if jc is not None else 'default'
            print(f'[{i}] (align:{align}) {text[:90]}')
