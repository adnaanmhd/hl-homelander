const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const projectRoot = __dirname;
const sharedTypesRoot = path.resolve(projectRoot, '..', '..', 'shared', 'types');

const defaultConfig = getDefaultConfig(projectRoot);

const config = {
  // shared/types is linked via `file:../../shared/types` (npm). Metro must watch
  // it so live edits trigger reloads; everything else resolves through the
  // default apps/mobile/node_modules tree (hierarchical lookup re-enabled —
  // npm nests transitive deps under their parent and the default Metro
  // resolver walks them correctly, unlike the prior pnpm-workspace setup).
  watchFolders: [sharedTypesRoot],
};

module.exports = mergeConfig(defaultConfig, config);
