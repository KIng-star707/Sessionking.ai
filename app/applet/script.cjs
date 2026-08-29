const fs = require('fs');
['src/services/geminiClient.ts', 'src/services/geminiService.ts'].forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    const rx = /const data\s*=\s*await\s*res\.json\(\);\s*if\s*\(!res\.ok\)\s*\{\s*throw\s*new\s*Error\(data\.error\s*\|\|\s*"Failed AI proxy request"\);\s*\}/g;
    const replacement = `if (!res.ok) {
    const text = await res.text();
    let errData;
    try { errData = JSON.parse(text); } catch(e) {}
    throw new Error(errData?.error || \`Failed AI proxy request: \${res.status} \${text}\`);
  }
  const data = await res.json();`;
    content = content.replace(rx, replacement);
    fs.writeFileSync(file, content);
  }
});
