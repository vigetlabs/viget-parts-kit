/**
 * Turns scan records into the shapes each tab needs. Everything is computed in the browser,
 * so filters respond instantly without another request.
 */

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

export const ORIGINS = [
	{ slug: 'core', label: __( 'Core', 'viget-parts-kit' ), color: '#135C92' },
	{
		slug: 'theme',
		label: __( 'Theme', 'viget-parts-kit' ),
		color: '#E8641C',
	},
	{
		slug: 'plugin',
		label: __( 'Plugins', 'viget-parts-kit' ),
		color: '#8C6BB1',
	},
];

export const MISSING_COLOR = '#C2185B';

/**
 * Which group a block comes from.
 *
 * @param {string}        name  Block name.
 * @param {Array<string>} theme Theme namespaces.
 * @return {string} Origin slug.
 */
export function originOf( name, theme = [] ) {
	const namespace = name.split( '/' )[ 0 ];

	if ( namespace === 'core' ) {
		return 'core';
	}

	return theme.includes( namespace ) ? 'theme' : 'plugin';
}

export const originColor = ( slug ) =>
	ORIGINS.find( ( origin ) => origin.slug === slug )?.color || '#757575';

/**
 * Filter records by the global filters.
 *
 * @param {Array}  records Records.
 * @param {Object} filters Filters.
 * @return {Array} Records.
 */
export function filterRecords( records, filters ) {
	return records.filter(
		( record ) =>
			( filters.type === 'all' || record.type === filters.type ) &&
			( filters.status === 'all' || record.status === filters.status ) &&
			( filters.templates || record.source !== 'template' )
	);
}

/**
 * Aggregate block usage across records.
 *
 * @param {Object} raw     REST payload.
 * @param {Array}  records Filtered records.
 * @return {Array} Block rows.
 */
export function aggregateBlocks( raw, records ) {
	const registered = new Map(
		raw.registered.map( ( block ) => [ block.name, block ] )
	);
	const rows = new Map();

	const row = ( name ) => {
		if ( ! rows.has( name ) ) {
			const block = registered.get( name );

			rows.set( name, {
				name,
				title: block?.title || name,
				description: block?.description || '',
				category: block?.category || '',
				origin: originOf( name, raw.theme ),
				registered: !! block,
				inserter: block
					? block.inserter && ! block.parent?.length
					: false,
				isChild: !! block?.parent?.length,
				inKit: !! block?.inKit,
				icon: block?.icon || '',
				quickAudit: block?.audit || [],
				registeredStyles: block?.styles || [],
				instances: 0,
				pages: [],
				styles: {},
				aligns: {},
			} );
		}

		return rows.get( name );
	};

	raw.registered.forEach( ( block ) => row( block.name ) );

	records.forEach( ( record ) => {
		Object.entries( record.blocks ).forEach( ( [ name, count ] ) => {
			const entry = row( name );
			entry.instances += count;
			entry.pages.push( { record, count } );
		} );

		Object.entries( record.styles || {} ).forEach( ( [ key, count ] ) => {
			const [ name, style ] = key.split( '|' );
			const entry = row( name );
			entry.styles[ style ] = ( entry.styles[ style ] || 0 ) + count;
		} );

		Object.entries( record.aligns || {} ).forEach( ( [ key, count ] ) => {
			const [ name, align ] = key.split( '|' );
			const entry = row( name );
			entry.aligns[ align ] = ( entry.aligns[ align ] || 0 ) + count;
		} );
	} );

	return [ ...rows.values() ].map( ( entry ) => {
		const status = statusOf( entry );
		const list = [
			...usageFindings( { ...entry, status } ),
			...entry.quickAudit,
		].sort(
			( a, b ) => LEVELS.indexOf( a.level ) - LEVELS.indexOf( b.level )
		);

		return {
			...entry,
			status,
			findings: list,
			worst: list[ 0 ]?.level || '',
		};
	} );
}

export const LEVELS = [ 'critical', 'serious', 'warning', 'info' ];

/**
 * Audit findings that come from how a block is used, not how it's registered.
 *
 * @param {Object} entry Block row.
 * @return {Array} Findings.
 */
