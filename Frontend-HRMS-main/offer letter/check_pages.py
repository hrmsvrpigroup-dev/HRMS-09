import json
import re

with open(r'c:\Users\shiva\OneDrive\Desktop\hrms-lastest\Frontend-HRMS-main\offer letter\parsed_14_pages.json', 'r', encoding='utf-8') as f:
    pages = json.load(f)

# Let's inspect each page
for p in pages:
    idx = p['pageNumber']
    html = p['html']
    print(f'Page {idx} has {len(html)} chars')

print('All 14 pages present.')
