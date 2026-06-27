// No-op stub. react-native-css-interop's babel preset unconditionally includes
// this plugin (intended for reanimated 4+). We return an empty plugin so the
// web build works with reanimated 3.x.
module.exports = function () { return {}; };