export function usageFindings( entry ) {
	const list = [];
	const finding = ( level, code, title, detail, fix = '' ) => ( {
		level,
		code,
		title,
		detail,
		fix,
		path: '',
	} );

	if ( entry.status === 'missing' ) {
		list.push(
			finding(
				'critical',
				'not-registered',
				__( 'Used in content but not registered', 'viget-parts-kit' ),
				__(
					'Authors see an “unsupported block” notice and the frontend may render nothing.',
					'viget-parts-kit'
				),
				__(
					'Re-register the block, or replace it on the pages listed under Usage.',
					'viget-parts-kit'
				)
			)
		);
		return list;
	}

	if ( entry.status === 'unused' && entry.inserter ) {
		list.push(
			finding(
				'info',
				'unused',
				__( 'Not used in any content', 'viget-parts-kit' ),
				__(
					'Fine before launch. After launch, it may be a candidate to remove or to show the client.',
					'viget-parts-kit'
				)
			)
		);
	}

	if (
		entry.pages.length &&
		entry.pages.every( ( { record } ) => record.status !== 'publish' )
	) {
		list.push(
			finding(
				'info',
				'drafts-only',
				__( 'Only used in unpublished content', 'viget-parts-kit' ),
				__(
					'No visitor sees this block yet, so it hasn’t been tested live.',
					'viget-parts-kit'
				)
			)
		);
	}

	const registered = entry.registeredStyles.map( ( style ) => style.name );

	Object.keys( entry.styles )
		.filter( ( style ) => ! registered.includes( style ) )
		.forEach( ( style ) =>
			list.push(
				finding(
					'warning',
					'style-unregistered',
					sprintf(
						/* translators: %s: style class. */
						__(
							'Content uses is-style-%s, which isn’t registered',
							'viget-parts-kit'
						),
						style
					),
					__(
						'The theme may still style it, but authors can’t pick it again from the Styles panel.',
						'viget-parts-kit'
					),
					__(
						'Register the style, or switch those blocks to a registered one.',
						'viget-parts-kit'
					)
				)
			)
		);

	const unusedStyles = entry.registeredStyles.filter(
		( style ) => ! style.isDefault && ! entry.styles[ style.name ]
	);

	if ( entry.instances && unusedStyles.length ) {
		list.push(
			finding(
				'info',
				'style-unused',
				sprintf(
					/* translators: %s: list of style labels. */
					__( 'Styles never used: %s', 'viget-parts-kit' ),
					unusedStyles
						.map( ( style ) => style.label || style.name )
						.join( ', ' )
				),
				__(
					'Worth checking they still look right, or whether they’re needed.',
					'viget-parts-kit'
				)
			)
		);
	}

	return list;
}

/**
 * Usage status for a block row.
 *
 * @param {Object} entry Block row.
 * @return {string} Status slug.
 */
function statusOf( entry ) {
	if ( ! entry.registered ) {
		return 'missing';
	}

	return entry.instances ? 'used' : 'unused';
}

export const STATUS_LABELS = {
	used: __( 'In use', 'viget-parts-kit' ),
	unused: __( 'Unused', 'viget-parts-kit' ),
	missing: __( 'Not registered', 'viget-parts-kit' ),
};

/**
 * Findings for the Health tab.
 *
 * @param {Array} blocks  Block rows.
 * @param {Array} records Filtered records.
 * @param {Array} all     All records, for pattern references.
 * @return {Array} Findings.
 */
export function findings( blocks, records, all ) {
	const list = [];

	const missing = blocks.filter( ( block ) => block.status === 'missing' );
	if ( missing.length ) {
		list.push( {
			key: 'missing',
			level: 'critical',
			title: __(
				'Blocks used in content but no longer registered',
				'viget-parts-kit'
			),
			detail: __(
				'These show as “unsupported block” in the editor and may render nothing. Re-register them, or replace them in the listed pages.',
				'viget-parts-kit'
			),
			blocks: missing,
		} );
	}

	const unregisteredStyles = [];
	blocks.forEach( ( block ) => {
		const known = block.registeredStyles.map( ( style ) => style.name );
		Object.entries( block.styles ).forEach( ( [ style, count ] ) => {
			if ( ! known.includes( style ) ) {
				unregisteredStyles.push( { block, style, count } );
			}
		} );
	} );
	if ( unregisteredStyles.length ) {
		list.push( {
			key: 'styles',
			level: 'serious',
			title: __(
				'Style classes with no registered style',
				'viget-parts-kit'
			),
			detail: __(
				'Content carries an is-style-* class the editor no longer offers. The theme may still style it, but authors can’t pick it again.',
				'viget-parts-kit'
			),
			styles: unregisteredStyles,
		} );
	}

	const classic = records.filter( ( record ) => record.classic );
	if ( classic.length ) {
		list.push( {
			key: 'classic',
			level: 'warning',
			title: __( 'Content with no blocks', 'viget-parts-kit' ),
			detail: __(
				'Classic-editor content renders through the Classic block. Convert it to blocks to get theme styles and block features.',
				'viget-parts-kit'
			),
			records: classic,
		} );
	}

	const heavy = records.filter(
		( record ) => record.total > 200 || record.depth > 8
	);
	if ( heavy.length ) {
		list.push( {
			key: 'heavy',
			level: 'warning',
			title: __( 'Very large or deeply nested pages', 'viget-parts-kit' ),
			detail: __(
				'More than 200 blocks or more than 8 levels deep. These get slow to edit and are easy to break.',
				'viget-parts-kit'
			),
			records: heavy,
		} );
	}

	const html = blocks.find(
		( block ) => block.name === 'core/html' && block.instances
	);
	if ( html ) {
		list.push( {
			key: 'html',
			level: 'info',
			title: __( 'Custom HTML blocks', 'viget-parts-kit' ),
			detail: __(
				'Raw HTML skips theme styles and accessibility checks. Worth reviewing whether a real block fits.',
				'viget-parts-kit'
			),
			blocks: [ html ],
		} );
	}

	const unusedTheme = blocks.filter(
		( block ) =>
			block.origin === 'theme' &&
			block.status === 'unused' &&
			! block.isChild
	);
	if ( unusedTheme.length ) {
		list.push( {
			key: 'unused-theme',
			level: 'info',
			title: __( 'Theme blocks nobody has used yet', 'viget-parts-kit' ),
			detail: __(
				'Built for this site but not in any content. Fine before launch; after launch, they may be candidates to remove.',
				'viget-parts-kit'
			),
			blocks: unusedTheme,
		} );
	}

	const refs = new Set( all.flatMap( ( record ) => record.refs || [] ) );
	const orphanPatterns = all.filter(
		( record ) => record.type === 'wp_block' && ! refs.has( record.id )
	);
	if ( orphanPatterns.length ) {
		list.push( {
			key: 'patterns',
			level: 'info',
			title: __(
				'Synced patterns not placed anywhere',
				'viget-parts-kit'
			),
			detail: __(
				'These synced patterns exist but no content references them.',
				'viget-parts-kit'
			),
			records: orphanPatterns,
		} );
	}

	return list;
}

