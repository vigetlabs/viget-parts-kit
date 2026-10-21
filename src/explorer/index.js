/**
 * Mount the Parts Kit explorer.
 */

/**
 * WordPress dependencies
 */
import { createRoot } from '@wordpress/element';
import domReady from '@wordpress/dom-ready';

/**
 * Internal dependencies
 */
import App from './app';
import './style.scss';

domReady( () => {
	const root = document.getElementById( 'vgtpk-explorer' );
	const json = document.getElementById( 'vgtpk-explorer-data' );

	if ( root && json ) {
		createRoot( root ).render(
			<App data={ JSON.parse( json.textContent ) } />
		);
	}
} );
