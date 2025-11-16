#!/usr/bin/env python3
"""
Detailed analysis of unused CSS, JS, and HTML elements.
Checks JavaScript usage of CSS selectors.
"""
import re
import os
from collections import defaultdict
from pathlib import Path

def extract_html_classes_and_ids(html_content):
    """Extract all class names and IDs from HTML."""
    classes = set()
    ids = set()
    
    class_pattern = r'class=["\']([^"\']+)["\']'
    for match in re.finditer(class_pattern, html_content):
        for cls in match.group(1).split():
            classes.add(cls)
    
    id_pattern = r'id=["\']([^"\']+)["\']'
    for match in re.finditer(id_pattern, html_content):
        ids.add(match.group(1))
    
    return classes, ids

def extract_css_selectors(css_content):
    """Extract CSS selectors from CSS content."""
    selectors = set()
    css_content = re.sub(r'/\*.*?\*/', '', css_content, flags=re.DOTALL)
    
    selector_pattern = r'([^{]+)\{'
    for match in re.finditer(selector_pattern, css_content):
        selector_text = match.group(1).strip()
        if selector_text.startswith('@'):
            continue
        for sel in selector_text.split(','):
            sel = sel.strip()
            for cls_match in re.finditer(r'\.([a-zA-Z_-][a-zA-Z0-9_-]*)', sel):
                selectors.add('.' + cls_match.group(1))
            for id_match in re.finditer(r'#([a-zA-Z_-][a-zA-Z0-9_-]*)', sel):
                selectors.add('#' + id_match.group(1))
    
    return selectors

def extract_js_references(js_content):
    """Extract CSS class/ID references from JavaScript."""
    references = set()
    
    # getElementById, querySelector, etc.
    patterns = [
        r'getElementById\(["\']([^"\']+)["\']\)',
        r'querySelector\(["\']([^"\']+)["\']\)',
        r'querySelectorAll\(["\']([^"\']+)["\']\)',
        r'getElementsByClassName\(["\']([^"\']+)["\']\)',
        r'\.classList\.(?:add|remove|toggle|contains)\(["\']([^"\']+)["\']\)',
        r'classList\.(?:add|remove|toggle|contains)\(["\']([^"\']+)["\']\)',
        r'\.className\s*[=+]\s*["\']([^"\']+)["\']',
        r'class\s*=\s*["\']([^"\']+)["\']',
    ]
    
    for pattern in patterns:
        for match in re.finditer(pattern, js_content):
            ref = match.group(1)
            # Extract class names and IDs
            if ref.startswith('.'):
                references.add(ref)
            elif ref.startswith('#'):
                references.add(ref)
            else:
                # Could be a class or ID, check if it's in HTML
                references.add('.' + ref)
                references.add('#' + ref)
    
    # Also check for template literals and string concatenation
    template_pattern = r'[`"\'][^`"\']*\.([a-zA-Z_-][a-zA-Z0-9_-]*)[^`"\']*[`"\']'
    for match in re.finditer(template_pattern, js_content):
        references.add('.' + match.group(1))
    
    return references

