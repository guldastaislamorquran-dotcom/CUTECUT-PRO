const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const p2iModule = require('png-to-ico');
const pngToIco = typeof p2iModule === 'function' ? p2iModule : (p2iModule.default || p2iModule);
const png2icons = require('png2icons');

// Vector SVG for CUTECUT PRO Video Editor
const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="50%" stop-color="#1e1b4b" />
      <stop offset="100%" stop-color="#311042" />
    </linearGradient>
    <linearGradient id="primaryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ec4899" />
      <stop offset="50%" stop-color="#8b5cf6" />
      <stop offset="100%" stop-color="#3b82f6" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f43f5e" />
      <stop offset="100%" stop-color="#fb923c" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- Background Card -->
  <rect x="32" y="32" width="960" height="960" rx="220" fill="url(#bgGrad)" stroke="#38bdf8" stroke-opacity="0.3" stroke-width="8" filter="url(#shadow)" />

  <!-- Inner Ambient Glow -->
  <circle cx="512" cy="512" r="340" fill="url(#primaryGrad)" opacity="0.15" />

  <!-- Film Clapperboard / Video Frame Base -->
  <rect x="180" y="240" width="664" height="544" rx="48" fill="#1e293b" stroke="url(#primaryGrad)" stroke-width="12" />

  <!-- Top Clapper Slats -->
  <rect x="180" y="240" width="664" height="130" rx="48" fill="#0f172a" />
  <clipPath id="slatClip">
    <rect x="180" y="240" width="664" height="130" rx="48" />
  </clipPath>
  <g clip-path="url(#slatClip)">
    <polygon points="240,230 310,230 250,380 180,380" fill="#ec4899" opacity="0.9"/>
    <polygon points="380,230 450,230 390,380 320,380" fill="#a855f7" opacity="0.9"/>
    <polygon points="520,230 590,230 530,380 460,380" fill="#3b82f6" opacity="0.9"/>
    <polygon points="660,230 730,230 670,380 600,380" fill="#06b6d4" opacity="0.9"/>
    <polygon points="800,230 870,230 810,380 740,380" fill="#ec4899" opacity="0.9"/>
  </g>

  <!-- Play / Scissors Cut Symbol in Center -->
  <polygon points="420,440 680,580 420,720" fill="url(#primaryGrad)" filter="url(#shadow)" />
  <polygon points="436,464 656,580 436,696" fill="#ffffff" opacity="0.9" />

  <!-- Timeline Track Dots -->
  <circle cx="270" cy="710" r="14" fill="#38bdf8" />
  <circle cx="320" cy="710" r="14" fill="#818cf8" />
  <rect x="360" y="702" width="410" height="16" rx="8" fill="#334155" />
  <rect x="360" y="702" width="240" height="16" rx="8" fill="url(#accentGrad)" />
</svg>
`;

async function generateAllAssets() {
  console.log('[ICON-GEN] Starting fresh binary asset generation...');
  const svgBuffer = Buffer.from(svgIcon);

  // Target directories
  const dirs = [
    'build-resources',
    'build',
    'build/icons',
    'public'
  ];
  dirs.forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  const sizes = [1024, 512, 256, 128, 96, 72, 64, 48, 32, 24, 16];
  const pngBuffers = {};

  for (const s of sizes) {
    const pngBuf = await sharp(svgBuffer)
      .resize(s, s)
      .png({ compressionLevel: 9 })
      .toBuffer();

    pngBuffers[s] = pngBuf;
    fs.writeFileSync(`build-resources/${s}x${s}.png`, pngBuf);
  }

  // 128x128@2x (256x256)
  fs.writeFileSync('build-resources/128x128@2x.png', pngBuffers[256]);

  // Master PNGs
  const master512 = pngBuffers[512];
  const master1024 = pngBuffers[1024];

  [
    'build-resources/icon.png',
    'build/icon.png',
    'build/icons/icon.png',
    'public/icon.png',
    'icon.png'
  ].forEach(p => fs.writeFileSync(p, master512));

  // Generate genuine Windows ICO using png-to-ico (16, 24, 32, 48, 64, 128, 256)
  console.log('[ICON-GEN] Generating clean Windows ICO...');
  const icoSizes = [
    'build-resources/256x256.png',
    'build-resources/128x128.png',
    'build-resources/64x64.png',
    'build-resources/48x48.png',
    'build-resources/32x32.png',
    'build-resources/16x16.png'
  ];

  const icoBuf = await pngToIco(icoSizes);

  // Clean and remove any broken installerIcon.ico / uninstallerIcon.ico files
  const filesToDelete = [
    'build-resources/installerIcon.ico',
    'build-resources/uninstallerIcon.ico',
    'build/installerIcon.ico',
    'build/uninstallerIcon.ico'
  ];
  filesToDelete.forEach(f => {
    if (fs.existsSync(f)) {
      try { fs.unlinkSync(f); } catch (e) {}
    }
  });

  [
    'build-resources/icon.ico',
    'build/icon.ico',
    'build/icons/icon.ico',
    'public/icon.ico',
    'icon.ico'
  ].forEach(p => fs.writeFileSync(p, icoBuf));

  // Generate macOS ICNS
  console.log('[ICON-GEN] Generating macOS ICNS...');
  try {
    const icnsBuf = png2icons.createICNS(master1024, png2icons.BILINEAR, 0);
    if (icnsBuf) {
      [
        'build-resources/icon.icns',
        'build/icon.icns',
        'build/icons/icon.icns',
        'public/icon.icns',
        'icon.icns'
      ].forEach(p => fs.writeFileSync(p, icnsBuf));
    }
  } catch (e) {
    console.warn('[ICON-GEN] ICNS creation error:', e.message);
  }

  console.log('[ICON-GEN] All binary assets generated successfully with pristine PNG & ICO signatures!');
}

generateAllAssets().catch(err => {
  console.error('[ICON-GEN] Critical error:', err);
  process.exit(1);
});
