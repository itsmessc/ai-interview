import js from '@eslint/js'

export default [
    {
        ignores: ['dist/**', 'node_modules/**'],
    },
    js.configs.recommended,
    {
        languageOptions: {
            globals: {
                process: 'readonly',
                console: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
            },
            sourceType: 'module',
        },
        rules: {
            'no-console': 'off',
        },
    },
]
