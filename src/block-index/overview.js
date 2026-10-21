/**
 * Overview tab.
 */

/**
 * WordPress dependencies
 */
import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { MISSING_COLOR, num, originColor, treemap } from './data';
import { OriginLegend, Ribbon, useTooltip } from './common';

const TREEMAP_LIMIT = 36;

function Stat( { value, label, tone, onClick } ) {
	const Tag = onClick ? 'button' : 'div';

	return (
		<Tag
			type={ onClick ? 'button' : undefined }
			className={ `vgtpk-stat${ tone ? ` vgtpk-stat--${ tone }` : '' }` }
			onClick={ onClick }
		>
			<span className="vgtpk-stat__value">{ value }</span>
			<span className="vgtpk-stat__label">{ label }</span>
		</Tag>
	);
}

// Treemap of block instances, colored by origin.
function Treemap( { blocks, onSelect } ) {
	const ref = useRef();
	const [ size, setSize ] = useState( { width: 0, height: 420 } );
	const [ tip, show, hide ] = useTooltip();

	useEffect( () => {
		const node = ref.current;
		if ( ! node || ! window.ResizeObserver ) {
			return;
		}
		const observer = new window.ResizeObserver( ( [ entry ] ) =>
			setSize( {
				width: entry.contentRect.width,
				height: Math.max(
					300,
					Math.min( 480, entry.contentRect.width * 0.5 )
				),
			} )
		);
		observer.observe( node );
		return () => observer.disconnect();
	}, [] );

	const items = useMemo( () => {
		const used = blocks
			.filter( ( block ) => block.instances )
			.sort( ( a, b ) => b.instances - a.instances );
		const top = used
			.slice( 0, TREEMAP_LIMIT )
			.map( ( block ) => ( { ...block, value: block.instances } ) );
		const rest = used.slice( TREEMAP_LIMIT );

		if ( rest.length ) {
			top.push( {
				name: '__other',
				title: sprintf(
					/* translators: %d: number of blocks folded together. */
					_n(
						'%d other block',
						'%d other blocks',
						rest.length,
						'viget-parts-kit'
					),
					rest.length
				),
				value: rest.reduce(
					( sum, block ) => sum + block.instances,
					0
				),
				instances: rest.reduce(
					( sum, block ) => sum + block.instances,
					0
				),
				pages: [],
				other: true,
			} );
		}

		return top;
	}, [ blocks ] );

	const tiles = treemap( items, size.width, size.height );
	const total = items.reduce( ( sum, item ) => sum + item.value, 0 );

	if ( ! items.length ) {
		return (
			<p className="vgtpk-muted">
				{ __( 'No blocks match these filters.', 'viget-parts-kit' ) }
			</p>
		);
	}

	return (
		<div
			className="vgtpk-treemap"
			ref={ ref }
			style={ { height: size.height } }
		>
			<svg
				width={ size.width }
				height={ size.height }
				role="img"
				aria-label={ __(
					'Block usage, sized by number of instances',
					'viget-parts-kit'
				) }
			>
				{ tiles.map( ( tile ) => {
					let color = originColor( tile.origin );
					if ( tile.other ) {
						color = '#9AA5AD';
					} else if ( tile.status === 'missing' ) {
						color = MISSING_COLOR;
					}
					const fitsLabel = tile.w > 70 && tile.h > 34;
					const fitsCount = tile.w > 40 && tile.h > 52;
					const share =
						Math.round( ( tile.value / total ) * 1000 ) / 10;

					return (
						<g
							key={ tile.name }
							className={ `vgtpk-treemap__tile${ tile.other ? '' : ' is-interactive' }` }
							transform={ `translate(${ tile.x },${ tile.y })` }
							tabIndex={ tile.other ? -1 : 0 }
							role={ tile.other ? undefined : 'button' }
							aria-label={ sprintf(
								/* translators: 1: block title, 2: instance count. */
								__( '%1$s, %2$s instances', 'viget-parts-kit' ),
								tile.title,
								num( tile.value )
							) }
							onClick={
								tile.other
									? undefined
									: () => onSelect( tile.name )
							}
							onKeyDown={ ( event ) => {
								if (
									! tile.other &&
									( event.key === 'Enter' ||
										event.key === ' ' )
								) {
									event.preventDefault();
									onSelect( tile.name );
								}
							} }
							onMouseMove={ ( event ) =>
								show(
									event,
									<>
										<strong>{ tile.title }</strong>
										{ ! tile.other && (
											<code>{ tile.name }</code>
										) }
										<span>
											{ sprintf(
												/* translators: 1: instance count, 2: percent share. */
												__(
													'%1$s instances, %2$s%% of the total',
													'viget-parts-kit'
												),
												num( tile.value ),
												share
											) }
										</span>
										{ ! tile.other && (
											<span>
												{ sprintf(
													/* translators: %s: page count. */
													_n(
														'On %s page',
														'On %s pages',
														tile.pages.length,
														'viget-parts-kit'
													),
													num( tile.pages.length )
												) }
											</span>
										) }
									</>
								)
							}
							onMouseLeave={ hide }
						>
							<rect
								x={ 1 }
								y={ 1 }
								width={ Math.max( 0, tile.w - 2 ) }
								height={ Math.max( 0, tile.h - 2 ) }
								rx={ 3 }
								fill={ color }
							/>
							{ fitsLabel && (
								<text
									x={ 10 }
									y={ 22 }
									className="vgtpk-treemap__label"
								>
									{ tile.title.length > tile.w / 7.5
										? `${ tile.title.slice( 0, Math.floor( tile.w / 7.5 ) - 1 ) }…`
										: tile.title }
								</text>
							) }
							{ fitsCount && (
								<text
									x={ 10 }
									y={ 40 }
									className="vgtpk-treemap__count"
								>
									{ num( tile.value ) }
								</text>
							) }
						</g>
					);
				} ) }
			</svg>
			{ tip }
		</div>
	);
}

