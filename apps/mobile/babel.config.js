module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // zod 4.x emits `export * as ns from "./mod"` (ES2020 namespace re-export).
    // RN's preset includes the syntax parser but not the transform — add it
    // explicitly so Metro can compile zod's source for Hermes.
    '@babel/plugin-transform-export-namespace-from',
  ],
};
