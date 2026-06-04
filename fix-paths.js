const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'dist', 'index.html');

// Read the index.html
let html = fs.readFileSync(indexPath, 'utf8');

// Replace asset paths to include /Shoplist/ prefix
html = html.replace(/href="\/manifest\.json"/g, 'href="/Shoplist/manifest.json"');
html = html.replace(/href="\/favicon\.ico"/g, 'href="/Shoplist/favicon.ico"');
html = html.replace(/src="\/_expo\/static\/js\/web\//g, 'src="/Shoplist/_expo/static/js/web/');
html = html.replace(/href="\/sw\.js"/g, 'href="/Shoplist/sw.js"');

// Write the modified index.html
fs.writeFileSync(indexPath, html);

console.log('✅ Fixed asset paths in index.html for GitHub Pages');
