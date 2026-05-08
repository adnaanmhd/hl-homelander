const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

const defaultConfig = getDefaultConfig(projectRoot);

const config = {
  // pnpm workspace: Metro must watch the entire monorepo so symlinked packages are reachable.
  watchFolders: [workspaceRoot],
  resolver: {
    // pnpm flat node_modules don't work for Metro by default — both layers need scanning.
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
    disableHierarchicalLookup: true,
  },
};

module.exports = mergeConfig(defaultConfig, config);
