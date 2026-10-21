/**
 * Shared Block Index pieces.
 */

/**
 * WordPress dependencies
 */
import { useState, useCallback } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import {
	MISSING_COLOR,
	ORIGINS,
	STATUS_LABELS,
	originColor,
	originOf,
} from './data';

/**
 * A floating tooltip that follows the pointer. One per chart.
 *
 * @return {Array} [ tooltip element, show(event, content), hide() ].
 */
export function useTooltip() {
	const [ tip, setTip ] = useState( null );

	const show = useCallback( ( event, content ) => {
		const rect = event.currentTarget.getBoundingClientRect();
		const x = event.clientX ?? rect.left + rect.width / 2;
		const y = event.clientY ?? rect.top;
		setTip( { x, y, content } );
	}, [] );

	const hide = useCallback( () => setTip( null ), [] );

	const element = tip ? (
		<div
			className="vgtpk-tip"
			role="tooltip"
			style={ {
				left: Math.min( tip.x + 14, window.innerWidth - 260 ),
				top: tip.y + 14,
			} }
		>
			{ tip.content }
		</div>
	) : null;

	return [ element, show, hide ];
}

// Origin legend. Always shown beside origin-colored charts.
export function OriginLegend( { missing = false } ) {
	return (
		<ul
			className="vgtpk-legend"
			aria-label={ __( 'Block origin', 'viget-parts-kit' ) }
		>
			{ ORIGINS.map( ( origin ) => (
				<li key={ origin.slug }>
					<span
						className="vgtpk-legend__swatch"
						style={ { background: origin.color } }
					/>
					{ origin.label }
				</li>
			) ) }
			{ missing && (
				<li>
					<span
						className="vgtpk-legend__swatch vgtpk-legend__swatch--missing"
						style={ { background: MISSING_COLOR } }
					/>
					{ STATUS_LABELS.missing }
				</li>
			) }
		</ul>
	);
}

// Status pill. Never color alone: always a glyph and a word.
export function StatusPill( { status } ) {
	const glyph = { used: '●', unused: '○', missing: '!' }[ status ];

	return (
		<span className={ `vgtpk-pill vgtpk-pill--${ status }` }>
			<span aria-hidden="true">{ glyph }</span>
			{ STATUS_LABELS[ status ] }
		</span>
	);
}

// The block ribbon: a post's top-level blocks in document order, one segment each, colored by origin. Reads as a fingerprint of how a page is put together.
export function Ribbon( {
	record,
	theme,
	registered,
	onHover,
	onLeave,
	highlight,
} ) {
	const seq = record.seq || [];

	if ( ! seq.length ) {
		return (
			<span className="vgtpk-ribbon vgtpk-ribbon--empty">
				{ record.classic
					? __( 'Classic content', 'viget-parts-kit' )
					: __( 'Empty', 'viget-parts-kit' ) }
			</span>
		);
	}

	return (
		<span
			className="vgtpk-ribbon"
			role="img"
			aria-label={ sprintf(
				/* translators: 1: number of top-level blocks, 2: list of blocks. */
				__( '%1$d top-level blocks: %2$s', 'viget-parts-kit' ),
				seq.length,
				seq.slice( 0, 12 ).join( ', ' )
			) }
		>
			{ seq.map( ( name, index ) => {
				const missing = registered && ! registered.has( name );
				const color = missing
					? MISSING_COLOR
					: originColor( originOf( name, theme ) );
				const dim = highlight && highlight !== name;

				return (
					<span
						key={ index }
						className={ `vgtpk-ribbon__segment${ missing ? ' is-missing' : '' }` }
						style={ { background: color, opacity: dim ? 0.18 : 1 } }
						onMouseEnter={
							onHover
								? ( event ) => onHover( event, name, index )
								: undefined
						}
						onMouseLeave={ onLeave }
					/>
				);
			} ) }
		</span>
	);
}

