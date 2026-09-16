import json
import re

with open(r'c:\Users\shiva\OneDrive\Desktop\hrms-lastest\Frontend-HRMS-main\offer letter\parsed_14_pages.json', 'r', encoding='utf-8') as f:
    pages = json.load(f)

def format_page_content(p_num, raw_html):
    # Split by <p> tags
    paras = re.findall(r'<p>(.*?)</p>', raw_html, re.DOTALL)
    if not paras:
        # fallback
        return raw_html
        
    formatted = []
    for p in paras:
        p_clean = p.strip().replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')
        if not p_clean:
            continue
            
        # Check if it is a major heading
        # E.g. starts with uppercase or <u><strong> or contains only a title
        is_sub_item_letter = re.match(r'^[a-z]\.\s+', p_clean)
        is_sub_item_num = re.match(r'^\d+\.\s+', p_clean)
        is_sub_item_roman = re.match(r'^(I|II|III|IV|V|VI|VII|VIII)\.\s+', p_clean)
        is_sub_item_bullet = re.match(r'^(o|•|\-)\s+', p_clean)
        
        # Check if starts with a bold clause heading like "<u><strong>Remuneration:</strong></u>" or "Remuneration:"
        has_clause_header_start = re.match(r'^(<u><strong>|<strong><u>|<strong>|<u>)([A-Z][a-zA-Z\s/\(\)\-&,]+:)(</u></strong>|</strong></u>|</strong>|</u>)', p_clean)
        
        if is_sub_item_letter:
            formatted.append(f'<p class="clause-item-letter">{p_clean}</p>')
        elif is_sub_item_roman:
            formatted.append(f'<p class="clause-item-roman">{p_clean}</p>')
        elif is_sub_item_num:
            formatted.append(f'<p class="clause-item-num">{p_clean}</p>')
        elif is_sub_item_bullet:
            formatted.append(f'<p class="clause-item-bullet">{p_clean}</p>')
        elif has_clause_header_start:
            formatted.append(f'<p class="clause-heading-para">{p_clean}</p>')
        elif p_clean.isupper() or (len(p_clean) < 60 and ('<strong>' in p_clean or '<u>' in p_clean)):
            formatted.append(f'<div class="section-title-box">{p_clean}</div>')
        else:
            formatted.append(f'<p class="body-para">{p_clean}</p>')
            
    return '\n'.join(formatted)

# Test on page 1, 2, 3
for i in [1, 2, 3]:
    print(f'=== FORMATTED PAGE {i} ===')
    res = format_page_content(i, pages[i-1]['html'])
    print(res[:400])
    print('-'*50)
