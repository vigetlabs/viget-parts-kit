/**
 * Mount the Block Index.
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
	const root = document.getElementById( 'vgtpk-block-index' );

	if ( root ) {
		createRoot( root ).render( <App /> );
	}
} );
