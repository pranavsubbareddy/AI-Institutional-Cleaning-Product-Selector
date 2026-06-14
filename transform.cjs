// Custom Jest transform that handles import.meta.env (Vite-specific)
// so Jest can run tests on Vite-based React components.

const babelJest = require('babel-jest');

// This plugin transforms import.meta.env.X to process.env.X
// so Jest can evaluate files that use Vite's import.meta.env.
function importMetaEnvPlugin() {
  return {
    visitor: {
      MemberExpression(path) {
        if (
          path.node.object &&
          path.node.object.type === 'MetaProperty' &&
          path.node.object.meta &&
          path.node.object.meta.name === 'import' &&
          path.node.object.property &&
          path.node.object.property.name === 'meta' &&
          path.node.property &&
          path.node.property.name === 'env'
        ) {
          path.replaceWithSourceString('process.env');
        }
      },
    },
  };
}

module.exports = babelJest.default.createTransformer({
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
  plugins: [importMetaEnvPlugin],
});
