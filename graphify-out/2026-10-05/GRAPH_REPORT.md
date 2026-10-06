# Graph Report - Jinx  (2026-10-05)

## Corpus Check
- 49 files · ~43,446 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: .xml 10, (none) 3, .css 3)

## Summary
- 1513 nodes · 4894 edges · 73 communities (57 shown, 16 thin omitted)
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 739 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Theme.kt
- package.json
- ExampleInstrumentedTest.kt
- Type.kt
- t
- ExampleUnitTest.kt
- gradlew
- MainActivity.kt
- nodo_src_assets_hero
- repo.ts
- compilerOptions
- llmClient.ts
- compilerOptions
- devDependencies
- SetupWizard.tsx
- CRITICAL: Mandatory Token Conservation Policy (Graphify)
- nodo_src_assets_react
- .oxlintrc.json
- React + TypeScript + Vite
- STRICT TOKEN OPTIMIZATION POLICY (GRAPHIFY)
- GEMINI.md
- nodo_src_assets_vite
- tsconfig.json
- workflows/graphify.md
- global.d.ts
- lib-FbOxj-PF.js
- llm.worker-BrQfiY_G.js
- fl
- i
- sw.js
- t
- qe
- t
- me
- l
- n
- tt
- it
- vl
- me
- i
- index-DDTqaQD6.js
- Nt
- d
- t
- e
- ut
- yn
- ql
- ke
- ChatView.tsx
- f
- os
- jd
- Cu
- App.tsx
- kf
- ec
- pu
- onmessage
- Fr
- getImageEmbeddings
- dependencies
- scripts
- vite.config.ts
- sw.ts
- padding
- scaffold
- text

## God Nodes (most connected - your core abstractions)
1. `Nt()` - 110 edges
2. `qe()` - 103 edges
3. `tt()` - 100 edges
4. `i()` - 99 edges
5. `it()` - 94 edges
6. `t()` - 88 edges
7. `n()` - 80 edges
8. `me()` - 64 edges
9. `me()` - 63 edges
10. `a()` - 60 edges

## Surprising Connections (you probably didn't know these)
- `n()` --indirect_call--> `Le()`  [INFERRED]
  app/src/main/assets/www/assets/index-DDTqaQD6.js → app/src/main/assets/www/assets/llm.worker-BrQfiY_G.js
- `it()` --indirect_call--> `y()`  [INFERRED]
  app/src/main/assets/www/assets/lib-FbOxj-PF.js → app/src/main/assets/www/assets/index-DDTqaQD6.js
- `qe()` --indirect_call--> `y()`  [INFERRED]
  app/src/main/assets/www/assets/llm.worker-BrQfiY_G.js → app/src/main/assets/www/assets/index-DDTqaQD6.js
- `b()` --indirect_call--> `y()`  [INFERRED]
  app/src/main/assets/www/sw.js → app/src/main/assets/www/assets/index-DDTqaQD6.js
- `it()` --indirect_call--> `b()`  [INFERRED]
  app/src/main/assets/www/assets/lib-FbOxj-PF.js → app/src/main/assets/www/assets/index-DDTqaQD6.js

## Import Cycles
- None detected.

## Communities (73 total, 16 thin omitted)

### Community 0 - "Theme.kt"
Cohesion: 0.18
Nodes (11): activity, JinxTheme(), Composable, build, darkcolorscheme, dynamicdarkcolorscheme, dynamiclightcolorscheme, issystemindarktheme (+3 more)

### Community 1 - "package.json"
Cohesion: 0.12
Nodes (15): name, private, type, version, dexie, dexie-react-hooks, @fontsource-variable/inter, oxlint (+7 more)

### Community 2 - "ExampleInstrumentedTest.kt"
Cohesion: 0.38
Nodes (5): androidjunit4, ExampleInstrumentedTest, Test, instrumentationregistry, RunWith

### Community 3 - "Type.kt"
Cohesion: 0.33
Nodes (5): fontfamily, fontweight, sp, textstyle, typography

### Community 4 - "t"
Cohesion: 0.20
Nodes (13): LLMState, OfflineStatus, es, I18nKey, t(), Icon(), IconName, IconProps (+5 more)

### Community 6 - "gradlew"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

### Community 8 - "MainActivity.kt"
Cohesion: 0.10
Nodes (23): androidview, Composable, MainActivity, OnBackPressedCallback, NodoWebViewScreen(), WebChromeClient, WebViewClient, Bundle (+15 more)

### Community 12 - "repo.ts"
Cohesion: 0.17
Nodes (16): createChat(), deleteChat(), getSetting(), SettingKey, titleFrom(), db, ChatRecord, ChunkRecord (+8 more)

### Community 13 - "compilerOptions"
Cohesion: 0.09
Nodes (21): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+13 more)

