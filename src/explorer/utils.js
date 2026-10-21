/**
 * Explorer helpers.
 */

/**
 * WordPress dependencies
 */
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Read explorer state from the URL.
 *
 * @param {Object} initial  Server-provided initial state.
 * @param {Object} defaults Defaults from the explorer features.
 * @return {Object} State.
 */
export function readUrl( initial = {}, defaults = {} ) {
	const params = new URLSearchParams( window.location.search );
	const width = parseInt( params.get( 'w' ), 10 );
	const labels = params.get( 'labels' );

	return {
		item: params.get( 'item' ) || '',
		page: parseInt( params.get( 'page' ), 10 ) || initial.page || 0,
		viewport: params.get( 'vp' ) || defaults.viewport || 'full',
		width: Number.isFinite( width ) ? width : null,
		bg: params.get( 'bg' ) ?? ( defaults.bg || '' ),
		ctx: params.get( 'ctx' ) || defaults.ctx || 'none',
		labels: labels === null ? defaults.labels !== false : labels !== '0',
	};
}

/**
 * Write explorer state to the URL without reloading.
 *
 * @param {string} archiveUrl Archive URL.
 * @param {Object} state      State.
 */
export function writeUrl( archiveUrl, state ) {
	const url = new URL( archiveUrl );

	if ( state.item ) {
		url.searchParams.set( 'item', state.item );
	} else if ( state.page ) {
		url.searchParams.set( 'page', state.page );
	}

	if ( state.viewport !== 'full' ) {
		url.searchParams.set( 'vp', state.viewport );
	}
	if ( state.viewport === 'custom' && state.width ) {
		url.searchParams.set( 'w', state.width );
	}
	if ( state.bg ) {
		url.searchParams.set( 'bg', state.bg );
	}
	if ( state.ctx !== 'none' ) {
		url.searchParams.set( 'ctx', state.ctx );
	}
	if ( ! state.labels ) {
		url.searchParams.set( 'labels', '0' );
	}

	if ( url.toString() !== window.location.href ) {
		window.history.replaceState( null, '', url );
	}
}

/**
 * Flatten nav into a list of selectable items, children included.
 *
 * @param {Array} nav Nav categories.
 * @return {Array} Items with their category.
 */
export function flatten( nav ) {
	return nav.flatMap( ( category ) =>
		category.items.flatMap( ( item ) => [
			{ ...item, category },
			...item.children.map( ( child ) => ( {
				...child,
				category,
				parentTitle: item.title,
			} ) ),
		] )
	);
}

/**
 * Whether an item matches a search query.
 *
 * @param {Object} item  Item.
 * @param {string} query Lowercased query.
 * @return {boolean} Match.
 */
export function matches( item, query ) {
	if ( ! query ) {
		return true;
	}

	return [
		item.title,
		item.name,
		item.category?.title,
		...( item.keywords || [] ),
	]
		.filter( Boolean )
		.some( ( value ) => value.toLowerCase().includes( query ) );
}

/**
 * Relative time, e.g. "3 hours ago".
 *
 * @param {string} iso ISO date.
 * @return {string} Relative time.
 */
export function timeAgo( iso ) {
	if ( ! iso ) {
		return '';
	}

	const minutes = Math.round(
		( Date.now() - new Date( iso ).getTime() ) / 60000
	);

	if ( minutes < 1 ) {
		return __( 'just now', 'viget-parts-kit' );
	}
	if ( minutes < 60 ) {
		return sprintf(
			/* translators: %d: minutes. */
			_n( '%d minute ago', '%d minutes ago', minutes, 'viget-parts-kit' ),
			minutes
		);
	}

	const hours = Math.round( minutes / 60 );
	if ( hours < 24 ) {
		return sprintf(
			/* translators: %d: hours. */
			_n( '%d hour ago', '%d hours ago', hours, 'viget-parts-kit' ),
			hours
		);
	}

	const days = Math.round( hours / 24 );
	return sprintf(
		/* translators: %d: days. */
		_n( '%d day ago', '%d days ago', days, 'viget-parts-kit' ),
		days
	);
}

/**
 * Fetch from the plugin's REST namespace.
 *
 * @param {Object} rest    `{ root, nonce }`.
 * @param {string} path    Path under the namespace.
 * @param {Object} options Fetch options.
 * @return {Promise<Object>} JSON.
 */
export async function request( rest, path, options = {} ) {
	const response = await window.fetch( rest.root + path, {
		credentials: 'same-origin',
		...options,
		headers: {
			'Content-Type': 'application/json',
			...( rest.nonce ? { 'X-WP-Nonce': rest.nonce } : {} ),
			...( options.headers || {} ),
		},
	} );
	const json = await response.json();

	if ( ! response.ok ) {
		throw new Error( json?.message || response.statusText );
	}

	return json;
}