// Horizontal bars: instances per content type. One series, so no legend.
function TypeBars( { records, postTypes } ) {
	const [ tip, show, hide ] = useTooltip();
	const rows = useMemo( () => {
		const map = {};
		records.forEach( ( record ) => {
			map[ record.type ] = map[ record.type ] || {
				type: record.type,
				instances: 0,
				pages: 0,
			};
			map[ record.type ].instances += record.total;
			map[ record.type ].pages += 1;
		} );
		return Object.values( map ).sort(
			( a, b ) => b.instances - a.instances
		);
	}, [ records ] );
	const max = Math.max( 1, ...rows.map( ( row ) => row.instances ) );

	return (
		<ul className="vgtpk-bars">
			{ rows.map( ( row ) => (
				<li
					key={ row.type }
					onMouseMove={ ( event ) =>
						show(
							event,
							<>
								<strong>
									{ postTypes[ row.type ] || row.type }
								</strong>
								<span>
									{ sprintf(
										/* translators: 1: instance count, 2: item count. */
										__(
											'%1$s blocks across %2$s items',
											'viget-parts-kit'
										),
										num( row.instances ),
										num( row.pages )
									) }
								</span>
							</>
						)
					}
					onMouseLeave={ hide }
				>
					<span className="vgtpk-bars__label">
						{ postTypes[ row.type ] || row.type }
					</span>
					<span className="vgtpk-bars__track">
						<span
							className="vgtpk-bars__fill"
							style={ {
								width: `${ ( row.instances / max ) * 100 }%`,
							} }
						/>
					</span>
					<span className="vgtpk-bars__value">
						{ num( row.instances ) }
					</span>
				</li>
			) ) }
			{ tip }
		</ul>
	);
}

