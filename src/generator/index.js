/**
 * Catalog generator. Runs inside the block editor (post-new.php?post_type=vgtpk_part&vgtpk_generate=1),
 * builds sample blocks for every inserter item, serializes them and uploads the result.
 */

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import {
	cloneBlock,
	createBlock,
	createBlocksFromInnerBlocksTemplate,
	getBlockType,
	getBlockTypes,
	hasBlockSupport,
	parse,
	serialize,
	store as blocksStore,
} from '@wordpress/blocks';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { select } from '@wordpress/data';
import domReady from '@wordpress/dom-ready';
import { createElement, renderToString } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { Icon } from '@wordpress/components';
import { applyFilters } from '@wordpress/hooks';

/**
 * Internal dependencies
 */
import { EMBEDS, SAMPLES, floatFiller, phrase, sentence } from './samples';
import './style.scss';

const config = window.vgtpkGenerator || {};
const BATCH_SIZE = 15;
const MAX_DEPTH = 6;

/**
 * Wait until the inserter's item count stops changing, so late registrations (ACF) are in.
 *
 * @return {Promise<void>} Resolves when stable.
 */
function waitForBlocks() {
	return new Promise( ( resolve ) => {
		let last = -1;
		let stableFor = 0;
		const started = Date.now();

		const check = () => {
			const count = select( blockEditorStore ).getInserterItems().length;

			stableFor = count > 0 && count === last ? stableFor + 1 : 0;
			last = count;

			if ( stableFor >= 3 || Date.now() - started > 15000 ) {
				resolve();
				return;
			}

			setTimeout( check, 400 );
		};

		setTimeout( check, 800 );
	} );
}

/**
 * Whether a block name is registered.
 *
 * @param {string} name Block name.
 * @return {boolean} Registered.
 */
const isRegistered = ( name ) => !! getBlockType( name );

/**
 * Create blocks from a template, skipping unregistered names.
 *
 * @param {Array} template Template entries.
 * @return {Array} Blocks.
 */
function fromTemplate( template = [] ) {
	const safe = ( entries ) =>
		( entries || [] )
			.filter(
				( entry ) =>
					Array.isArray( entry ) && isRegistered( entry[ 0 ] )
			)
			.map( ( [ name, attributes = {}, inner = [] ] ) => [
				name,
				attributes,
				safe( inner ),
			] );

	return createBlocksFromInnerBlocksTemplate( safe( template ) );
}

/**
 * Create blocks from a block type `example`.
 *
 * @param {Array} entries Example inner blocks.
 * @return {Array} Blocks.
 */
function fromExample( entries = [] ) {
	return entries
		.filter( ( entry ) => isRegistered( entry.name ) )
		.map( ( entry ) =>
			createBlock(
				entry.name,
				entry.attributes || {},
				fromExample( entry.innerBlocks )
			)
		);
}

/**
 * Whether an attribute holds author-facing rich text.
 *
 * @param {Object} definition Attribute definition.
 * @return {boolean} Rich text.
 */
const isRichText = ( definition ) =>
	definition?.type === 'rich-text' ||
	definition?.source === 'html' ||
	definition?.source === 'rich-text';

/**
 * Whether a value is empty, including RichTextData.
 *
 * @param {*} value Value.
 * @return {boolean} Empty.
 */
const isEmpty = ( value ) =>
	value === undefined ||
	value === null ||
	( typeof value === 'string' && value.trim() === '' ) ||
	( typeof value === 'object' &&
		typeof value.toString === 'function' &&
		value.toString().trim() === '' &&
		! Array.isArray( value ) );

/**
 * Fill empty content so every block shows something, and expand server-side templates.
 *
 * @param {Object} block Block.
 * @param {Object} ctx   Sample context.
 * @param {number} depth Recursion depth.
 * @return {Object} Block.
 */
