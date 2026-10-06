const fs = require('fs');
const p = 'app/src/main/java/com/example/jinx/llama/ModelsActivity.kt';
const lines = fs.readFileSync(p, 'utf8').split('\n');
const need = [
  'import androidx.compose.animation.core.FastOutSlowInEasing',
  'import androidx.compose.animation.core.RepeatMode',
  'import androidx.compose.animation.core.animateFloat',
  'import androidx.compose.animation.core.infiniteRepeatable',
  'import androidx.compose.animation.core.rememberInfiniteTransition',
  'import androidx.compose.animation.core.tween',
  'import androidx.compose.foundation.layout.offset',
  'import androidx.compose.foundation.shape.CircleShape',
];
const have = new Set(lines.map((l) => l.trim()));
const missing = need.filter((n) => !have.has(n));
if (missing.length === 0) { console.log('nada'); process.exit(0); }
const idx = lines.findIndex((l) => l.startsWith('import androidx.compose.foundation.background'));
lines.splice(idx + 1, 0, ...missing);
fs.writeFileSync(p, lines.join('\n'));
console.log('añadidos:', missing.length);