export default function Overview( {
	raw,
	blocks,
	records,
	registeredSet,
	issues,
	goTo,
} ) {
	const used = blocks.filter( ( block ) => block.status === 'used' ).length;
	const registered = blocks.filter( ( block ) => block.registered ).length;
	const unused = blocks.filter(
		( block ) => block.status === 'unused' && block.inserter
	).length;
	const missing = blocks.filter(
		( block ) => block.status === 'missing'
	).length;
	const instances = records.reduce(
		( sum, record ) => sum + record.total,
		0
	);
	const [ tip, show, hide ] = useTooltip();

	const complex = useMemo(
		() =>
			[ ...records ].sort( ( a, b ) => b.total - a.total ).slice( 0, 6 ),
		[ records ]
	);

	return (
		<div className="vgtpk-overview">
			<div className="vgtpk-stats">
				<Stat
					value={ `${ num( used ) } / ${ num( registered ) }` }
					label={ __(
						'registered blocks in use',
						'viget-parts-kit'
					) }
					onClick={ () => goTo( 'blocks', { status: 'used' } ) }
				/>
				<Stat
					value={ num( instances ) }
					label={ __( 'block instances', 'viget-parts-kit' ) }
				/>
				<Stat
					value={ num( records.length ) }
					label={ __(
						'pages, posts and templates scanned',
						'viget-parts-kit'
					) }
					onClick={ () => goTo( 'content' ) }
				/>
				<Stat
					value={ num( unused ) }
					label={ __(
						'insertable blocks never used',
						'viget-parts-kit'
					) }
					onClick={ () => goTo( 'blocks', { status: 'unused' } ) }
				/>
				<Stat
					value={ num( missing ) }
					label={ __( 'used but not registered', 'viget-parts-kit' ) }
					tone={ missing ? 'critical' : 'quiet' }
					onClick={
						missing
							? () => goTo( 'blocks', { status: 'missing' } )
							: undefined
					}
				/>
				<Stat
					value={ num( issues ) }
					label={ __( 'things worth a look', 'viget-parts-kit' ) }
					tone={ issues ? 'attention' : 'quiet' }
					onClick={ () => goTo( 'health' ) }
				/>
			</div>

			<section className="vgtpk-panel">
				<header className="vgtpk-panel__header">
					<div>
						<h2>
							{ __(
								'What the site is built from',
								'viget-parts-kit'
							) }
						</h2>
						<p>
							{ __(
								'Each tile is a block, sized by how many times it appears. Select one to see where.',
								'viget-parts-kit'
							) }
						</p>
					</div>
					<OriginLegend missing={ missing > 0 } />
				</header>
				<Treemap
					blocks={ blocks }
					onSelect={ ( name ) => goTo( 'blocks', { expand: name } ) }
				/>
			</section>

			<div className="vgtpk-overview__split">
				<section className="vgtpk-panel">
					<header className="vgtpk-panel__header">
						<div>
							<h2>
								{ __(
									'Blocks by content type',
									'viget-parts-kit'
								) }
							</h2>
						</div>
					</header>
					<TypeBars records={ records } postTypes={ raw.postTypes } />
				</section>

				<section className="vgtpk-panel">
					<header className="vgtpk-panel__header">
						<div>
							<h2>
								{ __( 'Largest pages', 'viget-parts-kit' ) }
							</h2>
							<p>
								{ __(
									'Top-level blocks in order. Hover a segment to name it.',
									'viget-parts-kit'
								) }
							</p>
						</div>
					</header>
					<ol className="vgtpk-complex">
						{ complex.map( ( record ) => (
							<li key={ record.key }>
								<div className="vgtpk-complex__meta">
									<a
										href={
											record.edit ||
											record.url ||
											undefined
										}
									>
										{ record.title ||
											__(
												'(no title)',
												'viget-parts-kit'
											) }
									</a>
									<span>
										{ sprintf(
											/* translators: 1: block count, 2: nesting depth. */
											__(
												'%1$s blocks, %2$s deep',
												'viget-parts-kit'
											),
											num( record.total ),
											record.depth
										) }
									</span>
								</div>
								<Ribbon
									record={ record }
									theme={ raw.theme }
									registered={ registeredSet }
									onHover={ ( event, name, index ) =>
										show(
											event,
											<>
												<strong>
													{ blocks.find(
														( block ) =>
															block.name === name
													)?.title || name }
												</strong>
												<code>{ name }</code>
												<span>
													{ sprintf(
														/* translators: %d: position. */
														__(
															'Block %d on the page',
															'viget-parts-kit'
														),
														index + 1
													) }
												</span>
											</>
										)
									}
									onLeave={ hide }
								/>
							</li>
						) ) }
					</ol>
					{ tip }
				</section>
			</div>
		</div>
	);
}
