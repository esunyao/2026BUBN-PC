# Frontend collaboration

Read [the repository rules](../AGENTS.md) first. This file adds frontend constraints.

- Use Vue 3 Composition API, strict TypeScript, Vite and pnpm. Preserve the package name and existing unrelated edits.
- `src/app` assembles the application and owns the single trip state. `src/features` implements user capabilities. `src/navigation` owns movement. `src/shared` contains genuinely reused code and assets.
- Dependencies flow from app to features/navigation/shared. Shared code must not depend on app or features. Use typed props/events; do not create a second global trip state.
- Reuse components, composables and utility functions for actual duplication. Do not add Router, Pinia, a backend or speculative abstractions.
- Check scripts in package.json. The default Bash Node may be outdated: use the installed Windows Node 24+ for pnpm.
- [Application rules](src/app/AGENTS.md), [feature rules](src/features/AGENTS.md), [navigation rules](src/navigation/AGENTS.md), [shared rules](src/shared/AGENTS.md).
- Implementation overview: [doc/README.md](doc/README.md). Update documentation to match verified behavior.
