const fs = require('fs');
const files = [
  'app/src/main/java/com/example/jinx/llama/ModelsActivity.kt',
  'app/src/main/java/com/example/jinx/agent/AgentActivity.kt',
];
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  // 1. Offset: graphics -> geometry
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('import androidx.compose.ui.graphics.Offset')) {
      lines[i] = 'import androidx.compose.ui.geometry.Offset';
      console.log(f, 'offset fix línea', i + 1);
    }
  }
  fs.writeFileSync(f, lines.join('\n'));
}
// 2. Llave faltante en ModelsActivity: tras "            }\n        }\n    }" del setContent
{
  const f = files[0];
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  const idx = lines.findIndex((l, i) =>
    l === '                    )' &&
    lines[i + 1] === '                }' &&
    lines[i + 2] === '            }' &&
    lines[i + 3] === '        }' &&
    lines[i + 4] === '    }' &&
    lines[i + 5] === '' &&
    lines[i + 6].includes('Fondo Liquid'));
  if (idx < 0) { console.error('ancla llave no encontrada'); process.exit(1); }
  lines.splice(idx + 4, 0, '    }');
  fs.writeFileSync(f, lines.join('\n'));
  console.log('llave insertada');
}
