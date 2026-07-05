const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Supabase-js dynamically imports @opentelemetry/api with webpackIgnore but
// Metro still tries to resolve it. Map it to an empty stub so the web build
// doesn't fail.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "@opentelemetry/api": path.resolve(__dirname, "stubs/opentelemetry-api.js"),
};

module.exports = withNativeWind(config, { input: "./global.css" });