// A sortable column header.
export function SortHeader( {
	label,
	column,
	sort,
	setSort,
	numeric = false,
} ) {
	const active = sort.column === column;
	const next = active && sort.direction === 'desc' ? 'asc' : 'desc';
	const defaultDirection = numeric ? 'desc' : 'asc';
	const arrow = sort.direction === 'asc' ? '↑' : '↓';

	return (
		<th
			scope="col"
			className={ numeric ? 'is-numeric' : '' }
			aria-sort={ active ? `${ sort.direction }ending` : 'none' }
		>
			<button
				type="button"
				onClick={ () =>
					setSort( {
						column,
						direction: active ? next : defaultDirection,
					} )
				}
			>
				{ label }
				<span className="vgtpk-sort" aria-hidden="true">
					{ active ? arrow : '' }
				</span>
			</button>
		</th>
	);
}

/**
 * Sort rows by a column.
 *
 * @param {Array}    rows   Rows.
 * @param {Object}   sort   `{ column, direction }`.
 * @param {Function} getter Column value getter.
 * @return {Array} Sorted rows.
 */
export function sortRows( rows, sort, getter ) {
	const dir = sort.direction === 'asc' ? 1 : -1;

	return [ ...rows ].sort( ( a, b ) => {
		const av = getter( a, sort.column );
		const bv = getter( b, sort.column );

		if ( typeof av === 'number' && typeof bv === 'number' ) {
			return ( av - bv ) * dir;
		}

		return String( av ).localeCompare( String( bv ) ) * dir;
	} );
}

// Edit and view links for a record.
export function RecordLinks( { record } ) {
	return (
		<span className="vgtpk-record-links">
			{ record.edit && (
				<a href={ record.edit }>
					{ __( 'Edit', 'viget-parts-kit' ) }
					<span className="screen-reader-text">
						{ ' ' }
						{ record.title }
					</span>
				</a>
			) }
			{ record.url && (
				<a href={ record.url } target="_blank" rel="noreferrer">
					{ __( 'View', 'viget-parts-kit' ) }
					<span className="screen-reader-text">
						{ ' ' }
						{ record.title }
					</span>
				</a>
			) }
		</span>
	);
}

// Inline magnitude bar for table cells.
export function InlineBar( { value, max, color = '#135C92' } ) {
	return (
		<span className="vgtpk-inline-bar" aria-hidden="true">
			<span
				style={ {
					width: max
						? `${ Math.max( 2, ( value / max ) * 100 ) }%`
						: 0,
					background: color,
				} }
			/>
		</span>
	);
}

export const LEVEL_LABELS = {
	critical: { glyph: '!', label: __( 'Fix', 'viget-parts-kit' ) },
	serious: { glyph: '▲', label: __( 'Review', 'viget-parts-kit' ) },
	warning: { glyph: '◆', label: __( 'Consider', 'viget-parts-kit' ) },
	info: { glyph: 'i', label: __( 'Note', 'viget-parts-kit' ) },
};

// Severity pill: always a glyph and a word, never color alone.
export function LevelPill( { level, count } ) {
	const meta = LEVEL_LABELS[ level ];

	if ( ! meta ) {
		return null;
	}

	return (
		<span className={ `vgtpk-level vgtpk-level--${ level }` }>
			<span aria-hidden="true">{ meta.glyph }</span>
			{ meta.label }
			{ count > 1 && (
				<span className="vgtpk-level__count">{ count }</span>
			) }
		</span>
	);
}

// Block icon: an SVG from the catalog, a Dashicon, or the title's first letter.
export function BlockIcon( { icon, title } ) {
	if ( icon?.startsWith( 'dashicon:' ) ) {
		return (
			<span
				className={ `vgtpk-icon dashicons dashicons-${ icon.slice( 9 ) }` }
				aria-hidden="true"
			/>
		);
	}

	if ( icon ) {
		// Sanitized to an SVG allowlist on the server.
		return (
			<span
				className="vgtpk-icon"
				aria-hidden="true"
				dangerouslySetInnerHTML={ { __html: icon } }
			/>
		);
	}

	return (
		<span className="vgtpk-icon vgtpk-icon--letter" aria-hidden="true">
			{ ( title || '?' ).charAt( 0 ) }
		</span>
	);
}
