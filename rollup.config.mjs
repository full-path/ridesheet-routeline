import terser from '@rollup/plugin-terser';
import nodeResolve from '@rollup/plugin-node-resolve';
// rollup needs this to update CommonJS modules in @google/dscc to ES6
import commonjs from '@rollup/plugin-commonjs';

// Suppress warnings for circular dependencies from d3
const onwarn = (warning, defaultHandler) => {
    const ignoredWarnings = [
        {
            code: 'CIRCULAR_DEPENDENCY',
            file: 'node_modules/d3-'
        }
    ];

    if (
        !ignoredWarnings.some(
            ({ code, file }) => warning.code === code && warning.message.includes(file)
        )
    ) {
        defaultHandler(warning);
    }
};

export default {
  input: 'src/main.js',
  onwarn,
  output: {
    file: 'dist/bundle.min.js',
    format: 'iife', // Immediately Invoked Function Expression
    name: 'myD3Bundle'
  },
  plugins: [
    terser(),
    nodeResolve(),
    commonjs()
  ]
};