function fill( block, ctx, depth = 0 ) {
	const type = getBlockType( block.name );

	if ( ! type || depth > MAX_DEPTH ) {
		return block;
	}

	const attributes = { ...block.attributes };
	const placeholderText = attributes.placeholder;

	Object.entries( type.attributes || {} ).forEach(
		( [ key, definition ] ) => {
			if (
				! isRichText( definition ) ||
				! isEmpty( attributes[ key ] )
			) {
				return;
			}

			if ( key === 'citation' ) {
				return;
			}

			attributes[ key ] =
				placeholderText ||
				( key === 'content' && block.name.includes( 'paragraph' )
					? sentence( { ...ctx, title: type.title } )
					: phrase( { ...ctx, title: type.title } ) );
		}
	);

	if ( block.name === 'core/button' && ! attributes.url ) {
		attributes.url = '#';
	}

	if ( block.name === 'core/image' && ! attributes.url ) {
		attributes.url = SAMPLES[ 'core/image' ]( ctx ).attributes.url;
	}

	if (
		block.name.startsWith( 'acf/' ) &&
		config.acf?.[ block.name ] &&
		( ! attributes.data || ! Object.keys( attributes.data ).length )
	) {
		attributes.data = config.acf[ block.name ];
	}

	let innerBlocks = block.innerBlocks;

	if ( ! innerBlocks.length && config.templates?.[ block.name ] ) {
		innerBlocks = fromTemplate( config.templates[ block.name ] );
	}

	if ( ! innerBlocks.length && SAMPLES[ block.name ] && depth > 0 ) {
		innerBlocks = fromTemplate(
			SAMPLES[ block.name ]( { ...ctx, title: type.title, attributes } )
				.innerBlocks
		);
	}

	return {
		...block,
		attributes,
		innerBlocks: innerBlocks.map( ( inner ) =>
			fill( inner, ctx, depth + 1 )
		),
	};
}

/**
 * Variation name for an inserter item, e.g. `group-row` for `core/group/group-row`.
 *
 * @param {Object} item Inserter item.
 * @return {string} Variation name, or empty for the base block.
 */
const variationName = ( item ) =>
	item.id && item.id !== item.name
		? item.id.slice( item.name.length + 1 )
		: '';

/**
 * Configuration for an item: `vgtpk_block_config` from PHP, its variation's overrides,
 * then the `vgtpk.blockConfig` JS filter.
 *
 * @param {Object} item Inserter item.
 * @return {Object} Config.
 */
function getConfig( item ) {
	const block = config.blockConfig?.[ item.name ] || {};
	const variation = block.variations?.[ variationName( item ) ] || {};
	const merged = {
		...block,
		...variation,
		axes: {
			...( config.axes || {} ),
			...( block.axes || {} ),
			...( variation.axes || {} ),
		},
	};

	delete merged.variations;

	return applyFilters( 'vgtpk.blockConfig', merged, item );
}

/**
 * Build the base block for an inserter item.
 *
 * @param {Object} item Inserter item.
 * @param {Object} ctx  Sample context.
 * @param {Object} conf Item config.
 * @return {Object|null} Block.
 */
function buildBlock( item, ctx, conf = {} ) {
	const type = getBlockType( item.name );

	if ( ! type ) {
		return null;
	}

	const initial = item.initialAttributes || {};
	const sample = SAMPLES[ item.name ]
		? SAMPLES[ item.name ]( { ...ctx, attributes: initial } )
		: null;
	const example = type.example || {};

	let attributes = { ...( example.attributes || {} ) };
	let innerBlocks = [];

	if ( sample ) {
		attributes = { ...( sample.attributes || {} ) };
		innerBlocks = fromTemplate( sample.innerBlocks );
	} else if ( example.innerBlocks?.length ) {
		innerBlocks = fromExample( example.innerBlocks );
	}

	attributes = { ...attributes, ...initial, ...( conf.attributes || {} ) };

	// Images in core examples point at wordpress.org; keep samples on placeholders.
	if (
		typeof attributes.url === 'string' &&
		/s\.w\.org|wordpress\.org/.test( attributes.url )
	) {
		attributes.url = SAMPLES[ 'core/image' ]( ctx ).attributes.url;
	}

	if ( item.innerBlocks?.length ) {
		innerBlocks = fromTemplate( item.innerBlocks );
	}

	if ( conf.innerBlocks?.length ) {
		innerBlocks = fromTemplate( conf.innerBlocks );
	}

	return fill( createBlock( item.name, attributes, innerBlocks ), {
		...ctx,
		title: ctx.title,
	} );
}

