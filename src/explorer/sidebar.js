/**
 * Explorer sidebar: search, QA pages and blocks grouped like the inserter.
 */

/**
 * WordPress dependencies
 */
import { useMemo, useRef, useEffect } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import {
	ChevronIcon,
	IndexIcon,
	PageIcon,
	PlusIcon,
	SearchIcon,
	CloseIcon,
} from './icons';
import { flatten, matches } from './utils';

// Block icon from the catalog, or the first letter of the title.
export function BlockIcon( { item } ) {
	if ( item.icon?.startsWith( 'dashicon:' ) ) {
		return (
			<span
				className={ `vgtpk-block-icon dashicons dashicons-${ item.icon.slice( 9 ) }` }
				aria-hidden="true"
			/>
		);
	}

	if ( item.icon ) {
		// Sanitized to an SVG allowlist on the server.
		return (
			<span
				className="vgtpk-block-icon"
				dangerouslySetInnerHTML={ { __html: item.icon } }
			/>
		);
	}

	return (
		<span
			className="vgtpk-block-icon vgtpk-block-icon--letter"
			aria-hidden="true"
		>
			{ ( item.title || '?' ).charAt( 0 ) }
		</span>
	);
}

function NavItem( { item, selected, onSelect, depth = 0 } ) {
	const isActive = selected === item.id;

	return (
		<li>
			<button
				type="button"
				className={ `vgtpk-nav__item${ isActive ? ' is-active' : '' }` }
				style={ { '--depth': depth } }
				aria-current={ isActive ? 'page' : undefined }
				onClick={ () => onSelect( item.id ) }
				data-vgtpk-item={ item.id }
			>
				<BlockIcon item={ item } />
				<span className="vgtpk-nav__label">{ item.title }</span>
			</button>
			{ item.children?.length > 0 && (
				<ul className="vgtpk-nav__children">
					{ item.children.map( ( child ) => (
						<NavItem
							key={ child.id }
							item={ child }
							selected={ selected }
							onSelect={ onSelect }
							depth={ depth + 1 }
						/>
					) ) }
				</ul>
			) }
		</li>
	);
}

