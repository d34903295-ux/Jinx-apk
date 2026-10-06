# AGENTS.md - Repository Guidelines for AI Agents

## CRITICAL: Mandatory Token Conservation Policy (Graphify)

This repository has an active **knowledge graph** generated in `graphify-out/`.
To prevent consuming massive context tokens and blowing token budgets, **ALL AGENTS MUST** follow these directives:

### 1. Zero-Exploration Policy (DO NOT read bulk files)
- **NEVER** scan directories or read multiple full `.kt`, `.kts`, or `.java` files to understand what the project does or where a function/class is located.
- **NEVER** run broad grep/regex searches across the whole workspace when trying to understand symbols or relationships.

### 2. Mandatory Graph Traversal (Query First)
Always execute `graphify` commands via terminal before touching any source files:
- **Locate and understand any symbol/class/function:**
  ```bash
  graphify explain "<SymbolOrClassName>"
  ```
- **Trace connections or data flow between two components:**
  ```bash
  graphify path "<SourceComponent>" "<TargetComponent>"
  ```
- **Answer architecture or feature questions:**
  ```bash
  graphify query "<natural language question>"
  ```
- **High-level understanding:**
  Check `graphify-out/GRAPH_REPORT.md` (pre-computed summary) rather than reading code.

### 3. Surgical Code Reading
The graph outputs pinpoint exact lines (e.g. `src=app/... loc=L16`).
When editing or inspecting code, **ONLY** read the specific line range needed (using line slice notation). Never read whole files unnecessarily.

### 4. Graph Synchronization
After making code changes, run:
```bash
graphify update .
```
This updates the knowledge graph using local AST parsers with **0 LLM token cost**, ensuring subsequent queries remain 100% accurate.
