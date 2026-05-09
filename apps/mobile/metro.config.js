const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..', '..');
const sharedTypesRoot = path.resolve(repoRoot, 'shared', 'types');

const defaultConfig = getDefaultConfig(projectRoot);

const config = {
  // shared/types is linked via `file:../../shared/types` (npm). Metro must watch
  // it so live edits trigger reloads; everything else resolves through the
  // default apps/mobile/node_modules tree (hierarchical lookup re-enabled —
  // npm nests transitive deps under their parent and the default Metro
  // resolver walks them correctly, unlike the prior pnpm-workspace setup).
  watchFolders: [sharedTypesRoot],
  resolver: {
    // shared/types is `file:` linked and has no own node_modules tree, and
    // shared/types/src is outside projectRoot, so Metro's default walk-up
    // from shared/types stops at the watch-folder root and never reaches
    // apps/mobile/node_modules or the repo-root hoisted tree. Add both as
    // explicit search roots so bare imports (currently `zod`, possibly more
    // as shared/types grows) resolve regardless of import origin.
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(repoRoot, 'node_modules'),
    ],
    // shared/types is authored with NodeNext-style `./foo.js` import specifiers
    // (TypeScript requires `.js` even when source is `.ts` under NodeNext).
    // tsc + vitest map `.js` → `.ts` transparently, but Metro's default resolver
    // does not. Strip the `.js` suffix on relative specifiers originating inside
    // shared/types so Metro finds the .ts source.
    resolveRequest: (context, moduleName, platform) => {
      if (
        moduleName.endsWith('.js') &&
        moduleName.startsWith('.') &&
        context.originModulePath.startsWith(sharedTypesRoot)
      ) {
        const stripped = moduleName.slice(0, -3);
        return context.resolveRequest(context, stripped, platform);
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
