// Metro config. Default Expo config + `.wasm` as a resolvable asset, which
// expo-sqlite's web target (wa-sqlite) imports — without it the web bundle fails
// to resolve `./wa-sqlite/wa-sqlite.wasm`. Native bundling is unaffected.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('wasm');

module.exports = config;
