const fs = require('fs'), path = 'nodo/src/ui/components/';
for (const f of fs.readdirSync(path)) {
  if (!f.endsWith('.tsx')) continue;
  const p = path + f;
  let s = fs.readFileSync(p, 'utf8');
  const orig = s;
  s = s.replace(/(<button[\s\S]*?)title=(\{[^}`]*\}|"[^"]*"|'[^']*')/g, (m, pre, val) =>
    pre.includes('aria-label') ? m : pre + 'aria-label=' + val + ' title=' + val);
  if (s !== orig) { fs.writeFileSync(p, s); console.log('patched', f); }
}
