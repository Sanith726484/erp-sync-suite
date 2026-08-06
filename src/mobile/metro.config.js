const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the workspace (including ../api)
config.watchFolders = [workspaceRoot];

// 2. Let Metro resolve node_modules in both project and workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Map "api" module directly to ../api
config.resolver.extraNodeModules = {
  api: path.resolve(projectRoot, '../api'),
};

module.exports = config;
