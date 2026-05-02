// Icon generator script for PWA
// This script generates PWA icons in various sizes from the school logo

const fs = require('fs');
const path = require('path');

// Icon sizes needed for PWA
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

console.log('=============================================');
console.log('PWA Icon Generator Instructions');
console.log('=============================================\n');

console.log('To generate PWA icons, you have two options:\n');

console.log('Option 1: Use an online tool (Easiest)');
console.log('  1. Visit: https://realfavicongenerator.net/');
console.log('  2. Upload your public/logo.png file');
console.log('  3. Download the generated icons');
console.log('  4. Extract and copy icon-*.png files to public/ folder\n');

console.log('Option 2: Use sharp library (Automated)');
console.log('  1. Install sharp: npm install -D sharp');
console.log('  2. Run this script with sharp enabled\n');

console.log('Option 3: Manual (Using image editor)');
console.log('  Create PNG files with these sizes:');
iconSizes.forEach(size => {
  console.log(`  - icon-${size}x${size}.png (${size}x${size} pixels)`);
});
console.log('  Save them in the public/ folder\n');

const MASKABLE_SIZES = [192, 512];

function pickLogoSource() {
  const candidates = [
    path.join(__dirname, 'public', 'school-logo.png'),
    path.join(__dirname, 'public', 'logo.png')
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function renderIcon(sharp, logoPath, size, scale) {
  const innerSize = Math.max(1, Math.floor(size * scale));
  const iconBuffer = await sharp(logoPath)
    .trim()
    .resize(innerSize, innerSize, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .ensureAlpha()
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    }
  })
    .composite([{ input: iconBuffer, gravity: 'center' }])
    .png()
    .toBuffer();
}

// Check if sharp is available
try {
  const sharp = require('sharp');
  
  console.log('✓ Sharp library detected! Generating icons...\n');
  
  const logoPath = pickLogoSource();
  
  if (!logoPath) {
    console.error('❌ Error: no logo source found (expected public/school-logo.png or public/logo.png)');
    process.exit(1);
  }

  console.log(`Using logo source: ${path.basename(logoPath)}`);
  
  // Generate icons
  const promises = iconSizes.map(size => {
    const outputPath = path.join(__dirname, 'public', `icon-${size}x${size}.png`);

    return renderIcon(sharp, logoPath, size, 0.94)
      .then((iconBuffer) => sharp(iconBuffer).toFile(outputPath))
      .then(() => {
        console.log(`✓ Generated: icon-${size}x${size}.png`);
      })
      .catch(err => {
        console.error(`❌ Failed to generate icon-${size}x${size}.png:`, err.message);
      });
  });
  
  const maskablePromises = MASKABLE_SIZES.map((size) => {
    const outputPath = path.join(__dirname, 'public', `icon-maskable-${size}x${size}.png`);
    // Keep a larger safe-zone so launcher masks do not crop the school logo.
    return renderIcon(sharp, logoPath, size, 0.8)
      .then((iconBuffer) => sharp(iconBuffer).toFile(outputPath))
      .then(() => {
        console.log(`✓ Generated: icon-maskable-${size}x${size}.png`);
      })
      .catch((err) => {
        console.error(`❌ Failed to generate icon-maskable-${size}x${size}.png:`, err.message);
      });
  });

  Promise.all([...promises, ...maskablePromises]).then(() => {
    console.log('\n✓ All icons generated successfully!');
    console.log('\nYour PWA is now ready! Build and test the app.');
  }).catch(err => {
    console.error('\n❌ Some icons failed to generate:', err);
  });
  
} catch (err) {
  console.log('ℹ  Sharp library not installed.');
  console.log('   Run: npm install -D sharp');
  console.log('   Then run this script again to auto-generate icons.\n');
  console.log('Or use one of the manual options above.\n');
}
