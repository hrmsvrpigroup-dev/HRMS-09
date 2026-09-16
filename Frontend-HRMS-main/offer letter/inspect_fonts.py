import zipfile
import xml.etree.ElementTree as ET
import re

docx_path = r'c:\Users\shiva\OneDrive\Desktop\hrms-lastest\Frontend-HRMS-main\offer letter\VR PI Offer Desineedi Mohitha 8,00,000 - Copy.docx'

with zipfile.ZipFile(docx_path, 'r') as z:
    font_xml = z.read('word/fontTable.xml').decode('utf-8', errors='ignore')
    fonts = re.findall(r'w:name="([^"]+)"', font_xml)
    print('Fonts in fontTable.xml:', set(fonts))
    
    doc_xml = z.read('word/document.xml').decode('utf-8', errors='ignore')
    doc_fonts = re.findall(r'w:ascii="([^"]+)"', doc_xml)
    print('Fonts in document.xml:', set(doc_fonts))
    
    # Check font sizes: w:sz val="X" (half points, so val="24" is 12pt, val="20" is 10pt, val="22" is 11pt)
    sizes = re.findall(r'w:sz w:val="(\d+)"', doc_xml)
    print('Font sizes (half-points):', set(sizes))
    
    # Check paragraph line spacing: w:spacing
    spacing = re.findall(r'w:spacing[^>]+', doc_xml)
    print('Sample spacings:', spacing[:10])