/**
 * Add a class name without losing existing ones.
 *
 * @param {Object} block     Block.
 * @param {string} className Class to add.
 * @return {Object} Block.
 */
function withClass( block, className ) {
	const existing = ( block.attributes.className || '' )
		.split( ' ' )
		.filter( ( name ) => name && ! name.startsWith( 'is-style-' ) );

	return cloneBlock( block, {
		className: [ ...existing, className ].join( ' ' ),
	} );
}

/**
 * Alignments a block supports.
 *
 * @param {Object} type Block type.
 * @return {Array<string>} Alignments.
 */
function getAlignments( type ) {
	const support = type.supports?.align;

	if ( ! support ) {
		return [];
	}

	const editorSettings = select( blockEditorStore ).getSettings();

	let aligns =
		support === true
			? [ 'left', 'center', 'right', 'wide', 'full' ]
			: [ ...support ];

	if ( type.supports?.alignWide === false || ! editorSettings.alignWide ) {
		aligns = aligns.filter(
			( align ) => ! [ 'wide', 'full' ].includes( align )
		);
	}

	return aligns;
}

const ALIGN_LABELS = {
	left: __( 'Left', 'viget-parts-kit' ),
	center: __( 'Center', 'viget-parts-kit' ),
	right: __( 'Right', 'viget-parts-kit' ),
	wide: __( 'Wide', 'viget-parts-kit' ),
	full: __( 'Full width', 'viget-parts-kit' ),
	'space-between': __( 'Space between', 'viget-parts-kit' ),
};

/**
 * Build every sample for an inserter item.
 *
 * @param {Object} item Inserter item.
 * @return {Array<Object>} Samples with serialized markup.
 */