def main():
    base_path = Path(__file__).parent
    
    # Read HTML
    html_file = base_path / 'index.html'
    with open(html_file, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    html_classes, html_ids = extract_html_classes_and_ids(html_content)
    
    # Read CSS files
    css_dir = base_path / 'lp01' / 'common' / 'css'
    all_css_selectors = set()
    css_files = []
    
    for css_file in css_dir.glob('*.css'):
        if css_file.name.endswith('.bak'):
            continue
        css_files.append(css_file)
        with open(css_file, 'r', encoding='utf-8') as f:
            css_content = f.read()
        selectors = extract_css_selectors(css_content)
        all_css_selectors.update(selectors)
    
    # Read JavaScript files
    js_dir = base_path / 'lp01' / 'common' / 'js'
    all_js_references = set()
    
    for js_file in js_dir.glob('*.js'):
        with open(js_file, 'r', encoding='utf-8') as f:
            js_content = f.read()
        refs = extract_js_references(js_content)
        all_js_references.update(refs)
    
    # Extract inline scripts from HTML
    inline_script_pattern = r'<script[^>]*>(.*?)</script>'
    for match in re.finditer(inline_script_pattern, html_content, re.DOTALL):
        script_content = match.group(1)
        if 'src=' not in match.group(0):
            refs = extract_js_references(script_content)
            all_js_references.update(refs)
    
    # Find truly unused CSS (not in HTML and not referenced in JS)
    css_class_names = {s[1:] for s in all_css_selectors if s.startswith('.')}
    css_id_names = {s[1:] for s in all_css_selectors if s.startswith('#')}
    
    js_class_names = {s[1:] for s in all_js_references if s.startswith('.')}
    js_id_names = {s[1:] for s in all_js_references if s.startswith('#')}
    
    # Unused CSS classes (not in HTML and not in JS)
    unused_css_classes = []
    for selector in all_css_selectors:
        if selector.startswith('.'):
            class_name = selector[1:]
            if class_name not in html_classes and class_name not in js_class_names:
                unused_css_classes.append(selector)
    
    # Unused CSS IDs (not in HTML and not in JS)
    unused_css_ids = []
    for selector in all_css_selectors:
        if selector.startswith('#'):
            id_name = selector[1:]
            if id_name not in html_ids and id_name not in js_id_names:
                unused_css_ids.append(selector)
    
    print("=" * 70)
    print("UNUSED CSS ANALYSIS")
    print("=" * 70)
    print(f"\nTotal CSS selectors found: {len(all_css_selectors)}")
    print(f"Total HTML classes: {len(html_classes)}")
    print(f"Total HTML IDs: {len(html_ids)}")
    print(f"Total JS references: {len(all_js_references)}")
    
    print(f"\n=== UNUSED CSS CLASSES ({len(unused_css_classes)}) ===")
    if unused_css_classes:
        for cls in sorted(unused_css_classes)[:50]:  # Show first 50
            print(f"  {cls}")
        if len(unused_css_classes) > 50:
            print(f"  ... and {len(unused_css_classes) - 50} more")
    else:
        print("  None found!")
    
    print(f"\n=== UNUSED CSS IDs ({len(unused_css_ids)}) ===")
    if unused_css_ids:
        for id_sel in sorted(unused_css_ids)[:50]:  # Show first 50
            print(f"  {id_sel}")
        if len(unused_css_ids) > 50:
            print(f"  ... and {len(unused_css_ids) - 50} more")
    else:
        print("  None found!")
    
    # HTML classes/IDs used in JS but not in CSS (dynamic usage)
    js_only_classes = js_class_names - css_class_names
    js_only_ids = js_id_names - css_id_names
    
    if js_only_classes:
        print(f"\n=== HTML CLASSES USED IN JS BUT NOT IN CSS ({len(js_only_classes)}) ===")
        for cls in sorted(js_only_classes):
            print(f"  .{cls}")
    
    if js_only_ids:
        print(f"\n=== HTML IDs USED IN JS BUT NOT IN CSS ({len(js_only_ids)}) ===")
        for id_name in sorted(js_only_ids):
            print(f"  #{id_name}")
    
    # Check for commented HTML that might contain useful info
    commented_pattern = r'<!--(.*?)-->'
    commented_blocks = list(re.finditer(commented_pattern, html_content, re.DOTALL))
    if commented_blocks:
        print(f"\n=== COMMENTED OUT HTML BLOCKS ({len(commented_blocks)}) ===")
        for i, match in enumerate(commented_blocks[:5]):
            content = match.group(1).strip()[:80]
            print(f"  {i+1}. {content}...")
        if len(commented_blocks) > 5:
            print(f"  ... and {len(commented_blocks) - 5} more")
    
    # Summary
    total_unused = len(unused_css_classes) + len(unused_css_ids)
    print(f"\n=== SUMMARY ===")
    print(f"Total unused CSS selectors: {total_unused}")
    print(f"  - Unused classes: {len(unused_css_classes)}")
    print(f"  - Unused IDs: {len(unused_css_ids)}")
    if total_unused > 0:
        percentage = (total_unused / len(all_css_selectors)) * 100
        print(f"Percentage of unused CSS: {percentage:.1f}%")

if __name__ == '__main__':
    main()