/**
 * Squarified treemap layout.
 *
 * @param {Array}  items  Items with a `value`.
 * @param {number} width  Box width.
 * @param {number} height Box height.
 * @return {Array} Items with x, y, w, h.
 */
export function treemap( items, width, height ) {
	const total = items.reduce( ( sum, item ) => sum + item.value, 0 );

	if ( ! total || ! width || ! height ) {
		return [];
	}

	const scale = ( width * height ) / total;
	const nodes = items.map( ( item ) => ( {
		...item,
		area: item.value * scale,
	} ) );
	const out = [];
	let x = 0;
	let y = 0;
	let w = width;
	let h = height;
	let row = [];

	const worst = ( list, side ) => {
		const sum = list.reduce( ( s, n ) => s + n.area, 0 );
		const max = Math.max( ...list.map( ( n ) => n.area ) );
		const min = Math.min( ...list.map( ( n ) => n.area ) );
		return Math.max(
			( side * side * max ) / ( sum * sum ),
			( sum * sum ) / ( side * side * min )
		);
	};

	const layoutRow = ( list ) => {
		const sum = list.reduce( ( s, n ) => s + n.area, 0 );

		if ( w >= h ) {
			const rowWidth = sum / h;
			let offset = y;
			list.forEach( ( n ) => {
				const nh = n.area / rowWidth;
				out.push( { ...n, x, y: offset, w: rowWidth, h: nh } );
				offset += nh;
			} );
			x += rowWidth;
			w -= rowWidth;
		} else {
			const rowHeight = sum / w;
			let offset = x;
			list.forEach( ( n ) => {
				const nw = n.area / rowHeight;
				out.push( { ...n, x: offset, y, w: nw, h: rowHeight } );
				offset += nw;
			} );
			y += rowHeight;
			h -= rowHeight;
		}
	};

	nodes.forEach( ( node ) => {
		const side = Math.min( w, h );

		if (
			! row.length ||
			worst( [ ...row, node ], side ) <= worst( row, side )
		) {
			row.push( node );
		} else {
			layoutRow( row );
			row = [ node ];
		}
	} );

	if ( row.length ) {
		layoutRow( row );
	}

	return out;
}

/**
 * Download rows as CSV.
 *
 * @param {string} filename File name.
 * @param {Array}  rows     Rows, first is the header.
 */
export function downloadCsv( filename, rows ) {
	const csv = rows
		.map( ( row ) =>
			row
				.map( ( cell ) => {
					const value = String( cell ?? '' );
					return /[",\n]/.test( value )
						? `"${ value.replace( /"/g, '""' ) }"`
						: value;
				} )
				.join( ',' )
		)
		.join( '\n' );

	const link = document.createElement( 'a' );
	link.href = URL.createObjectURL(
		new window.Blob( [ csv ], { type: 'text/csv' } )
	);
	link.download = filename;
	link.click();
	setTimeout( () => URL.revokeObjectURL( link.href ), 1000 );
}

/**
 * Format a number with grouping.
 *
 * @param {number} value Number.
 * @return {string} Formatted.
 */
export const num = ( value ) => new Intl.NumberFormat().format( value || 0 );