### Community 14 - "llmClient.ts"
Cohesion: 0.13
Nodes (8): handler, Listener, LLMClient, LLMStatus, LoadProgress, loadWebLLM(), toMessage(), @mlc-ai/web-llm

### Community 15 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 16 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, oxlint, tailwindcss, @tailwindcss/vite, @types/node, @types/react, @types/react-dom, typescript (+8 more)

### Community 17 - "SetupWizard.tsx"
Cohesion: 0.22
Nodes (16): detectHardware(), HardwareInfo, modelIdFor(), ModelOption, MODELS, ModelTier, recommendModel(), vramFor() (+8 more)

### Community 18 - "CRITICAL: Mandatory Token Conservation Policy (Graphify)"
Cohesion: 0.29
Nodes (6): 1. Zero-Exploration Policy (DO NOT read bulk files), 2. Mandatory Graph Traversal (Query First), 3. Surgical Code Reading, 4. Graph Synchronization, AGENTS.md - Repository Guidelines for AI Agents, CRITICAL: Mandatory Token Conservation Policy (Graphify)

### Community 20 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 21 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 28 - "lib-FbOxj-PF.js"
Cohesion: 0.05
Nodes (95): acquire(), appendReplyHeader(), asyncGenerate(), g(), ne(), calculateCropShape(), calculateResizeShape(), chatCompletion() (+87 more)

### Community 29 - "llm.worker-BrQfiY_G.js"
Cohesion: 0.06
Nodes (79): acquire(), appendEmptyThinkingReplyHeader(), appendMessage(), appendReplyHeader(), asyncGenerate(), asyncLoadWebGPUPipelines(), At(), chatCompletion() (+71 more)

### Community 30 - "fl"
Cohesion: 0.06
Nodes (75): as(), ba(), bc(), bh(), Bo(), bt(), Di(), dl() (+67 more)

### Community 31 - "i"
Cohesion: 0.11
Nodes (61): a(), al(), at(), Au(), c(), cs(), dc(), el() (+53 more)

### Community 32 - "sw.js"
Cohesion: 0.07
Nodes (50): n(), T(), activate(), addCacheListener(), addFetchListener(), addToCacheList(), _awaitComplete(), b() (+42 more)

### Community 33 - "t"
Cohesion: 0.08
Nodes (44): b(), Be(), Bp(), ce(), cm(), de(), dp(), em() (+36 more)

### Community 34 - "qe"
Cohesion: 0.06
Nodes (41): embedStep(), Ft(), ht(), I(), It, mt, P, qe() (+33 more)

### Community 35 - "t"
Cohesion: 0.10
Nodes (51): Be(), d(), f(), s(), u(), c(), i(), o() (+43 more)

### Community 36 - "me"
Cohesion: 0.06
Nodes (42): bt, constructor(), ct(), getEmbeddingStates(), getModelStates(), getRequiredVMFunctionByName(), getVMFunctionAvailability(), He() (+34 more)

### Community 37 - "l"
Cohesion: 0.12
Nodes (43): am(), Bi(), bm(), cn(), co(), E(), eo(), hn() (+35 more)

### Community 38 - "n"
Cohesion: 0.07
Nodes (33): asyncLoadWebGPUPipelines(), B(), de(), fe(), ce(), de(), Ee(), r() (+25 more)

### Community 39 - "tt"
Cohesion: 0.06
Nodes (23): getInputData(), t(), at(), Se(), ot(), i(), pt(), h() (+15 more)

### Community 40 - "it"
Cohesion: 0.06
Nodes (32): ee(), k(), Se(), Bt(), Ft(), H(), ht(), it() (+24 more)

### Community 41 - "vl"
Cohesion: 0.11
Nodes (34): Bd(), bl(), ca(), d(), da(), ef(), ep(), fa() (+26 more)

### Community 42 - "me"
Cohesion: 0.09
Nodes (24): me(), a(), d(), d(), _e(), ke(), L(), Te() (+16 more)

### Community 43 - "i"
Cohesion: 0.13
Nodes (33): n(), c(), i(), o(), s(), G(), Ge(), d() (+25 more)

### Community 44 - "index-DDTqaQD6.js"
Cohesion: 0.09
Nodes (24): ah(), ap(), deleteModel(), Du(), eh(), hl(), Id(), isCached() (+16 more)

### Community 45 - "Nt"
Cohesion: 0.10
Nodes (23): K(), Nt(), ai(), bi(), ci(), fi(), gi(), hi() (+15 more)

### Community 46 - "d"
Cohesion: 0.10
Nodes (25): a(), c(), d(), f(), h(), m(), p(), f() (+17 more)

### Community 47 - "t"
Cohesion: 0.15
Nodes (25): p(), _e(), i(), l(), o(), be(), c(), D() (+17 more)

### Community 48 - "e"
Cohesion: 0.13
Nodes (25): ae(), er(), Et(), _f(), gf(), gl(), Je(), k() (+17 more)