function buildSamples( item ) {
	const type = getBlockType( item.name );
	const conf = getConfig( item );
	const axes = conf.axes;
	const title = conf.title || item.title || type.title;
	const samples = [];

	const add = ( key, group, label, description, build ) => {
		try {
			const ctx = { title, label: group === 'default' ? '' : label };
			let blocks = build( ctx ).filter( Boolean );

			if ( blocks.length ) {
				blocks = [
					...fromTemplate( conf.before ),
					...blocks,
					...fromTemplate( conf.after ),
				];
			}

			blocks = applyFilters( 'vgtpk.sampleBlocks', blocks, {
				item,
				key,
				group,
				label,
			} );

			if ( blocks.length ) {
				samples.push( {
					key,
					group,
					label,
					description,
					markup: serialize( blocks ),
				} );
			}
		} catch ( error ) {
			// eslint-disable-next-line no-console
			console.warn(
				`[Parts Kit] Skipped ${ item.id } (${ key })`,
				error
			);
		}
	};

	const base = ( ctx ) => buildBlock( item, ctx, conf );
	const styles = select( blocksStore ).getBlockStyles( item.name ) || [];
	const defaultStyle = styles.find( ( style ) => style.isDefault );

	add(
		'default',
		'default',
		defaultStyle
			? sprintf(
					/* translators: %s: style label. */
					__( 'Default (%s)', 'viget-parts-kit' ),
					defaultStyle.label
				)
			: __( 'Default', 'viget-parts-kit' ),
		type.description || '',
		( ctx ) => [ base( ctx ) ]
	);

	styles
		.filter(
			( style ) =>
				! style.isDefault &&
				axes.styles !== false &&
				conf.styles !== false &&
				( ! Array.isArray( conf.styles ) ||
					conf.styles.includes( style.name ) )
		)
		.forEach( ( style ) => {
			const label = sprintf(
				/* translators: %s: style label. */
				__( 'Style: %s', 'viget-parts-kit' ),
				style.label || style.name
			);

			add(
				`style-${ style.name }`,
				'style',
				label,
				`is-style-${ style.name }`,
				( ctx ) => {
					const block = base( ctx );
					return [
						block && withClass( block, `is-style-${ style.name }` ),
					];
				}
			);
		} );

	if ( item.name === 'core/heading' && axes.levels !== false ) {
		[ 1, 2, 3, 4, 5, 6 ].forEach( ( level ) => {
			const label = sprintf(
				/* translators: %d: heading level. */
				__( 'Level: H%d', 'viget-parts-kit' ),
				level
			);

			add(
				`level-${ level }`,
				'level',
				label,
				`<h${ level }>`,
				( ctx ) => {
					const block = base( ctx );
					return [ block && cloneBlock( block, { level } ) ];
				}
			);
		} );
	}

	if ( item.name === 'core/list' && axes.ordered !== false ) {
		add(
			'ordered',
			'variant',
			__( 'Ordered', 'viget-parts-kit' ),
			'<ol>',
			( ctx ) => {
				const block = base( ctx );
				return [ block && cloneBlock( block, { ordered: true } ) ];
			}
		);
	}

	const defaultAlign = type.attributes?.align?.default;

	getAlignments( type )
		.filter(
			( align ) =>
				axes.align !== false &&
				( ! Array.isArray( conf.aligns ) ||
					conf.aligns.includes( align ) )
		)
		.forEach( ( align ) => {
			const label = sprintf(
				/* translators: %s: alignment. */
				__( 'Align: %s', 'viget-parts-kit' ),
				ALIGN_LABELS[ align ] || align
			);

			add(
				`align-${ align }`,
				'align',
				label,
				align === defaultAlign
					? __( 'Block default', 'viget-parts-kit' )
					: `align${ align }`,
				( ctx ) => {
					const block = base( ctx );

					if ( ! block ) {
						return [];
					}

					const aligned = cloneBlock( block, { align } );

					return [ 'left', 'right' ].includes( align )
						? [ aligned, ...fromTemplate( [ floatFiller() ] ) ]
						: [ aligned ];
				}
			);
		} );

	let textAlign = null;

	if ( type.attributes?.textAlign ) {
		textAlign = ( block, value ) =>
			cloneBlock( block, { textAlign: value } );
	} else if ( hasBlockSupport( type, 'typography.textAlign' ) ) {
		textAlign = ( block, value ) =>
			cloneBlock( block, {
				style: {
					...( block.attributes.style || {} ),
					typography: {
						...( block.attributes.style?.typography || {} ),
						textAlign: value,
					},
				},
			} );
	} else if (
		type.attributes?.align &&
		! type.supports?.align &&
		item.name === 'core/paragraph'
	) {
		textAlign = ( block, value ) => cloneBlock( block, { align: value } );
	}

	if ( textAlign && axes.textAlign !== false ) {
		[ 'left', 'center', 'right' ].forEach( ( value ) => {
			const label = sprintf(
				/* translators: %s: alignment. */
				__( 'Text align: %s', 'viget-parts-kit' ),
				ALIGN_LABELS[ value ]
			);

			add( `text-${ value }`, 'text-align', label, '', ( ctx ) => {
				const block = base( ctx );
				return [ block && textAlign( block, value ) ];
			} );
		} );
	}

	const layout = type.supports?.layout;
	const isFlex =
		( item.initialAttributes?.layout?.type || layout?.default?.type ) ===
		'flex';

	if (
		layout &&
		isFlex &&
		layout.allowJustification !== false &&
		axes.justify !== false
	) {
		[ 'left', 'center', 'right', 'space-between' ].forEach( ( value ) => {
			const label = sprintf(
				/* translators: %s: justification. */
				__( 'Justify: %s', 'viget-parts-kit' ),
				ALIGN_LABELS[ value ]
			);

			add( `justify-${ value }`, 'justify', label, '', ( ctx ) => {
				const block = base( ctx );

				return [
					block &&
						cloneBlock( block, {
							layout: {
								...( layout.default || {} ),
								...( block.attributes.layout || {} ),
								type: 'flex',
								justifyContent: value,
							},
						} ),
				];
			} );
		} );
	}

	( conf.demos || [] ).forEach( ( demo, index ) => {
		add(
			`demo-${ demo.key || index }`,
			'demo',
			demo.label || __( 'Demo', 'viget-parts-kit' ),
			demo.description || '',
			( ctx ) => {
				if ( demo.markup ) {
					return parse( demo.markup );
				}

				return [
					buildBlock( item, ctx, {
						...conf,
						attributes: {
							...( conf.attributes || {} ),
							...( demo.attributes || {} ),
						},
						innerBlocks: demo.innerBlocks || conf.innerBlocks,
					} ),
				];
			}
		);
	} );

	return applyFilters( 'vgtpk.samples', samples, item );
}

