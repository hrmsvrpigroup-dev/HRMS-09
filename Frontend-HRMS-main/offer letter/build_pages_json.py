import json
import re

with open(r'c:\Users\shiva\OneDrive\Desktop\hrms-lastest\Frontend-HRMS-main\offer letter\full_14_pages.html', 'r', encoding='utf-8') as f:
    raw = f.read()

pages = raw.split('<!-- PAGE BREAK')
page_data = []

for idx, p in enumerate(pages):
    cleaned = p.strip()
    # clean leading hr/break if present
    cleaned = re.sub(r'^\(Page \d+\) -->\s*<hr class="page-break" data-page="\d+"/>', '', cleaned).strip()
    page_data.append({
        'pageNumber': idx + 1,
        'html': cleaned
    })

print(f'Total pages parsed: {len(page_data)}')
with open(r'c:\Users\shiva\OneDrive\Desktop\hrms-lastest\Frontend-HRMS-main\offer letter\parsed_14_pages.json', 'w', encoding='utf-8') as f:
    json.dump(page_data, f, indent=2, ensure_ascii=False)

print('Saved to parsed_14_pages.json')
