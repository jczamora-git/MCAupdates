const fs = require('fs');
const path = require('path');

function pickLogoSource() {
  const candidates = [
    path.join(__dirname, 'public', 'school-logo.png'),
    path.join(__dirname, 'public', 'logo.png')
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

try {
  const sharp = require('sharp');
  (async () => {
    console.log('Generating splash screens...\n');

    const logoPath = pickLogoSource();
    const outputDir = path.join(__dirname, 'public');

    if (!logoPath) {
      console.error('❌ Error: no logo source found (expected public/school-logo.png or public/logo.png)');
      process.exit(1);
    }

    console.log(`Using logo source: ${path.basename(logoPath)}`);

    // iOS splash screen sizes (used by apple-touch-startup-image)
    const iosSplashSizes = [
    { width: 640, height: 1136, name: 'apple-splash-640-1136' },      // iPhone 5/SE
    { width: 750, height: 1334, name: 'apple-splash-750-1334' },      // iPhone 6/7/8
    { width: 1125, height: 2436, name: 'apple-splash-1125-2436' },    // iPhone X/XS/11 Pro
    { width: 1242, height: 2208, name: 'apple-splash-1242-2208' },    // iPhone 6+/7+/8+
    { width: 1242, height: 2688, name: 'apple-splash-1242-2688' },    // iPhone XS Max/11 Pro Max
    { width: 828, height: 1792, name: 'apple-splash-828-1792' },      // iPhone XR/11
    { width: 1170, height: 2532, name: 'apple-splash-1170-2532' },    // iPhone 12/13 Pro
    { width: 1284, height: 2778, name: 'apple-splash-1284-2778' },    // iPhone 12/13 Pro Max
    { width: 1536, height: 2048, name: 'apple-splash-1536-2048' },    // iPad Mini/Air
    { width: 2048, height: 2732, name: 'apple-splash-2048-2732' },    // iPad Pro 12.9"
    ];

    // Optional Android splash assets (not directly referenced by PWA spec,
    // but useful for wrappers/native packaging and design QA).
    const androidSplashSizes = [
    { width: 720, height: 1280, name: 'android-splash-720-1280' },
    { width: 1080, height: 1920, name: 'android-splash-1080-1920' },
    { width: 1440, height: 2560, name: 'android-splash-1440-2560' },
    { width: 1080, height: 2400, name: 'android-splash-1080-2400' },
    { width: 1440, height: 3120, name: 'android-splash-1440-3120' }
    ];

    const splashSizes = [...iosSplashSizes, ...androidSplashSizes];

    const baseLogo = await sharp(logoPath)
      .trim()
      .ensureAlpha()
      .toBuffer();
  
    // Create white background splash screens with centered logo
    const promises = splashSizes.map(({ width, height, name }) => {
    const outputPath = path.join(outputDir, `${name}.png`);
    
    const logoSize = Math.floor(Math.min(width, height) * 0.24);
    
      return sharp(baseLogo)
        .resize(logoSize, logoSize, {
          fit: 'contain',
          kernel: sharp.kernel.lanczos3,
          withoutEnlargement: true,
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .sharpen(1.15)
        .ensureAlpha()
        .toBuffer()
        .then(logoBuffer => {
          return sharp({
            create: {
              width: width,
              height: height,
              channels: 3,
              background: { r: 255, g: 255, b: 255 }
            }
          })
          .composite([{
            input: logoBuffer,
            gravity: 'center'
          }])
          .png({ compressionLevel: 9, adaptiveFiltering: true })
          .toFile(outputPath);
        })
        .then(() => {
          console.log(`✓ Generated: ${name}.png (${width}x${height})`);
        })
        .catch(err => {
          console.error(`❌ Failed to generate ${name}.png:`, err.message);
        });
    });
  
    Promise.all(promises).then(() => {
      console.log('\n✓ All splash screens generated successfully!');
    }).catch(err => {
      console.error('\n❌ Some splash screens failed to generate:', err);
    });
  })();
  
} catch (err) {
  console.error('❌ Error: Sharp library not installed');
  console.error('Run: npm install -D sharp --legacy-peer-deps');
  process.exit(1);
}
