/**
 * Network mode: merges each site's saved index into the shape the tabs expect, and lists the sites.
 */

/**
 * WordPress dependencies
 */
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { num } from './data';

/**
 * Build the `raw` payload for one site, or every site merged.
 *
 * @param {Object} network REST payload from network/index.
 * @param {string} site    Site ID, or 'all'.
 * @return {Object} Raw payload.
 */
export function buildRaw( network, site ) {
	const names = Object.fromEntries(
		network.sites.map( ( entry ) => [ String( entry.id ), entry.name ] )
	);
	const ids = Object.keys( network.indexes ).filter(
		( id ) => site === 'all' || id === site
	);
	const raw = {
		network: true,
		records: [],
		registered: [],
		categories: [],
		postTypes: {},
		statuses: {},
		theme: [],
		blockTheme: false,
		partsKitUrl: '',
	};
	const registered = new Map();
	const categories = new Map();

	ids.forEach( ( id ) => {
		const index = network.indexes[ id ];
		const known = new Set(
			index.registered.map( ( block ) => block.name )
		);

		index.records.forEach( ( record ) =>
			raw.records.push( {
				...record,
				key: `${ id }:${ record.key }`,
				site: id,
				siteName: names[ id ] || id,
				// Registered on another site doesn't help this one.
				unregistered: Object.keys( record.blocks ).filter(
					( name ) => ! known.has( name )
				),
			} )
		);

		index.registered.forEach( ( block ) => {
			const existing = registered.get( block.name );

			if ( ! existing ) {
				registered.set( block.name, { ...block } );
				return;
			}

			const styles = new Set( existing.styles.map( ( s ) => s.name ) );
			existing.styles = [
				...existing.styles,
				...block.styles.filter( ( s ) => ! styles.has( s.name ) ),
			];
			existing.inKit = existing.inKit || block.inKit;
		} );

		index.categories.forEach( ( category ) =>
			categories.set( category.slug, category )
		);
		Object.assign( raw.postTypes, index.postTypes );
		Object.assign( raw.statuses, index.statuses );
		raw.theme = [ ...new Set( [ ...raw.theme, ...index.theme ] ) ];
		raw.blockTheme = raw.blockTheme || index.blockTheme;
	} );

	raw.registered = [ ...registered.values() ];
	raw.categories = [ ...categories.values() ];

	if ( site !== 'all' && network.indexes[ site ] ) {
		raw.partsKitUrl = network.indexes[ site ].partsKitUrl;
	}

	return raw;
}

function formatDate( value ) {
	return new Intl.DateTimeFormat( undefined, {
		dateStyle: 'medium',
		timeStyle: 'short',
	} ).format( new Date( value.replace( ' ', 'T' ) + 'Z' ) );
}

function scanState( entry ) {
	if ( ! entry.active ) {
		return __( 'Plugin not active', 'viget-parts-kit' );
	}

	if ( ! entry.scannedAt ) {
		return __( 'Never scanned', 'viget-parts-kit' );
	}

	if ( ! entry.ready ) {
		return __( 'Rescan needed', 'viget-parts-kit' );
	}

	return entry.changed > 0
		? sprintf(
				/* translators: %s: number of changed items. */
				_n(
					'%s item changed since',
					'%s items changed since',
					entry.changed,
					'viget-parts-kit'
				),
				num( entry.changed )
			)
		: __( 'Up to date', 'viget-parts-kit' );
}

export function Sites( { sites, setView } ) {
	return (
		<div className="vgtpk-tab">
			<p className="vgtpk-muted">
				{ __(
					'Scans run on each site, so block types and templates come from that site’s own theme and plugins. Open a site’s Block Index to refresh it.',
					'viget-parts-kit'
				) }
			</p>

			<table className="vgtpk-table">
				<thead>
					<tr>
						<th scope="col">{ __( 'Site', 'viget-parts-kit' ) }</th>
						<th scope="col">
							{ __( 'Last scan', 'viget-parts-kit' ) }
						</th>
						<th scope="col">
							{ __( 'Status', 'viget-parts-kit' ) }
						</th>
						<th scope="col" className="is-numeric">
							{ __( 'Items', 'viget-parts-kit' ) }
						</th>
						<th scope="col">
							<span className="screen-reader-text">
								{ __( 'Links', 'viget-parts-kit' ) }
							</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{ sites.map( ( entry ) => (
						<tr key={ entry.id }>
							<td>
								{ entry.ready ? (
									<button
										type="button"
										className="vgtpk-link"
										onClick={ () =>
											setView( {
												site: String( entry.id ),
												tab: 'overview',
											} )
										}
									>
										<strong>{ entry.name }</strong>
									</button>
								) : (
									<strong>{ entry.name }</strong>
								) }
								<br />
								<small className="vgtpk-muted">
									{ entry.url }
								</small>
							</td>
							<td>
								{ entry.scannedAt
									? formatDate( entry.scannedAt )
									: '—' }
							</td>
							<td>{ scanState( entry ) }</td>
							<td className="is-numeric">
								{ entry.ready ? num( entry.records ) : '—' }
							</td>
							<td>
								{ entry.indexUrl && (
									<span className="vgtpk-record-links">
										<a href={ entry.indexUrl }>
											{ __(
												'Open Block Index',
												'viget-parts-kit'
											) }
											<span className="screen-reader-text">
												{ ' ' }
												{ entry.name }
											</span>
										</a>
									</span>
								) }
							</td>
						</tr>
					) ) }
				</tbody>
			</table>
		</div>
	);
}
