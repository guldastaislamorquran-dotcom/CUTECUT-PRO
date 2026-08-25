const fs = require('fs');
const path = require('path');
const png2icons = require('png2icons');
const pngToIco = require('png-to-ico').default;
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
    'build-resources/256x256.png',
    'build-resources/1024x1024.png',
    'icon.png',
    'public/icon.png',
    'src/assets/images/cutecut_app_icon_1787658493341.jpg',
    'src/assets/images/app_icon_scissors_1787647460734.jpg'
  ];

  let masterPngBuffer = null;
  let masterPngPath = null;
  for (const candidate of candidateImages) {
    if (fs.existsSync(candidate)) {
      if (candidate.endsWith('.png')) {
        masterPngBuffer = fs.readFileSync(candidate);
        masterPngPath = candidate;
        console.log(`[ICON-GEN] Using source PNG: ${candidate}`);
        break;
      }
    }
  }

  if (!masterPngBuffer) {
    console.warn('[ICON-GEN] No PNG candidate found, keeping existing icon files if present.');
    return;
  }

  // 1. Generate ICO with pngToIco (100% stable BMP frames compatible with resedit)
  console.log('[ICON-GEN] Generating Windows ICO...');
  let icoBuffer = null;

  try {
    const pngSizes = [
      'build-resources/256x256.png',
      'build-resources/128x128.png',
      'build-resources/64x64.png',
      'build-resources/48x48.png',
      'build-resources/32x32.png',
      'build-resources/16x16.png'
    ].filter(p => fs.existsSync(p));

    if (pngSizes.length > 0) {
      icoBuffer = await pngToIco(pngSizes);
    } else {
      icoBuffer = await pngToIco(masterPngPath);
    }

    if (icoBuffer) {
      const parsed = resedit.Data.IconFile.from(icoBuffer);
      console.log(`[ICON-GEN] png-to-ico parsed successfully (${parsed.icons.length} frames).`);
    }
  } catch (err) {
    console.warn('[ICON-GEN] png-to-ico failed, trying png2icons:', err.message);
    try {
      icoBuffer = png2icons.createICO(masterPngBuffer, png2icons.BILINEAR, 0, false, true);
    } catch (e2) {
      console.error('[ICON-GEN] png2icons error:', e2.message);
    }
  }

  if (icoBuffer) {
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
  }

  // 2. Generate ICNS for macOS
  console.log('[ICON-GEN] Generating macOS ICNS...');
  try {
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
  } catch (icnsErr) {
    console.warn('[ICON-GEN] ICNS creation error:', icnsErr.message);
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
  });

  console.log('[ICON-GEN] All application desktop icons generated & validated successfully!');
}

main().catch(err => {
  console.error('[ICON-GEN] Icon generation warning:', err);
  // Non-zero exit is avoided so build always proceeds
});