/**
 * Wrap a child block's samples in its parent.
 *
 * @param {Object} childType  Child block type.
 * @param {string} parentName Parent block name.
 * @return {Array<Object>} Samples.
 */
function buildChildSamples( childType, parentName ) {
	const parentType = getBlockType( parentName );
	const item = {
		id: childType.name,
		name: childType.name,
		title: childType.title,
	};
	const conf = getConfig( item );

	return buildSamples( item ).map( ( sample, index ) => {
		const children = parse( sample.markup );
		const repeat =
			index === 0 && ! children.some( ( b ) => b.attributes?.align )
				? ( conf.repeat ?? 3 )
				: 1;
		const parentSample = SAMPLES[ parentName ]
			? SAMPLES[ parentName ]( { title: parentType.title, label: '' } )
					.attributes || {}
			: {};
		const ctx = { title: childType.title, label: sample.label };

		let wrapped;

		if ( children.length && children[ 0 ].name === childType.name ) {
			const kids = [];
			for ( let i = 0; i < repeat; i++ ) {
				kids.push(
					...children.map( ( child ) => cloneBlock( child ) )
				);
			}
			wrapped = fill(
				createBlock( parentName, parentSample, kids ),
				ctx,
				1
			);
		}

		return wrapped
			? {
					...sample,
					description: sprintf(
						/* translators: %s: parent block title. */
						__( 'Inside %s', 'viget-parts-kit' ),
						parentType.title
					),
					markup: serialize( [ wrapped ] ),
				}
			: sample;
	} );
}

/**
 * Render a block icon to SVG markup.
 *
 * @param {Object} icon Normalized icon.
 * @return {string} Markup.
 */
function iconMarkup( icon ) {
	try {
		const src = icon?.src || icon;

		// Dashicon slugs are drawn with the Dashicons font, not as SVG.
		if ( typeof src === 'string' && ! src.trim().startsWith( '<' ) ) {
			return `dashicon:${ src.replace( /^dashicons-/, '' ) }`;
		}

		return src
			? renderToString( createElement( Icon, { icon: src, size: 24 } ) )
			: '';
	} catch {
		return '';
	}
}

/**
 * Feature list for the explorer's info panel.
 *
 * @param {Object} type Block type.
 * @return {Array<string>} Supported features.
 */
function supportsList( type ) {
	return [
		'align',
		'anchor',
		'color',
		'typography',
		'spacing',
		'border',
		'shadow',
		'dimensions',
		'layout',
		'position',
		'interactivity',
	].filter( ( feature ) => hasBlockSupport( type, feature ) );
}

