/**
 * Block Index app.
 */

/**
 * WordPress dependencies
 */
import { useCallback, useEffect, useMemo, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import Blocks from './blocks';
import Content from './content';
import Health from './health';
import Overview from './overview';
import StylesTab from './styles-tab';
import { aggregateBlocks, filterRecords, findings, num } from './data';

const config = window.vgtpkBlockIndex || {};

const TABS = [
	{ slug: 'overview', label: __( 'Overview', 'viget-parts-kit' ) },
	{ slug: 'blocks', label: __( 'Blocks', 'viget-parts-kit' ) },
	{ slug: 'content', label: __( 'Content', 'viget-parts-kit' ) },
	{ slug: 'styles', label: __( 'Styles', 'viget-parts-kit' ) },
	{ slug: 'health', label: __( 'Health', 'viget-parts-kit' ) },
];

const DEFAULT_VIEW = {
	tab: 'overview',
	type: 'all',
	status: 'all',
	templates: true,
	search: '',
	blockStatus: 'all',
	origin: 'all',
	showHidden: false,
	audit: 'all',
	expand: '',
	contains: '',
};

const readHash = () => {
	const params = new URLSearchParams( window.location.hash.slice( 1 ) );
	const view = { ...DEFAULT_VIEW };

	params.forEach( ( value, key ) => {
		if ( key in view ) {
			view[ key ] =
				typeof view[ key ] === 'boolean' ? value === '1' : value;
		}
	} );

	return view;
};

const writeHash = ( view ) => {
	const params = new URLSearchParams();

	Object.entries( view ).forEach( ( [ key, value ] ) => {
		if ( value !== DEFAULT_VIEW[ key ] ) {
			params.set(
				key,
				typeof value === 'boolean' ? Number( value ) : value
			);
		}
	} );

	const hash = params.toString();
	window.history.replaceState(
		null,
		'',
		hash ? `#${ hash }` : window.location.pathname + window.location.search
	);
};

async function api( path, options = {} ) {
	const response = await window.fetch( config.restRoot + path, {
		credentials: 'same-origin',
		...options,
		headers: {
			'Content-Type': 'application/json',
			'X-WP-Nonce': config.nonce,
		},
	} );
	const json = await response.json();

	if ( ! response.ok ) {
		throw new Error( json?.message || response.statusText );
	}

	return json;
}

function timeAgo( value ) {
	if ( ! value ) {
		return '';
	}

	const date = new Date( value.replace( ' ', 'T' ) + 'Z' );
	return new Intl.DateTimeFormat( undefined, {
		dateStyle: 'medium',
		timeStyle: 'short',
	} ).format( date );
}

export default function App() {
	const [ raw, setRaw ] = useState( null );
	const [ error, setError ] = useState( '' );
	const [ scan, setScan ] = useState( null );
	const [ view, setFullView ] = useState( readHash );

	const setView = useCallback(
		( patch ) => setFullView( ( prev ) => ( { ...prev, ...patch } ) ),
		[]
	);

	useEffect( () => writeHash( view ), [ view ] );

	const load = useCallback(
		() =>
			api( 'index' )
				.then( setRaw )
				.catch( ( err ) => setError( err.message ) ),
		[]
	);

	const runScan = useCallback(
		async ( mode ) => {
			setScan( { mode, processed: 0, total: 0 } );
			setError( '' );

			try {
				let offset = 0;
				let done = false;

				while ( ! done ) {
					const result = await api( 'index/scan', {
						method: 'POST',
						body: JSON.stringify( { mode, offset } ),
					} );
					offset = result.offset;
					done = result.done;
					setScan( {
						mode,
						processed: result.processed,
						total: result.total,
					} );
				}

				await load();
			} catch ( err ) {
				setError( err.message );
			}

			setScan( null );
		},
		[ load ]
	);

	useEffect( () => {
		load().then( () => {} );
	}, [] );

	// First visit: nothing scanned yet, so scan right away.
	useEffect( () => {
		if ( raw && ! raw.scannedAt && ! scan ) {
			runScan( 'full' );
		}
	}, [ raw ] );

	const records = useMemo(
		() => ( raw ? filterRecords( raw.records, view ) : [] ),
		[ raw, view.type, view.status, view.templates ]
	);
	const blocks = useMemo(
		() => ( raw ? aggregateBlocks( raw, records ) : [] ),
		[ raw, records ]
	);
	const registeredSet = useMemo(
		() =>
			new Set( raw ? raw.registered.map( ( block ) => block.name ) : [] ),
		[ raw ]
	);
	const issues = useMemo(
		() => ( raw ? findings( blocks, records, raw.records ) : [] ),
		[ blocks, records, raw ]
	);

	const goTo = ( tab, patch = {} ) => {
		const next = { tab, ...patch };
		if ( 'status' in patch ) {
			next.blockStatus = patch.status;
			delete next.status;
		}
		setView( next );
		window.scrollTo( { top: 0 } );
	};

	const types = raw
		? Object.entries( raw.postTypes ).filter( ( [ type ] ) =>
				raw.records.some( ( record ) => record.type === type )
			)
		: [];

	return (
		<div className="vgtpk-index">
			<header className="vgtpk-index__header">
				<div className="vgtpk-index__title">
					<p>{ config.siteName }</p>
					<h1>{ __( 'Block Index', 'viget-parts-kit' ) }</h1>
				</div>

				<div className="vgtpk-index__scan">
					{ scan ? (
						<div
							className="vgtpk-scan"
							role="status"
							aria-live="polite"
						>
							<span>
								{ scan.total
									? sprintf(
											/* translators: 1: processed, 2: total. */
											__(
												'Scanning %1$s of %2$s',
												'viget-parts-kit'
											),
											num(
												Math.min(
													scan.processed,
													scan.total
												)
											),
											num( scan.total )
										)
									: __( 'Scanning…', 'viget-parts-kit' ) }
							</span>
							<span className="vgtpk-scan__bar">
								<span
									style={ {
										width: scan.total
											? `${ ( Math.min( scan.processed, scan.total ) / scan.total ) * 100 }%`
											: '6%',
									} }
								/>
							</span>
						</div>
					) : (
						raw?.scannedAt && (
							<p className="vgtpk-scan__meta">
								{ sprintf(
									/* translators: %s: date and time. */
									__( 'Scanned %s.', 'viget-parts-kit' ),
									timeAgo( raw.scannedAt )
								) }{ ' ' }
								{ raw.changed > 0 && (
									<strong>
										{ sprintf(
											/* translators: %s: number of changed items. */
											_n(
												'%s item changed since.',
												'%s items changed since.',
												raw.changed,
												'viget-parts-kit'
											),
											num( raw.changed )
										) }
									</strong>
								) }
							</p>
						)
					) }

					<div className="vgtpk-index__actions">
						<button
							type="button"
							className="vgtpk-button"
							onClick={ () => runScan( 'changes' ) }
							disabled={ !! scan || ! raw }
						>
							{ __( 'Refresh', 'viget-parts-kit' ) }
						</button>
						<button
							type="button"
							className="vgtpk-button vgtpk-button--ghost"
							onClick={ () => runScan( 'full' ) }
							disabled={ !! scan || ! raw }
						>
							{ __( 'Rescan everything', 'viget-parts-kit' ) }
						</button>
						<a
							className="vgtpk-button vgtpk-button--ghost"
							href={ config.partsKitUrl }
						>
							{ __( 'Open Parts Kit', 'viget-parts-kit' ) }
						</a>
					</div>
				</div>
			</header>

			{ error && (
				<div className="vgtpk-error" role="alert">
					{ error }
				</div>
			) }

			{ ! raw && ! error && (
				<p className="vgtpk-loading">
					{ __( 'Loading the Block Index…', 'viget-parts-kit' ) }
				</p>
			) }

			{ raw && (
				<>
					<div className="vgtpk-index__bar">
						<nav
							className="vgtpk-tabs"
							aria-label={ __(
								'Block Index sections',
								'viget-parts-kit'
							) }
						>
							{ TABS.map( ( tab ) => (
								<button
									type="button"
									key={ tab.slug }
									className={
										view.tab === tab.slug ? 'is-active' : ''
									}
									aria-current={
										view.tab === tab.slug
											? 'page'
											: undefined
									}
									onClick={ () =>
										setView( { tab: tab.slug, search: '' } )
									}
								>
									{ tab.label }
									{ tab.slug === 'health' &&
										issues.length > 0 && (
											<span className="vgtpk-tabs__badge">
												{ issues.length }
											</span>
										) }
								</button>
							) ) }
						</nav>

						<div className="vgtpk-scope">
							<label
								htmlFor="vgtpk-app-field-1"
								className="vgtpk-field"
							>
								<span className="screen-reader-text">
									{ __( 'Content type', 'viget-parts-kit' ) }
								</span>
								<select
									id="vgtpk-app-field-1"
									value={ view.type }
									onChange={ ( event ) =>
										setView( { type: event.target.value } )
									}
								>
									<option value="all">
										{ __(
											'All content types',
											'viget-parts-kit'
										) }
									</option>
									{ types.map( ( [ type, label ] ) => (
										<option key={ type } value={ type }>
											{ label }
										</option>
									) ) }
								</select>
							</label>
							<label
								htmlFor="vgtpk-app-field-2"
								className="vgtpk-field"
							>
								<span className="screen-reader-text">
									{ __( 'Status', 'viget-parts-kit' ) }
								</span>
								<select
									id="vgtpk-app-field-2"
									value={ view.status }
									onChange={ ( event ) =>
										setView( {
											status: event.target.value,
										} )
									}
								>
									<option value="all">
										{ __(
											'Any status',
											'viget-parts-kit'
										) }
									</option>
									{ Object.entries( raw.statuses ).map(
										( [ status, label ] ) => (
											<option
												key={ status }
												value={ status }
											>
												{ label }
											</option>
										)
									) }
								</select>
							</label>
							{ raw.blockTheme && (
								<label
									htmlFor="vgtpk-app-field-3"
									className="vgtpk-check"
								>
									<input
										id="vgtpk-app-field-3"
										type="checkbox"
										checked={ view.templates }
										onChange={ ( event ) =>
											setView( {
												templates: event.target.checked,
											} )
										}
									/>
									{ __(
										'Include templates',
										'viget-parts-kit'
									) }
								</label>
							) }
						</div>
					</div>

					{ view.tab === 'overview' && (
						<Overview
							raw={ raw }
							blocks={ blocks }
							records={ records }
							registeredSet={ registeredSet }
							issues={ issues.length }
							goTo={ goTo }
						/>
					) }
					{ view.tab === 'blocks' && (
						<Blocks
							raw={ raw }
							blocks={ blocks }
							view={ { ...view, status: view.blockStatus } }
							setView={ ( patch ) => {
								if ( 'status' in patch ) {
									patch = {
										...patch,
										blockStatus: patch.status,
									};
									delete patch.status;
								}
								setView( patch );
							} }
							partsKitUrl={ config.partsKitUrl }
						/>
					) }
					{ view.tab === 'content' && (
						<Content
							raw={ raw }
							blocks={ blocks }
							records={ records }
							registeredSet={ registeredSet }
							view={ view }
							setView={ setView }
						/>
					) }
					{ view.tab === 'styles' && (
						<StylesTab blocks={ blocks } goTo={ goTo } />
					) }
					{ view.tab === 'health' && (
						<Health issues={ issues } raw={ raw } goTo={ goTo } />
					) }
				</>
			) }
		</div>
	);
}
