#!/bin/bash
# 构建 macOS 写作台 App（本地 ad-hoc 签名，不需要 Xcode 工程）
set -euo pipefail
cd "$(dirname "$0")/.."

APP_NAME="木鱼书店"
BUNDLE="$(pwd)/${APP_NAME}.app"
BIN_NAME="MuyuStudio"
IDENTIFIER="io.github.shannonmyang.studio"
VERSION="2.0.0"

echo "→ 清理旧 App"
rm -rf "$BUNDLE"
mkdir -p "$BUNDLE/Contents/MacOS" "$BUNDLE/Contents/Resources"

echo "→ 编译 Swift 外壳"
mkdir -p .tmp/swift-module-cache
export CLANG_MODULE_CACHE_PATH="$PWD/.tmp/swift-module-cache"
swiftc -O -swift-version 5 -module-cache-path "$PWD/.tmp/swift-module-cache" \
  -framework Cocoa -framework WebKit \
  studio/mac/main.swift \
  -o "$BUNDLE/Contents/MacOS/$BIN_NAME"

echo "→ 生成应用图标"
if python3 -c 'import PIL' >/dev/null 2>&1; then
  ICONSET="$(mktemp -d)/AppIcon.iconset"
  mkdir -p "$ICONSET"
  python3 - "$ICONSET" <<'PY'
from PIL import Image
import sys, os
src = Image.open('theme/assets/icon-512.png').convert('RGB').resize((1024, 1024), Image.LANCZOS)
out = sys.argv[1]
for size in [16, 32, 64, 128, 256, 512, 1024]:
    src.resize((size, size), Image.LANCZOS).save(os.path.join(out, f'icon_{size}x{size}.png'))
    if size <= 512:
        src.resize((size * 2, size * 2), Image.LANCZOS).save(os.path.join(out, f'icon_{size}x{size}@2x.png'))
PY
  iconutil -c icns "$ICONSET" -o "$BUNDLE/Contents/Resources/AppIcon.icns" 2>/dev/null || true
else
  echo "  （未安装 Pillow，跳过自定义图标）"
fi

echo "→ 写入 Info.plist"
cat > "$BUNDLE/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>${APP_NAME}</string>
  <key>CFBundleDisplayName</key><string>${APP_NAME} · 写作台</string>
  <key>CFBundleIdentifier</key><string>${IDENTIFIER}</string>
  <key>CFBundleVersion</key><string>${VERSION}</string>
  <key>CFBundleShortVersionString</key><string>${VERSION}</string>
  <key>CFBundleExecutable</key><string>${BIN_NAME}</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSHumanReadableCopyright</key><string>© ${YEAR:-2026} ShannonMYang</string>
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsLocalNetworking</key><true/>
  </dict>
</dict>
</plist>
PLIST

echo "→ 本地签名（ad-hoc）"
codesign --force --deep --sign - "$BUNDLE" >/dev/null 2>&1 || true
xattr -dr com.apple.quarantine "$BUNDLE" 2>/dev/null || true

echo "✓ 完成：$BUNDLE"
echo "  双击即可打开写作台；本地服务会随 App 启动和退出。"