/**
 * Collect every item to build: inserter items, then child-only blocks under their parents.
 *
 * @return {Array<Object>} Items.
 */
function collectItems() {
	const excluded = config.excluded || [];
	const categories = config.categories || [];
	const seen = new Set();
	const items = select( blockEditorStore )
		.getInserterItems()
		.filter(
			( item ) =>
				item.category !== 'reusable' && item.name !== 'core/block'
		)
		.filter(
			( item ) =>
				! excluded.includes( item.name ) &&
				! excluded.includes( item.id ) &&
				! categories.includes( item.category )
		)
		.filter( ( item ) => {
			if ( item.name !== 'core/embed' ) {
				return true;
			}
			return EMBEDS.includes( item.initialAttributes?.providerNameSlug );
		} )
		.filter( ( item ) => {
			const conf = getConfig( item );

			if ( conf.hidden ) {
				return false;
			}

			// With variations off, keep only the first inserter item per block.
			if ( conf.axes.variations === false && seen.has( item.name ) ) {
				return false;
			}

			seen.add( item.name );
			return true;
		} );

	const ids = new Set( items.map( ( item ) => item.name ) );

	getBlockTypes()
		.filter(
			( type ) =>
				( type.parent?.length || type.ancestor?.length ) &&
				! ids.has( type.name ) &&
				! excluded.includes( type.name ) &&
				hasBlockSupport( type, 'inserter', true )
		)
		.forEach( ( type ) => {
			const conf = getConfig( { id: type.name, name: type.name } );
			const parent =
				conf.parent ||
				( type.parent || type.ancestor ).find( ( name ) =>
					isRegistered( name )
				);

			if (
				parent &&
				! conf.hidden &&
				! categories.includes( type.category )
			) {
				items.push( {
					id: type.name,
					name: type.name,
					title: type.title,
					description: type.description,
					category: type.category,
					icon: type.icon,
					keywords: type.keywords,
					childOf: parent,
				} );
			}
		} );

	return items;
}

/**
 * Overlay UI.
 */
const overlay = {
	el: null,

	mount() {
		this.el = document.createElement( 'div' );
		this.el.className = 'vgtpk-generator';
		this.el.setAttribute( 'role', 'status' );
		this.el.setAttribute( 'aria-live', 'polite' );
		this.el.innerHTML = `
			<div class="vgtpk-generator__panel">
				<p class="vgtpk-generator__site"></p>
				<h1 class="vgtpk-generator__title"></h1>
				<div class="vgtpk-generator__bar"><span></span></div>
				<p class="vgtpk-generator__detail"></p>
				<div class="vgtpk-generator__actions"></div>
			</div>`;
		this.el.querySelector( '.vgtpk-generator__site' ).textContent =
			config.siteName || '';
		document.body.appendChild( this.el );
	},

	update( title, detail, progress ) {
		this.el.querySelector( '.vgtpk-generator__title' ).textContent = title;
		this.el.querySelector( '.vgtpk-generator__detail' ).textContent =
			detail;
		this.el.querySelector( '.vgtpk-generator__bar span' ).style.width =
			`${ Math.round( progress * 100 ) }%`;
	},

	fail( message ) {
		this.el.classList.add( 'is-error' );
		this.update(
			__( 'The Parts Kit wasn’t rebuilt', 'viget-parts-kit' ),
			message,
			1
		);

		const actions = this.el.querySelector( '.vgtpk-generator__actions' );
		actions.innerHTML = '';

		const retry = document.createElement( 'button' );
		retry.type = 'button';
		retry.textContent = __( 'Try again', 'viget-parts-kit' );
		retry.addEventListener( 'click', () => window.location.reload() );

		const back = document.createElement( 'a' );
		back.href = config.explorerUrl;
		back.textContent = __( 'Back to the Parts Kit', 'viget-parts-kit' );

		actions.append( retry, back );
	},
};

/**
 * Tell the explorer (when embedded) what's happening.
 *
 * @param {Object} message Message.
 */
