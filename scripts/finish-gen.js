const fs = require('fs');
const p = 'nodo/src/ui/components/ChatView.tsx';
let s = fs.readFileSync(p, 'utf8');
const NL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (arr) => arr.join(NL);
let n = 0;
const rep = (a, b) => {
  const sa = J(a), sb = J(b);
  const c = s.split(sa).length - 1;
  s = s.split(sa).join(sb);
  n += c;
};
rep(
  ['            if (isCurrent()) {', '              setStreamingContent(null)', '              setStreamingCitations([])', '              setGenerating(false)', '            }'],
  ['            if (isCurrent()) finishGeneration()'],
);
rep(
  ['            setMessages(finalMessages)', '            setStreamingContent(null)', '            setStreamingCitations([])', '            setGenerating(false)'],
  ['            setMessages(finalMessages)', '            finishGeneration()'],
);
rep(
  ['            setMessages(await getMessages(currentChatId))', '            setStreamingContent(null)', '            setStreamingCitations([])', '            setGenerating(false)'],
  ['            setMessages(await getMessages(currentChatId))', '            finishGeneration()'],
);
fs.writeFileSync(p, s);
console.log('reemplazos:', n);
