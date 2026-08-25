#!/bin/bash
set -e

SRC="src/assets/images/cutecut_app_icon_1787658493341.jpg"

mkdir -p build-resources build build/icons public src-tauri/icons

echo "Converting source JPG to clean 1024x1024 PNG..."
convert "$SRC" -resize 1024x1024 PNG32:master_1024.png

echo "Generating standard Windows ICO with ImageMagick..."
convert master_1024.png -define icon:auto-resize=256,128,64,48,32,16 build-resources/icon.ico
cp build-resources/icon.ico build/icon.ico
cp build-resources/icon.ico build/icons/icon.ico
cp build-resources/icon.ico public/icon.ico
cp build-resources/icon.ico icon.ico
console_log="Saved standard ImageMagick icon.ico"

echo "Generating ICNS with png2icons..."
node -e "
const fs = require('fs');
const png2icons = require('png2icons');

const masterPng = fs.readFileSync('master_1024.png');
const icns = png2icons.createICNS(masterPng, png2icons.BILINEAR, 0);
if (icns) {
  fs.writeFileSync('build-resources/icon.icns', icns);
  fs.writeFileSync('build/icon.icns', icns);
  fs.writeFileSync('build/icons/icon.icns', icns);
  fs.writeFileSync('public/icon.icns', icns);
  fs.writeFileSync('icon.icns', icns);
  console.log('Saved icon.icns');
}
"

echo "Generating PNG sizes..."
for SIZE in 1024 512 256 128 96 64 48 32 24 16; do
  convert master_1024.png -resize ${SIZE}x${SIZE} PNG32:build-resources/${SIZE}x${SIZE}.png
  cp build-resources/${SIZE}x${SIZE}.png build/icons/${SIZE}x${SIZE}.png
  cp build-resources/${SIZE}x${SIZE}.png src-tauri/icons/${SIZE}x${SIZE}.png
done

cp build-resources/512x512.png build-resources/icon.png
cp build-resources/512x512.png build/icon.png
cp build-resources/512x512.png build/icons/icon.png
cp build-resources/512x512.png public/icon.png
cp build-resources/512x512.png src-tauri/icons/icon.png
cp build-resources/512x512.png src-tauri/icons/512x512.png
cp build-resources/512x512.png icon.png

rm -f master_1024.png
echo "Icon generation complete!"
