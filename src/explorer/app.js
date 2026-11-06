/**
 * Parts Kit explorer.
 */

/**
 * WordPress dependencies
 */
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import Home from './home';
import Info from './info';
import Sidebar from './sidebar';
import Stage from './stage';
import Toolbar from './toolbar';
import { flatten, readUrl, request, writeUrl } from './utils';

const COLLAPSED_KEY = 'vgtpk-collapsed';

const readCollapsed = () => {
	try {
		return JSON.parse( window.localStorage.getItem( COLLAPSED_KEY ) ) || [];
	} catch {
		return [];
	}
};

export default function App( { data } ) {
	const [ state, setFullState ] = useState( () =>
		readUrl( data.initial, data.features.defaults )
	);
	const [ query, setQuery ] = useState( '' );
	const [ collapsed, setCollapsed ] = useState( readCollapsed );
	const [ infoOpen, setInfoOpen ] = useState( false );
	const [ menuOpen, setMenuOpen ] = useState( false );
	const [ focused, setFocused ] = useState( '' );
	const [ rebuild, setRebuild ] = useState( null );
	const [ toast, setToast ] = useState( '' );
	const [ creating, setCreating ] = useState( false );
	const searchRef = useRef();
	const iframeRef = useRef();

	const setState = useCallback(
		( patch ) => setFullState( ( prev ) => ( { ...prev, ...patch } ) ),
		[]
	);
	const flat = useMemo( () => flatten( data.nav ), [ data.nav ] );

	const current = useMemo( () => {
		if ( state.item ) {
			const item = flat.find( ( entry ) => entry.id === state.item );
			return item ? { ...item, type: 'item' } : null;
		}
		if ( state.page ) {
			const page = data.pages.find(
				( entry ) => entry.id === state.page
			);
			return page ? { ...page, type: 'page', name: '' } : null;
		}
		return null;
	}, [ state.item, state.page, flat, data.pages ] );

	// Background and labels apply live in the canvas, so they stay out of the iframe src.
	const src = useMemo( () => {
		if ( ! current ) {
			return '';
		}

		const url = new URL(
			current.type === 'page' ? current.url : data.canvasUrl
		);
		url.searchParams.set( 'vgtpk_canvas', '1' );

		if ( current.type === 'item' ) {
			url.searchParams.set( 'item', current.id );
			if ( state.ctx !== 'none' ) {
				url.searchParams.set( 'ctx', state.ctx );
			}
		}

		return url.toString();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ current?.id, current?.type, state.ctx ] );

	const shareUrl = useMemo( () => {
		if ( ! src ) {
			return '';
		}

		const url = new URL( src );
		if ( state.bg ) {
			url.searchParams.set( 'bg', state.bg );
		}
		if ( ! state.labels ) {
			url.searchParams.set( 'labels', '0' );
		}

		return url.toString();
	}, [ src, state.bg, state.labels ] );

	useEffect( () => writeUrl( data.archiveUrl, state ), [ state ] );

	useEffect( () => {
		try {
			window.localStorage.setItem(
				COLLAPSED_KEY,
				JSON.stringify( collapsed )
			);
		} catch {}
	}, [ collapsed ] );

	useEffect( () => {
		document.title = current
			? `${ current.title } – ${ __( 'Parts Kit', 'viget-parts-kit' ) }`
			: `${ __( 'Parts Kit', 'viget-parts-kit' ) } – ${ data.site.name }`;
	}, [ current ] );

	const postToCanvas = useCallback( ( message ) => {
		iframeRef.current?.contentWindow?.postMessage(
			{ source: 'vgtpk-explorer', ...message },
			window.location.origin
		);
	}, [] );

	const syncCanvas = useCallback( () => {
		postToCanvas( { type: 'set-background', slug: state.bg } );
		postToCanvas( { type: 'set-labels', show: state.labels } );
	}, [ postToCanvas, state.bg, state.labels ] );

	useEffect( syncCanvas, [ state.bg, state.labels ] );

	const showToast = ( text ) => {
		setToast( text );
		setTimeout( () => setToast( '' ), 3200 );
	};

	const selectItem = ( id ) => {
		setState( { item: id, page: 0 } );
		setFocused( '' );
		setMenuOpen( false );
	};

	const selectPage = ( id ) => {
		setState( { item: '', page: id } );
		setInfoOpen( false );
		setMenuOpen( false );
	};

	const goHome = () => {
		setState( { item: '', page: 0 } );
		setMenuOpen( false );
	};

	const toggleCategory = ( slug ) =>
		setCollapsed( ( prev ) =>
			prev.includes( slug )
				? prev.filter( ( s ) => s !== slug )
				: [ ...prev, slug ]
		);

	const focusSample = ( key ) => {
		setFocused( key );
		postToCanvas( { type: 'focus-sample', key } );
	};

	// Messages from the canvas and the background generator.
	useEffect( () => {
		const onMessage = ( event ) => {
			if ( event.origin !== window.location.origin ) {
				return;
			}

			const message = event.data || {};

			if (
				message.source === 'vgtpk-canvas' &&
				message.type === 'sample-in-view'
			) {
				setFocused( message.key );
			}

			if ( message.source === 'vgtpk-generator' ) {
				if ( message.type === 'progress' ) {
					setRebuild( { done: message.done, total: message.total } );
				}
				if ( message.type === 'complete' ) {
					setRebuild( { complete: true, count: message.count } );
					setTimeout( () => window.location.reload(), 500 );
				}
				if ( message.type === 'error' ) {
					setRebuild( null );
					showToast( message.message );
				}
			}
		};

		window.addEventListener( 'message', onMessage );
		return () => window.removeEventListener( 'message', onMessage );
	}, [] );

	const startRebuild = useCallback( () => {
		if ( ! data.urls.generator || rebuild ) {
			return;
		}

		setRebuild( { done: 0, total: 0 } );
	}, [ data.urls.generator, rebuild ] );

	// Rebuild quietly in the background when the blocks changed since the last build.
	useEffect( () => {
		if (
			data.can.manage &&
			data.status.stale &&
			( data.features.autoRebuild || ! data.status.exists )
		) {
			startRebuild();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [] );

	// Keyboard: "/" to search, "[" and "]" to step through blocks.
	useEffect( () => {
		const onKey = ( event ) => {
			if ( ! data.features.keyboard ) {
				return;
			}

			const typing = [ 'INPUT', 'SELECT', 'TEXTAREA' ].includes(
				event.target.tagName
			);

			if ( event.key === '/' && ! typing ) {
				event.preventDefault();
				searchRef.current?.focus();
			}

			if (
				( event.key === '[' || event.key === ']' ) &&
				! typing &&
				flat.length
			) {
				const index = flat.findIndex(
					( item ) => item.id === state.item
				);
				const next = event.key === ']' ? index + 1 : index - 1;
				const target = flat[ ( next + flat.length ) % flat.length ];
				selectItem( target.id );
			}
		};

		document.addEventListener( 'keydown', onKey );
		return () => document.removeEventListener( 'keydown', onKey );
	} );

	const createPage = async () => {
		setCreating( true );

		try {
			const json = await request( data.rest, 'pages', {
				method: 'POST',
				body: JSON.stringify( {
					title: sprintf(
						/* translators: %s: block title. */
						__( '%s QA', 'viget-parts-kit' ),
						current.title
					),
					items: [ current.id ],
					samples: 'all',
				} ),
			} );
			window.location.assign( json.editUrl );
		} catch ( error ) {
			showToast( error.message );
			setCreating( false );
		}
	};

	let rebuildText = __(
		'Blocks changed since the last build. Rebuilding…',
		'viget-parts-kit'
	);

	if ( rebuild?.complete ) {
		rebuildText = sprintf(
			/* translators: %d: number of blocks. */
			__( 'Rebuilt %d blocks. Reloading…', 'viget-parts-kit' ),
			rebuild.count
		);
	} else if ( rebuild?.total ) {
		rebuildText = sprintf(
			/* translators: 1: done, 2: total. */
			__( 'Rebuilding the Parts Kit: %1$d of %2$d', 'viget-parts-kit' ),
			rebuild.done,
			rebuild.total
		);
	}

	return (
		<div
			className={ `vgtpk-app${ menuOpen ? ' is-menu-open' : '' }${ infoOpen && current?.type === 'item' ? ' is-info-open' : '' }` }
		>
			<Sidebar
				data={ data }
				state={ state }
				query={ query }
				setQuery={ setQuery }
				collapsed={ collapsed }
				toggleCategory={ toggleCategory }
				onSelectItem={ selectItem }
				onSelectPage={ selectPage }
				onHome={ goHome }
				searchRef={ searchRef }
			/>

			<button
				type="button"
				className="vgtpk-scrim"
				onClick={ () => setMenuOpen( false ) }
				aria-label={ __( 'Close block list', 'viget-parts-kit' ) }
				tabIndex={ menuOpen ? 0 : -1 }
			/>

			<main className="vgtpk-main">
				<Toolbar
					data={ data }
					state={ state }
					setState={ setState }
					current={ current }
					canvasUrl={ shareUrl }
					infoOpen={ infoOpen }
					setInfoOpen={ setInfoOpen }
					onMenu={ () => setMenuOpen( true ) }
					onCreatePage={ createPage }
					creating={ creating }
				/>

				<div className="vgtpk-workspace">
					{ current ? (
						<Stage
							ref={ iframeRef }
							viewports={ data.features.viewports || [] }
							resize={ data.features.resize }
							src={ src }
							state={ state }
							setState={ setState }
							title={ current.title }
							onLoad={ syncCanvas }
						/>
					) : (
						<Home
							data={ data }
							onSelectItem={ selectItem }
							onSelectPage={ selectPage }
							onRebuild={ startRebuild }
							rebuilding={ !! rebuild }
						/>
					) }

					{ infoOpen && current?.type === 'item' && (
						<Info
							rest={ data.rest }
							item={ current }
							focused={ focused }
							onFocusSample={ focusSample }
							canCopy={ data.features.copyMarkup }
							onClose={ () => setInfoOpen( false ) }
						/>
					) }
				</div>
			</main>

			{ rebuild && (
				<div className="vgtpk-rebuild" role="status" aria-live="polite">
					<span className="vgtpk-rebuild__text">{ rebuildText }</span>
					<span className="vgtpk-rebuild__bar">
						<span
							style={ {
								width: rebuild.total
									? `${ ( rebuild.done / rebuild.total ) * 100 }%`
									: '4%',
							} }
						/>
					</span>
					<iframe
						className="vgtpk-rebuild__frame"
						src={ `${ data.urls.generator }&vgtpk_embedded=1` }
						title={ __( 'Parts Kit builder', 'viget-parts-kit' ) }
						tabIndex={ -1 }
						aria-hidden="true"
					/>
				</div>
			) }

			{ toast && (
				<div className="vgtpk-toast" role="alert">
					{ toast }
				</div>
			) }
		</div>
	);
}
