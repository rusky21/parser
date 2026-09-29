import re

with open('frontend/src/data/mockLeads.ts', 'r', encoding='utf-8') as f:
    text = f.read()

names = [
    'Dental Lux', 'Kazan Smile', 'Dr. Stom', 'Euro Dent', 'Dental Park',
    'Nova Clinic', 'Dent Art Plus', 'Stoma Family', 'Dentist 24', '32 Zuba',
    'Prestige Dent', 'Crown Dental', 'Dental Care Pro', 'Tatarstan Dent', 'VIP Stom',
    'Dent Master', 'Smile Craft', 'Apex Dental', 'City Dent', 'Alpha Dental',
    'Med Dent Kazan', 'Neo Dental'
]
statuses = ['No Website', 'No SSL', 'Not Responsive', 'No Analytics', 'HTTPS OK']

lines = []
for idx, name in enumerate(names, start=13):
    st = statuses[(idx - 13) % len(statuses)]
    has_web = st != 'No Website'
    phone = f'+7 843 {200 + idx}-{1000 + idx * 17}'
    clean_name = name.lower().replace(' ', '_').replace('.', '')
    clean_domain = name.lower().replace(' ', '').replace('.', '')
    tg = f'@{clean_name}_kzn'
    web_val = f"'https://{clean_domain}.ru'" if has_web else 'undefined'
    has_web_str = 'true' if has_web else 'false'
    mobile_str = 'false' if (st == 'Not Responsive' or not has_web) else 'true'
    ssl_str = 'false' if (st in ['No SSL', 'No Website']) else 'true'
    analytics_str = 'false' if (st in ['No Analytics', 'No Website']) else 'true'
    rating = 3 + (idx % 3)
    item = f"""  {{
    id: {idx},
    name: '{name}',
    rating: {rating},
    category: 'Dentistry',
    phone: '{phone}',
    telegram: '{tg}',
    status: '{st}',
    website: {web_val},
    hasWebsite: {has_web_str},
    mobileFriendly: {mobile_str},
    hasSsl: {ssl_str},
    hasAnalytics: {analytics_str},
    address: 'ул. Стоматологическая, {idx}, Казань',
  }},"""
    lines.append(item)

split_token = 'export const generateLeadsFor'
idx = text.rfind('];')
if idx != -1:
    new_text = text[:idx] + '\n'.join(lines) + '\n' + text[idx:]
    with open('frontend/src/data/mockLeads.ts', 'w', encoding='utf-8') as f:
        f.write(new_text)
    print('Updated successfully to 34 leads!')
