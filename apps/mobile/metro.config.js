// Expo SDK 54 auto-configures Metro for pnpm monorepos (watchFolders / node_modules paths).
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