function notify( message ) {
	if ( config.embedded && window.parent !== window ) {
		window.parent.postMessage(
			{ source: 'vgtpk-generator', ...message },
			window.location.origin
		);
	}
}

/**
 * Run the generator.
 */
async function run() {
	overlay.mount();
	overlay.update(
		__( 'Building the Parts Kit', 'viget-parts-kit' ),
		__( 'Waiting for blocks to register…', 'viget-parts-kit' ),
		0.02
	);

	apiFetch.use( apiFetch.createNonceMiddleware( config.nonce ) );

	await waitForBlocks();

	const items = collectItems();
	const categories = select( blocksStore )
		.getCategories()
		.map( ( { slug, title } ) => ( { slug, title } ) );
	const built = [];

	items.forEach( ( item, index ) => {
		overlay.update(
			__( 'Building the Parts Kit', 'viget-parts-kit' ),
			sprintf(
				/* translators: 1: block title, 2: current number, 3: total. */
				__( '%1$s (%2$d of %3$d)', 'viget-parts-kit' ),
				item.title,
				index + 1,
				items.length
			),
			0.05 + ( index / items.length ) * 0.7
		);

		const type = getBlockType( item.name );

		if ( ! type ) {
			return;
		}

		const samples = item.childOf
			? buildChildSamples( type, item.childOf )
			: buildSamples( item );

		if ( ! samples.length ) {
			return;
		}

		const conf = getConfig( item );

		built.push( {
			id: item.id,
			name: item.name,
			variation: variationName( item ),
			title: conf.title || item.title || type.title,
			description:
				conf.description || item.description || type.description || '',
			category:
				conf.category ||
				( item.childOf
					? getBlockType( item.childOf )?.category || type.category
					: item.category || type.category ),
			parent: item.childOf || '',
			icon: iconMarkup( item.icon || type.icon ),
			keywords: ( item.keywords || type.keywords || [] ).filter(
				( k ) => typeof k === 'string'
			),
			styles: (
				select( blocksStore ).getBlockStyles( item.name ) || []
			).map( ( { name, label } ) => ( { name, label } ) ),
			supports: supportsList( type ),
			samples,
		} );

		notify( { type: 'progress', done: index + 1, total: items.length } );
	} );

	try {
		await apiFetch( {
			path: '/vgtpk/v1/catalog/begin',
			method: 'POST',
			data: { categories },
		} );

		for ( let i = 0; i < built.length; i += BATCH_SIZE ) {
			overlay.update(
				__( 'Saving the Parts Kit', 'viget-parts-kit' ),
				sprintf(
					/* translators: 1: saved count, 2: total. */
					__( 'Saved %1$d of %2$d blocks', 'viget-parts-kit' ),
					Math.min( i + BATCH_SIZE, built.length ),
					built.length
				),
				0.75 + ( i / built.length ) * 0.24
			);

			await apiFetch( {
				path: '/vgtpk/v1/catalog/items',
				method: 'POST',
				data: { items: built.slice( i, i + BATCH_SIZE ) },
			} );
		}

		await apiFetch( {
			path: '/vgtpk/v1/catalog/commit',
			method: 'POST',
			data: { post_id: config.postId },
		} );
	} catch ( error ) {
		const message =
			error?.message ||
			__( 'The server didn’t accept the upload.', 'viget-parts-kit' );
		overlay.fail( message );
		notify( { type: 'error', message } );
		return;
	}

	overlay.update(
		sprintf(
			/* translators: %d: number of blocks. */
			__( 'Built %d blocks', 'viget-parts-kit' ),
			built.length
		),
		__( 'Opening the Parts Kit…', 'viget-parts-kit' ),
		1
	);

	notify( { type: 'complete', count: built.length } );

	if ( ! config.embedded ) {
		window.onbeforeunload = null;
		setTimeout( () => window.location.assign( config.explorerUrl ), 600 );
	}
}

domReady( run );