### Community 49 - "ut"
Cohesion: 0.17
Nodes (21): af(), cf(), df(), dt(), Fd(), ff(), fm(), It() (+13 more)

### Community 50 - "yn"
Cohesion: 0.17
Nodes (17): an(), bn(), ch(), Ct(), Dn(), Gh(), gt(), ht() (+9 more)

### Community 51 - "ql"
Cohesion: 0.17
Nodes (18): Bu(), cl(), eu(), Fu(), hu(), Lu(), Ma(), ql() (+10 more)

### Community 52 - "ke"
Cohesion: 0.12
Nodes (18): appendEmptyThinkingReplyHeader(), appendMessage(), bt(), st(), finishReply(), getPromptArray(), getPromptArrayInternal(), getPromptArrayLastRound() (+10 more)

### Community 53 - "ChatView.tsx"
Cohesion: 0.23
Nodes (14): buildChatMessages(), CHAT_SYSTEM_PROMPT, HistoryMessage, addMessage(), getMessages(), listChats(), llm, labelForModelId() (+6 more)

### Community 54 - "f"
Cohesion: 0.16
Nodes (10): a(), c(), d(), f(), h(), m(), p(), f() (+2 more)

### Community 55 - "os"
Cohesion: 0.24
Nodes (13): ac(), bs(), fs(), gs(), hs(), ms(), os(), ps() (+5 more)

### Community 56 - "jd"
Cohesion: 0.20
Nodes (12): cc(), dh(), go(), Ha(), ja(), jd(), oc(), pc() (+4 more)

### Community 57 - "Cu"
Cohesion: 0.20
Nodes (11): Cp(), Cu(), gm(), Iu(), jl(), kl(), nm(), Nt() (+3 more)

### Community 58 - "App.tsx"
Cohesion: 0.30
Nodes (9): App(), boot(), setSetting(), getOfflineStatus(), installModel(), requestPersistence(), nodo_src_index, Logo() (+1 more)

### Community 59 - "kf"
Cohesion: 0.24
Nodes (10): br(), Cr(), hp(), If(), kf(), qf(), vr(), wr() (+2 more)

### Community 60 - "ec"
Cohesion: 0.24
Nodes (10): ds(), ec(), Md(), nc(), tc(), tt(), vh(), we() (+2 more)

### Community 61 - "pu"
Cohesion: 0.27
Nodes (10): ei(), Gr(), Jr(), Nd(), pu(), qr(), sf(), vi() (+2 more)

### Community 62 - "onmessage"
Cohesion: 0.27
Nodes (10): Ne(), handleTask(), fe(), pe(), Ae(), ge(), onmessage(), postMessage() (+2 more)

### Community 63 - "Fr"
Cohesion: 0.25
Nodes (9): Dr(), en(), Fr(), Ir(), Lr(), Or(), Pr(), Rr() (+1 more)

### Community 64 - "getImageEmbeddings"
Cohesion: 0.28
Nodes (9): calculateCropShape(), calculateResizeShape(), computeImageEmbedSize(), dt(), G(), getImageEmbeddings(), n(), T() (+1 more)

### Community 65 - "dependencies"
Cohesion: 0.29
Nodes (7): dependencies, dexie, dexie-react-hooks, @fontsource-variable/inter, @mlc-ai/web-llm, react, react-dom

### Community 66 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, build:android, dev, lint, preview

### Community 67 - "vite.config.ts"
Cohesion: 0.40
Nodes (4): @tailwindcss/vite, vite, vite-plugin-pwa, @vitejs/plugin-react

### Community 68 - "sw.ts"
Cohesion: 0.50
Nodes (3): workbox-core, workbox-precaching, workbox-routing

## Knowledge Gaps
- **107 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `name` (+102 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 294 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Nt()` connect `Nt` to `n`, `it`, `vl`, `me`, `i`, `t`, `ke`, `f`, `onmessage`, `lib-FbOxj-PF.js`, `llm.worker-BrQfiY_G.js`, `fl`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Why does `qe()` connect `qe` to `getImageEmbeddings`, `t`, `t`, `me`, `n`, `tt`, `i`, `d`, `ut`, `yn`, `llm.worker-BrQfiY_G.js`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `y()` connect `t` to `sw.js`, `qe`, `it`, `index-DDTqaQD6.js`, `i`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Are the 37 inferred relationships involving `Nt()` (e.g. with `Di()` and `Oi()`) actually correct?**
  _`Nt()` has 37 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `qe()` (e.g. with `b()` and `v()`) actually correct?**
  _`qe()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 36 inferred relationships involving `tt()` (e.g. with `Ct()` and `Di()`) actually correct?**
  _`tt()` has 36 INFERRED edges - model-reasoned connections that need verification._
- **Are the 18 inferred relationships involving `i()` (e.g. with `al()` and `at()`) actually correct?**
  _`i()` has 18 INFERRED edges - model-reasoned connections that need verification._