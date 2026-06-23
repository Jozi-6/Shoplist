const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'dist', 'index.html');

// Read the index.html
let html = fs.readFileSync(indexPath, 'utf8');

// Replace asset paths to include /Shoplist/ prefix
html = html.replace(/href="\/manifest\.json"/g, 'href="/Shoplist/manifest.json"');
html = html.replace(/href="\/favicon\.ico"/g, 'href="/Shoplist/favicon.ico"');
html = html.replace(/href="\/favicon\.png"/g, 'href="/Shoplist/favicon.png"');
html = html.replace(/src="\/_expo\/static\/js\/web\//g, 'src="/Shoplist/_expo/static/js/web/');
html = html.replace(/href="\/_expo\/static\/css\/web\//g, 'href="/Shoplist/_expo/static/css/web/');
html = html.replace(/src="\/_expo\/static\/js\/web\//g, 'src="/Shoplist/_expo/static/js/web/');

// Remove service worker reference if it exists (we removed it from the app)
html = html.replace(/<script[^>]*sw\.js[^>]*><\/script>/g, '');
html = html.replace(/href="\/sw\.js"/g, '');

// Write the modified index.html
fs.writeFileSync(indexPath, html);

console.log('✅ Fixed asset paths in index.html for GitHub Pages');
