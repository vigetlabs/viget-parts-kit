/**
 * Mount the Parts Kit explorer.
 */

/**
 * WordPress dependencies
 */
import { Component, createRoot } from '@wordpress/element';
import domReady from '@wordpress/dom-ready';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import App from './app';
import './style.scss';

// Keeps a render error from blanking the whole page.
class ErrorBoundary extends Component {
	constructor( props ) {
		super( props );
		this.state = { error: null };
	}

	static getDerivedStateFromError( error ) {
		return { error };
	}

	render() {
		if ( ! this.state.error ) {
			return this.props.children;
		}

		return (
			<div className="vgtpk-crash" role="alert">
				<p>
					{ __(
						'The Parts Kit ran into a problem.',
						'viget-parts-kit'
					) }
				</p>
				<button
					type="button"
					onClick={ () => window.location.reload() }
				>
					{ __( 'Reload', 'viget-parts-kit' ) }
				</button>
			</div>
		);
	}
}

domReady( () => {
	const root = document.getElementById( 'vgtpk-explorer' );
	const json = document.getElementById( 'vgtpk-explorer-data' );

	if ( root && json ) {
		createRoot( root ).render(
			<ErrorBoundary>
				<App data={ JSON.parse( json.textContent ) } />
			</ErrorBoundary>
		);
	}
} );
