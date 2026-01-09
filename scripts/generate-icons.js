/**
 * Generate PWA icons from SVG
 * Run: node scripts/generate-icons.js
 * Requires: npm install sharp
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is installed
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('Installing sharp...');
  require('child_process').execSync('pnpm add -D sharp', { stdio: 'inherit' });
  sharp = require('sharp');
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const svgPath = path.join(__dirname, '../public/icons/icon.svg');
const outputDir = path.join(__dirname, '../public/icons');

async function generateIcons() {
  const svg = fs.readFileSync(svgPath);

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);

    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`✓ Generated ${size}x${size}`);
  }

  // Generate favicon
  await sharp(svg)
    .resize(32, 32)
    .png()
    .toFile(path.join(__dirname, '../public/favicon.png'));

  console.log('✓ Generated favicon.png');
  console.log('\nDone! Icons generated in public/icons/');
}

generateIcons().catch(console.error);
