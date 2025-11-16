#!/usr/bin/env python3
"""
Analyze unused CSS classes, IDs, and JavaScript in the codebase.
"""
import re
import os
from collections import defaultdict
from pathlib import Path

def extract_html_classes_and_ids(html_content):
    """Extract all class names and IDs from HTML."""
    classes = set()
    ids = set()
    
    # Extract class attributes
    class_pattern = r'class=["\']([^"\']+)["\']'
    for match in re.finditer(class_pattern, html_content):
        class_attr = match.group(1)
        # Split by whitespace to get individual classes
        for cls in class_attr.split():
            classes.add(cls)
    
    # Extract id attributes
    id_pattern = r'id=["\']([^"\']+)["\']'
    for match in re.finditer(id_pattern, html_content):
        ids.add(match.group(1))
    
    return classes, ids

def extract_css_selectors(css_content):
    """Extract CSS selectors from CSS content."""
    selectors = set()
    
    # Remove comments
    css_content = re.sub(r'/\*.*?\*/', '', css_content, flags=re.DOTALL)
    
    # Extract selectors (before {)
    # Match selectors like .class, #id, element, etc.
    selector_pattern = r'([^{]+)\{'
    for match in re.finditer(selector_pattern, css_content):
        selector_text = match.group(1).strip()
        # Split by comma to handle multiple selectors
        for sel in selector_text.split(','):
            sel = sel.strip()
            # Skip @ rules
            if sel.startswith('@'):
                continue
            # Extract class and ID selectors
            # Class selectors
            for cls_match in re.finditer(r'\.([a-zA-Z_-][a-zA-Z0-9_-]*)', sel):
                selectors.add('.' + cls_match.group(1))
            # ID selectors
            for id_match in re.finditer(r'#([a-zA-Z_-][a-zA-Z0-9_-]*)', sel):
                selectors.add('#' + id_match.group(1))
    
    return selectors

def extract_js_identifiers(js_content):
    """Extract function names and variables from JavaScript."""
    identifiers = set()
    
    # Remove comments
    js_content = re.sub(r'//.*?$', '', js_content, flags=re.MULTILINE)
    js_content = re.sub(r'/\*.*?\*/', '', js_content, flags=re.DOTALL)
    
    # Extract function declarations
    func_pattern = r'function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\('
    for match in re.finditer(func_pattern, js_content):
        identifiers.add(match.group(1))
    
    # Extract variable declarations (var, let, const)
    var_pattern = r'(?:var|let|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)'
    for match in re.finditer(var_pattern, js_content):
        identifiers.add(match.group(1))
    
    # Extract method calls on document/window (common DOM operations)
    dom_pattern = r'(?:document|window)\.([a-zA-Z_$][a-zA-Z0-9_$]*)'
    for match in re.finditer(dom_pattern, js_content):
        identifiers.add(match.group(1))
    
    return identifiers

def find_unused_css(css_selectors, html_classes, html_ids):
    """Find CSS selectors that aren't used in HTML."""
    unused = []
    
    for selector in css_selectors:
        if selector.startswith('.'):
            class_name = selector[1:]  # Remove the dot
            if class_name not in html_classes:
                unused.append(selector)
        elif selector.startswith('#'):
            id_name = selector[1:]  # Remove the hash
            if id_name not in html_ids:
                unused.append(selector)
    
    return unused

def main():
    base_path = Path(__file__).parent
    
    # Read HTML
    html_file = base_path / 'index.html'
    if not html_file.exists():
        print(f"Error: {html_file} not found")
        return
    
    with open(html_file, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    html_classes, html_ids = extract_html_classes_and_ids(html_content)
    print(f"Found {len(html_classes)} classes and {len(html_ids)} IDs in HTML\n")
    
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
        print(f"Found {len(selectors)} selectors in {css_file.name}")
    
    print(f"\nTotal unique CSS selectors: {len(all_css_selectors)}\n")
    
    # Find unused CSS
    unused_css = find_unused_css(all_css_selectors, html_classes, html_ids)
    
    if unused_css:
        print(f"=== UNUSED CSS SELECTORS ({len(unused_css)}) ===")
        for selector in sorted(unused_css):
            print(f"  {selector}")
    else:
        print("No unused CSS selectors found!")
    
    # Read JavaScript files
    js_dir = base_path / 'lp01' / 'common' / 'js'
    all_js_identifiers = set()
    js_files = []
    
    for js_file in js_dir.glob('*.js'):
        js_files.append(js_file)
        with open(js_file, 'r', encoding='utf-8') as f:
            js_content = f.read()
        identifiers = extract_js_identifiers(js_content)
        all_js_identifiers.update(identifiers)
        print(f"\nFound {len(identifiers)} identifiers in {js_file.name}")
    
    # Also check inline scripts in HTML
    inline_script_pattern = r'<script[^>]*>(.*?)</script>'
    for match in re.finditer(inline_script_pattern, html_content, re.DOTALL):
        script_content = match.group(1)
        if 'src=' not in match.group(0):  # Only inline scripts
            identifiers = extract_js_identifiers(script_content)
            all_js_identifiers.update(identifiers)
            print(f"Found {len(identifiers)} identifiers in inline scripts")
    
    print(f"\nTotal unique JS identifiers: {len(all_js_identifiers)}")
    
    # Check for unused HTML classes/IDs (reverse check)
    css_class_names = {s[1:] for s in all_css_selectors if s.startswith('.')}
    css_id_names = {s[1:] for s in all_css_selectors if s.startswith('#')}
    
    unused_html_classes = html_classes - css_class_names
    unused_html_ids = html_ids - css_id_names
    
    if unused_html_classes:
        print(f"\n=== HTML CLASSES WITHOUT CSS ({len(unused_html_classes)}) ===")
        for cls in sorted(unused_html_classes):
            print(f"  .{cls}")
    
    if unused_html_ids:
        print(f"\n=== HTML IDs WITHOUT CSS ({len(unused_html_ids)}) ===")
        for id_name in sorted(unused_html_ids):
            print(f"  #{id_name}")
    
    # Check for commented out HTML
    commented_pattern = r'<!--.*?-->'
    commented_matches = list(re.finditer(commented_pattern, html_content, re.DOTALL))
    if commented_matches:
        print(f"\n=== COMMENTED OUT HTML ({len(commented_matches)} blocks) ===")
        for i, match in enumerate(commented_matches[:10]):  # Show first 10
            content = match.group(0)[:100]  # First 100 chars
            print(f"  {i+1}. {content}...")
        if len(commented_matches) > 10:
            print(f"  ... and {len(commented_matches) - 10} more")

if __name__ == '__main__':
    main()

