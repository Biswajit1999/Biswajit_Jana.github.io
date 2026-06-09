#!/usr/bin/env python3
"""
Script to scan your My Gallery folder and generate the IMAGES array
for gallery.html

Usage:
    1. Place this script in: Biswajit_Jana.github.io/
    2. Run: python3 generate_images_list.py
    3. Copy the output into gallery.html IMAGES array
"""

import os
from pathlib import Path

# Image extensions to look for
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'}

def get_images():
    """Scan My Gallery folder and return list of images"""
    gallery_path = Path('My Gallery')
    
    if not gallery_path.exists():
        print("❌ 'My Gallery' folder not found!")
        print("Please create it in your repo root: Biswajit_Jana.github.io/My Gallery/")
        return []
    
    images = []
    files = sorted(gallery_path.glob('*'))
    
    for file in files:
        if file.is_file() and file.suffix.lower() in IMAGE_EXTENSIONS:
            images.append(file.name)
    
    return images

def generate_javascript_array(images):
    """Generate JavaScript array code"""
    if not images:
        print("❌ No images found in My Gallery folder!")
        return
    
    print("\n" + "="*70)
    print(f"Found {len(images)} images in 'My Gallery' folder")
    print("="*70 + "\n")
    
    print("Copy this into gallery.html (replace the IMAGES array):\n")
    print("const IMAGES = [")
    
    for i, filename in enumerate(images, 1):
        # Create a basic title from filename
        title = filename.rsplit('.', 1)[0]  # Remove extension
        title = title.replace('_', ' ').replace('-', ' ')
        
        print(f'  {{ file: \'{filename}\', title: \'{title}\' }},')
    
    print("];")
    
    print(f"\n" + "="*70)
    print(f"✅ Total: {len(images)} images")
    print("="*70 + "\n")
    
    print("📋 Filenames found:")
    for i, filename in enumerate(images, 1):
        print(f"   {i:2d}. {filename}")

if __name__ == '__main__':
    images = get_images()
    if images:
        generate_javascript_array(images)
