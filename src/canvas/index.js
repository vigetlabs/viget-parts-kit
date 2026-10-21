/**
 * Canvas helper: keeps sample links from navigating the iframe away, and talks to the explorer.
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import './style.scss';

const post = ( message ) => {
	if ( window.parent !== window ) {
		window.parent.postMessage(
			{ source: 'vgtpk-canvas', ...message },
			window.location.origin
		);
	}
};

let toastTimer;

const toast = ( text ) => {
	let el = document.querySelector( '.vgtpk-toast' );

	if ( ! el ) {
		el = document.createElement( 'div' );
		el.className = 'vgtpk-toast';
		el.setAttribute( 'role', 'status' );
		document.body.appendChild( el );
	}

	el.textContent = text;
	el.classList.add( 'is-visible' );
	clearTimeout( toastTimer );
	toastTimer = setTimeout( () => el.classList.remove( 'is-visible' ), 1800 );
};

document.addEventListener( 'click', ( event ) => {
	const link = event.target.closest( 'a[href]' );

	if ( ! link || link.getAttribute( 'href' ).startsWith( '#' ) ) {
		return;
	}

	event.preventDefault();
	toast(
		__( 'Links don’t navigate inside the Parts Kit.', 'viget-parts-kit' )
	);
} );

document.addEventListener( 'submit', ( event ) => {
	event.preventDefault();
	toast(
		__( 'Forms don’t submit inside the Parts Kit.', 'viget-parts-kit' )
	);
} );

window.addEventListener( 'message', ( event ) => {
	if (
		event.origin !== window.location.origin ||
		event.data?.source !== 'vgtpk-explorer'
	) {
		return;
	}

	if ( event.data.type === 'set-background' ) {
		const main = document.querySelector( '.vgtpk-canvas__main' );

		if ( main ) {
			[ ...main.classList ]
				.filter(
					( name ) =>
						/^has-.+-background-color$/.test( name ) ||
						name === 'has-background'
				)
				.forEach( ( name ) => main.classList.remove( name ) );

			if ( event.data.slug ) {
				main.classList.add(
					'has-background',
					`has-${ event.data.slug }-background-color`
				);
			}
		}
	}

	if ( event.data.type === 'set-labels' ) {
		document
			.querySelectorAll( '.vgtpk-label' )
			.forEach( ( el ) =>
				el.classList.toggle( 'is-hidden', ! event.data.show )
			);
	}

	if ( event.data.type === 'focus-sample' ) {
		const label = document.querySelector(
			`[data-vgtpk-sample="${ window.CSS.escape( event.data.key ) }"]`
		);

		document
			.querySelectorAll( '.vgtpk-label.is-focused' )
			.forEach( ( el ) => el.classList.remove( 'is-focused' ) );

		if ( label ) {
			label.classList.add( 'is-focused' );
			label.scrollIntoView( {
				behavior: window.matchMedia(
					'(prefers-reduced-motion: reduce)'
				).matches
					? 'auto'
					: 'smooth',
				block: 'start',
			} );
		}
	}
} );

// Report which sample is in view, so the explorer can highlight it.
const labels = [ ...document.querySelectorAll( '[data-vgtpk-sample]' ) ];

if ( labels.length && 'IntersectionObserver' in window ) {
	const observer = new window.IntersectionObserver(
		( entries ) => {
			const visible = entries.filter( ( entry ) => entry.isIntersecting );
			if ( visible.length ) {
				post( {
					type: 'sample-in-view',
					key: visible[ 0 ].target.dataset.vgtpkSample,
				} );
			}
		},
		{ rootMargin: '0px 0px -70% 0px' }
	);

	labels.forEach( ( label ) => observer.observe( label ) );
}

post( { type: 'ready', title: document.title } );
