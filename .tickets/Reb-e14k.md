---
id: Reb-e14k
status: open
deps: []
links: []
created: 2026-03-13T07:50:20Z
type: task
priority: 2
assignee: Martin Bernstorff
---
# Refactor hotkey registration to iterate over a single registry

Currently Board.tsx has ~15 individual useHotkey() calls, one per key binding. The HOTKEYS registry in hotkeys.ts only stores keys and labels, not handlers, so there's no way to loop over it.

Refactor so that each hotkey entry also maps to its handler, then register all hotkeys in a single loop. This reduces boilerplate and makes it straightforward to support customisable hotkeys later.

