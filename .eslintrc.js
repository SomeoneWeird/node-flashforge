module.exports = {
  env: {
    es6: true,
    node: true
  },
  extends: [
    'oclif',
    'oclif-typescript',
    'standard',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/typescript'
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly'
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module'
  },
  plugins: [
    '@typescript-eslint'
  ],
  rules: {
    'arrow-parens': [ 0 ],
    '@typescript-eslint/member-delimiter-style': [ 0 ],
    'array-bracket-spacing': [ 0 ],
    '@typescript-eslint/no-empty-interface': [ 0 ],
    '@typescript-eslint/no-use-before-define': [ 0 ],
    'no-warning-comments': [ 0 ],
    'unicorn/no-process-exit': [ 0 ],
    'no-process-exit': [ 0 ],
    'node/no-missing-import': [ 'error', {
      tryExtensions: [ '.ts', '.js', '.json', '.d.ts' ]
    }]
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: [ '.ts' ]
      }
    }
  }
}
