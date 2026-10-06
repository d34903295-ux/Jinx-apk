---
trigger: always_on
description: STRICT TOKEN CONSERVATION POLICY - Mandates using graphify knowledge graph before reading codebase files.
---

# STRICT TOKEN OPTIMIZATION POLICY (GRAPHIFY)

This repository contains a pre-computed knowledge graph located in `graphify-out/`.
All AI agents MUST adhere to this protocol to minimize token consumption and avoid context window pollution.

## MANDATORY RULES

1. **PROHIBITED ACTIONS (DO NOT DO)**:
   - **DO NOT** perform broad `grep_search`, `list_dir`, or read entire source files to understand architecture, locate functions, trace imports, or find dependencies.
   - **DO NOT** view whole files with `view_file` when only a specific class or function is needed.

2. **MANDATORY GRAPH NAVIGATION (DO THIS FIRST)**:
   - To find where a class, method, or concept is defined and what it connects to:
     `graphify explain "<Concept>"`
   - To trace relationships or data flow between two components:
     `graphify path "<ComponentA>" "<ComponentB>"`
   - For general architectural questions or feature tracing:
     `graphify query "<question>"` (or MCP tool `query_graph`)
   - To inspect high-level project structure without reading files:
     Read `graphify-out/GRAPH_REPORT.md` (pre-computed summary) or open `graphify-out/graph.html`.

3. **SURGICAL FILE READING**:
   - The graph output provides exact file paths and line numbers (e.g., `src=app/... loc=L16`).
   - Use `view_file` ONLY with precise `StartLine` and `EndLine` targeting the exact lines needed, saving thousands of tokens.

4. **MAINTENANCE**:
   - After modifying or creating any code files, run `graphify update .` to update the graph via local AST (deterministic, 0 LLM cost).

