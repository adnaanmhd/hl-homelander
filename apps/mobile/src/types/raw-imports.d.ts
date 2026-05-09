// Ambient declaration for Vite/Vitest `?raw` imports. Lets vitest tests
// inline a source file's contents as a string at compile time, which
// powers the structural source-grep gates (e.g., the HOME-07 invariant
// in __tests__/navigation/MainTabs.test.tsx).
//
// We only need a `?raw` declaration here; if other Vite-specific suffixes
// (`?url`, `?inline`, `?worker`) are needed in the future, extend below.

declare module '*?raw' {
  const content: string;
  export default content;
}
