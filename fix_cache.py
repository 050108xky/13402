import re, time

v = str(int(time.time()))
p = r'C:\Users\13268\Desktop\工作\Advices\index.html'

with open(p, 'r', encoding='utf-8') as f:
    content = f.read()

# Update style.css version
content = re.sub(r'style\.css\?v=\w+', f'style.css?v={v}', content)

# Add version to all js/ scripts
def add_ver(m):
    src = m.group(1)
    base = src.split('?')[0]
    return f'<script src="{base}?v={v}"></script>'

content = re.sub(r'<script src="(js/[^"]+)">\s*</script>', add_ver, content)

with open(p, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Cache busted: v={v}')
