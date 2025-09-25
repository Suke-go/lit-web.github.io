# -*- coding: utf-8 -*-
from pathlib import Path

path = Path('index.html')
lines = path.read_text(encoding='utf-8-sig').splitlines(keepends=True)

points = [
    {
        'text': '大学受験以降も含めて考える点、自発的な発見を促す点で違います',
        'media_block': [
            '                  <div class="pointItem__leadMedia">\n',
            '                    <picture>\n',
            '                      <source media="(min-width: 768px)" srcset="img/placeholder.svg">\n',
            '                      <source media="(max-width: 768px)" srcset="img/placeholder.svg">\n',
            '                      <img src="img/placeholder.svg" width="360" height="361" alt="価値観の言語化（プレースホルダー）" loading="lazy">\n',
            '                    </picture>\n',
            '                  </div>\n',
            '\n'
        ],
    },
    {
        'text': '学習を「やらされているもの」から「目標達成への手段」へと変えるためです。',
        'media_block': [],
    },
    {
        'text': '大きく分けて3つのステップ「自己理解」「行動」「自立」に分かれます。',
        'media_block': [
            '                  <div class="pointItem__leadMedia">\n',
            '                    <picture>\n',
            '                      <source media="(min-width: 768px)" srcset="img/placeholder.svg">\n',
            '                      <source media="(max-width: 768px)" srcset="img/placeholder.svg">\n',
            '                      <img src="img/placeholder.svg" width="286" height="396" alt="Point 03" loading="lazy">\n',
            '                    </picture>\n',
            '                  </div>\n',
            '\n'
        ],
    },
    {
        'text': 'ほとんどの高校生に向いていると言えます。',
        'media_block': [
            '                  <div class="pointItem__leadMedia">\n',
            '                    <picture>\n',
            '                      <source media="(min-width: 768px)" srcset="img/placeholder.svg">\n',
            '                      <source media="(max-width: 768px)" srcset="img/placeholder.svg">\n',
            '                      <img src="img/placeholder.svg" width="286" height="396" alt="Point 04" loading="lazy">\n',
            '                    </picture>\n',
            '                  </div>\n',
            '\n'
        ],
    },
]

search_start = 0
for point in points:
    text = point['text']
    media_lines = point['media_block']
    for idx in range(search_start, len(lines)):
        if lines[idx].strip() == '<div class="pointItem__lead">':
            end = idx + 1
            while end < len(lines) and not lines[end].startswith('                </div>'):
                end += 1
            block_text = ''.join(lines[idx:end+1])
            if text in block_text:
                new_block = []
                new_block.append(lines[idx])
                new_block.extend(media_lines)
                new_block.append('                  <div class="pointItem__leadText">\n')
                new_block.append('\n')
                new_block.append(f'                    <p>{text}</p>\n')
                new_block.append('\n')
                new_block.append('                  </div>\n')
                new_block.append('\n')
                new_block.append('                </div>\n')
                lines[idx:end+1] = new_block
                search_start = idx + len(new_block)
                break
    else:
        raise SystemExit(f'lead block with text not found: {text}')

path.write_text(''.join(lines), encoding='utf-8-sig')
