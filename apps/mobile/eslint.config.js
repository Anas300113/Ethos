// Expo flat config (SDK 53+). Local to apps/mobile so `expo lint` never
// resolves the Next.js root config, which ignores apps/mobile/**.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([expoConfig, { ignores: ["dist/*"] }]);
