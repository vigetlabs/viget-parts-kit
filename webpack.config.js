/**
 * External dependencies
 */
const path = require( 'path' );
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

module.exports = {
	...defaultConfig,

	entry: {
		explorer: path.resolve( process.cwd(), 'src/explorer/index.js' ),
		generator: path.resolve( process.cwd(), 'src/generator/index.js' ),
		'block-index': path.resolve(
			process.cwd(),
			'src/block-index/index.js'
		),
		canvas: path.resolve( process.cwd(), 'src/canvas/index.js' ),
	},
};
