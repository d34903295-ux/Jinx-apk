const d = require('../hf_gemma.json');
for (const s of d.siblings || []) {
  if (/Q4_K_M\.gguf$/.test(s.rfilename)) console.log(s.rfilename);
}
