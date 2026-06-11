const fs = require('fs');
const s = fs.readFileSync('site_bundle.js', 'utf8');
// Find all URLs containing vercel
const regex = /https?:\/\/[^'"\s\\]+vercel[^'"\s\\]*/g;
const matches = s.match(regex);
if (matches) {
  console.log('Vercel URLs found in bundle:');
  matches.forEach(m => console.log('  ' + m));
} else {
  console.log('No vercel URLs found in bundle');
  // Also check for 'api' pattern
  const apiMatches = s.match(/API_BASE[^;]*/g);
  if (apiMatches) {
    console.log('API_BASE patterns:');
    apiMatches.forEach(m => console.log('  ' + m));
  }
}
