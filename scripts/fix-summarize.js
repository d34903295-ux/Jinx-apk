const fs = require('fs');
const p = 'nodo/src/core/rag/summarize.ts';
let s = fs.readFileSync(p, 'utf8');
s = s.split('return llm.generate(prompt, () => {})').join('return gen(prompt)');
s = s.split('const partialSummary = await llm.generate(prompt, () => {})').join('const partialSummary = await gen(prompt)');
s = s.split('const finalSummary = await llm.generate(finalPrompt, () => {})').join('const finalSummary = await gen(finalPrompt)');
fs.writeFileSync(p, s);
console.log('ok');
