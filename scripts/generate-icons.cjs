const fs = require('fs');
const path = require('path');
const png2icons = require('png2icons');
const resedit = require('resedit');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function main() {
  console.log('[ICON-GEN] Starting cross-platform icon generation...');

  const dirs = [
    'build-resources',
    'build',
    'build/icons',
    'public',
    'src-tauri/icons'
  ];
  dirs.forEach(ensureDir);

  // Find master image
  const candidateImages = [
    'build-resources/512x512.png',
    'build-resources/1024x1024.png',
    'src/assets/images/cutecut_app_icon_1787658493341.jpg',
    'src/assets/images/app_icon_scissors_1787647460734.jpg'
  ];

  let masterPngBuffer = null;
  for (const candidate of candidateImages) {
    if (fs.existsSync(candidate)) {
      if (candidate.endsWith('.png')) {
        masterPngBuffer = fs.readFileSync(candidate);
        console.log(`[ICON-GEN] Using source PNG: ${candidate}`);
        break;
      }
    }
  }

  if (!masterPngBuffer) {
    throw new Error('No valid source master PNG image found');
  }

  // 1. Generate ICO for Windows (using png2icons with 256, 128, 64, 48, 32, 16)
  console.log('[ICON-GEN] Generating Windows ICO...');
  const icoBuffer = png2icons.createICO(masterPngBuffer, png2icons.BILINEAR, 0, false, true);
  if (!icoBuffer) {
    throw new Error('Failed to generate ICO buffer with png2icons');
  }

  // Validate ICO with resedit (same engine used by electron-builder)
  try {
    const iconFile = resedit.Data.IconFile.from(icoBuffer);
    console.log(`[ICON-GEN] resedit validation SUCCESS: parsed ${iconFile.icons.length} icon frames.`);
  } catch (err) {
    console.error('[ICON-GEN] resedit validation FAILED:', err);
    throw err;
  }

  // Write ICO to all required locations
  const icoTargets = [
    'build-resources/icon.ico',
    'build/icon.ico',
    'build/icons/icon.ico',
    'public/icon.ico',
    'icon.ico'
  ];
  icoTargets.forEach(target => {
    fs.writeFileSync(target, icoBuffer);
    console.log(`[ICON-GEN] Wrote ${target} (${icoBuffer.length} bytes)`);
  });

  // 2. Generate ICNS for macOS
  console.log('[ICON-GEN] Generating macOS ICNS...');
  const icnsBuffer = png2icons.createICNS(masterPngBuffer, png2icons.BILINEAR, 0);
  if (icnsBuffer) {
    const icnsTargets = [
      'build-resources/icon.icns',
      'build/icon.icns',
      'build/icons/icon.icns',
      'public/icon.icns',
      'icon.icns'
    ];
    icnsTargets.forEach(target => {
      fs.writeFileSync(target, icnsBuffer);
      console.log(`[ICON-GEN] Wrote ${target} (${icnsBuffer.length} bytes)`);
    });
  }

  // 3. Write standard PNGs
  const pngTargets = [
    'build-resources/icon.png',
    'build/icon.png',
    'build/icons/icon.png',
    'public/icon.png',
    'src-tauri/icons/icon.png',
    'src-tauri/icons/512x512.png',
    'icon.png'
  ];
  pngTargets.forEach(target => {
    fs.writeFileSync(target, masterPngBuffer);
    console.log(`[ICON-GEN] Wrote ${target}`);
  });

  console.log('[ICON-GEN] All application desktop icons generated & validated successfully!');
}

main().catch(err => {
  console.error('[ICON-GEN] Fatal error generating icons:', err);
  process.exit(1);
});