export default function Sidebar( {
	data,
	state,
	query,
	setQuery,
	collapsed,
	toggleCategory,
	onSelectItem,
	onSelectPage,
	onHome,
	searchRef,
} ) {
	const lower = query.trim().toLowerCase();
	const flat = useMemo( () => flatten( data.nav ), [ data.nav ] );
	const results = useMemo(
		() =>
			lower ? flat.filter( ( item ) => matches( item, lower ) ) : [],
		[ flat, lower ]
	);
	const pages = useMemo(
		() =>
			data.pages.filter(
				( page ) =>
					! lower || page.title.toLowerCase().includes( lower )
			),
		[ data.pages, lower ]
	);
	const listRef = useRef();

	// Keep the active item in view when it changes from the keyboard or the URL.
	useEffect( () => {
		const active = listRef.current?.querySelector( '.is-active' );
		active?.scrollIntoView( { block: 'nearest' } );
	}, [ state.item, state.page ] );

	return (
		<nav
			className="vgtpk-sidebar"
			aria-label={ __( 'Parts Kit', 'viget-parts-kit' ) }
		>
			<header className="vgtpk-sidebar__header">
				<button
					type="button"
					className="vgtpk-brand"
					onClick={ onHome }
				>
					<span className="vgtpk-brand__site">
						{ data.site.name }
					</span>
					<span className="vgtpk-brand__name">
						{ __( 'Parts Kit', 'viget-parts-kit' ) }
					</span>
				</button>

				{ data.features.search && (
					<div className="vgtpk-search">
						<SearchIcon />
						<input
							ref={ searchRef }
							type="search"
							value={ query }
							onChange={ ( event ) =>
								setQuery( event.target.value )
							}
							onKeyDown={ ( event ) => {
								if ( event.key === 'Escape' ) {
									setQuery( '' );
								}
								if ( event.key === 'Enter' && results[ 0 ] ) {
									onSelectItem( results[ 0 ].id );
								}
							} }
							placeholder={ __(
								'Find a block',
								'viget-parts-kit'
							) }
							aria-label={ __(
								'Find a block',
								'viget-parts-kit'
							) }
						/>
						{ query ? (
							<button
								type="button"
								className="vgtpk-search__clear"
								onClick={ () => setQuery( '' ) }
								aria-label={ __(
									'Clear search',
									'viget-parts-kit'
								) }
							>
								<CloseIcon />
							</button>
						) : (
							<kbd
								className="vgtpk-search__key"
								aria-hidden="true"
							>
								/
							</kbd>
						) }
					</div>
				) }
			</header>

			<div className="vgtpk-sidebar__scroll" ref={ listRef }>
				{ lower && (
					<section className="vgtpk-nav" aria-live="polite">
						<h2 className="vgtpk-nav__heading">
							{ sprintf(
								/* translators: %d: result count. */
								_n(
									'%d match',
									'%d matches',
									results.length,
									'viget-parts-kit'
								),
								results.length
							) }
						</h2>
						<ul>
							{ results.map( ( item ) => (
								<li key={ item.id }>
									<button
										type="button"
										className={ `vgtpk-nav__item${ state.item === item.id ? ' is-active' : '' }` }
										onClick={ () =>
											onSelectItem( item.id )
										}
									>
										<BlockIcon item={ item } />
										<span className="vgtpk-nav__label">
											{ item.title }
											<span className="vgtpk-nav__context">
												{ item.parentTitle ||
													item.category.title }
											</span>
										</span>
									</button>
								</li>
							) ) }
						</ul>
						{ ! results.length && (
							<p className="vgtpk-nav__empty">
								{ __(
									'No blocks match. Try a block name like “button” or a keyword.',
									'viget-parts-kit'
								) }
							</p>
						) }
					</section>
				) }

				{ data.features.qaPages &&
					( pages.length > 0 || data.urls.newPage ) && (
						<section className="vgtpk-nav">
							<button
								type="button"
								className="vgtpk-nav__heading vgtpk-nav__toggle"
								aria-expanded={
									! collapsed.includes( '__pages' )
								}
								onClick={ () => toggleCategory( '__pages' ) }
							>
								<ChevronIcon />
								{ __( 'QA pages', 'viget-parts-kit' ) }
								<span className="vgtpk-nav__count">
									{ pages.length }
								</span>
							</button>
							{ ! collapsed.includes( '__pages' ) && (
								<ul>
									{ pages.map( ( page ) => (
										<li key={ page.id }>
											<button
												type="button"
												className={ `vgtpk-nav__item${ state.page === page.id && ! state.item ? ' is-active' : '' }` }
												onClick={ () =>
													onSelectPage( page.id )
												}
											>
												<span className="vgtpk-block-icon">
													<PageIcon />
												</span>
												<span className="vgtpk-nav__label">
													{ page.title }
													{ page.status !==
														'publish' && (
														<span className="vgtpk-nav__status">
															{ page.status }
														</span>
													) }
												</span>
											</button>
										</li>
									) ) }
									{ data.urls.newPage && ! lower && (
										<li>
											<a
												className="vgtpk-nav__item vgtpk-nav__item--add"
												href={ data.urls.newPage }
											>
												<span className="vgtpk-block-icon">
													<PlusIcon />
												</span>
												<span className="vgtpk-nav__label">
													{ __(
														'Add a QA page',
														'viget-parts-kit'
													) }
												</span>
											</a>
										</li>
									) }
								</ul>
							) }
						</section>
					) }

				{ ! lower &&
					data.nav.map( ( category ) => {
						const isOpen = ! collapsed.includes( category.slug );

						return (
							<section
								className="vgtpk-nav"
								key={ category.slug }
							>
								<button
									type="button"
									className="vgtpk-nav__heading vgtpk-nav__toggle"
									aria-expanded={ isOpen }
									onClick={ () =>
										toggleCategory( category.slug )
									}
								>
									<ChevronIcon />
									{ category.title }
									<span className="vgtpk-nav__count">
										{ category.items.length }
									</span>
								</button>
								{ isOpen && (
									<ul>
										{ category.items.map( ( item ) => (
											<NavItem
												key={ item.id }
												item={ item }
												selected={ state.item }
												onSelect={ onSelectItem }
											/>
										) ) }
									</ul>
								) }
							</section>
						);
					} ) }
			</div>

			{ data.urls.blockIndex && data.features.blockIndex && (
				<footer className="vgtpk-sidebar__footer">
					<a href={ data.urls.blockIndex }>
						<IndexIcon />
						{ __( 'Block Index', 'viget-parts-kit' ) }
					</a>
				</footer>
			) }
		</nav>
	);
}
