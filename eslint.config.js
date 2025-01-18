import jsdoc from 'eslint-plugin-jsdoc';

// Full list of rules
// https://eslint.org/docs/latest/rules/

const config = [
	jsdoc.configs['flat/recommended-error'],
	{
		plugins: {
			jsdoc,
		},
		rules: {
			semi: ['error', 'always'],
			quotes: ['error', 'single'],

			// Variables
			'prefer-const': 'error',
			'object-shorthand': ['error', 'always'],
			camelcase: [
				'error',
				{
					properties: 'always',
					ignoreDestructuring: false,
					ignoreImports: false,
					ignoreGlobals: false,
				},
			],

			// If statements
			curly: ['error', 'multi'],
			eqeqeq: ['error', 'always'],
			'no-extra-boolean-cast': 'error',
			'no-lonely-if': 'error',
			yoda: 'error',

			// Functions
			'arrow-body-style': ['error', 'as-needed'], // () => 0
			'func-style': ['error', 'declaration'], // const foo = () => {}
			'no-else-return': 'error',
			'no-useless-return': 'error',

			'jsdoc/check-types': 'error',
			'jsdoc/no-undefined-types': 'off',
			'jsdoc/require-param-description': 'off',
			'jsdoc/require-description': 'off',

			'jsdoc/require-returns': ['error', { forceRequireReturn: true }],
			'jsdoc/require-returns-type': 'error',
			'jsdoc/require-returns-description': 'off',
		},
	},
];

export default config;
