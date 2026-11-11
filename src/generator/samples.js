/**
 * Sample attributes and inner blocks for blocks that need help looking real.
 *
 * Anything not listed here falls back to the block's own `example`, then to
 * descriptive text dropped into its empty rich-text attributes.
 */

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

const settings = window.vgtpkGenerator || {};
const strings = settings.content || {};
let imageIndex = 0;

/**
 * Fill a sprintf-style template from PHP. Templates come from a filter, so they can't be
 * literals for sprintf().
 *
 * @param {string}    template Template with %1$s / %2$s / %s.
 * @param {...string} args     Values.
 * @return {string} Text.
 */
const format = ( template, ...args ) => {
	let next = 0;
	return String( template || '' ).replace(
		/%(\d+\$)?s/g,
		( match, position ) => {
			const index = position ? parseInt( position, 10 ) - 1 : next++;
			return args[ index ] ?? '';
		}
	);
};

/**
 * Sample image URL: the next of the configured images, or a placeholder.
 *
 * @param {number} width  Width.
 * @param {number} height Height.
 * @param {string} text   Optional label.
 * @return {string} URL.
 */
export function placeholder( width, height, text = '' ) {
	const images = settings.images || [];

	if ( images.length ) {
		return images[ imageIndex++ % images.length ];
	}

	const url = new URL(
		(
			settings.placeholder ||
			'https://placehold.co/{width}x{height}/png?text={text}'
		)
			.replace( '{width}', width )
			.replace( '{height}', height )
			.replace( '{text}', encodeURIComponent( text ) )
	);

	if ( ! text ) {
		url.searchParams.delete( 'text' );
	}

	return url.toString();
}

/**
 * A sentence describing what a sample shows.
 *
 * @param {Object} ctx Sample context: block title and variant label.
 * @return {string} Text.
 */
export function sentence( ctx ) {
	return ctx.label
		? format(
				strings.sentenceVariant || '%1$s (%2$s)',
				ctx.title,
				ctx.label
			)
		: format( strings.sentence || '%1$s', ctx.title );
}

/**
 * A short phrase naming what a sample shows.
 *
 * @param {Object} ctx Sample context.
 * @return {string} Text.
 */
export function phrase( ctx ) {
	return ctx.label ? `${ ctx.title }: ${ ctx.label }` : ctx.title;
}

const citation = () => strings.citation || '';

const paragraph = ( content ) => [ 'core/paragraph', { content } ];
const heading = ( content, level = 2 ) => [
	'core/heading',
	{ content, level },
];

const filler = () => strings.filler || '';

/**
 * Sample definitions keyed by block name. Each returns `{ attributes, innerBlocks }`,
 * with inner blocks in template form.
 */
export const SAMPLES = {
	'core/paragraph': ( ctx ) => ( {
		attributes: { content: sentence( ctx ) },
	} ),

	'core/heading': ( ctx ) => ( {
		attributes: {
			content: ctx.label
				? format( strings.heading || '%1$s', ctx.label )
				: strings.headingDefault || ctx.title,
			level: 2,
		},
	} ),

	'core/list': () => ( {
		innerBlocks: [
			[
				'core/list-item',
				{
					content: __(
						'A first list item with enough words to wrap onto a second line at narrow widths',
						'viget-parts-kit'
					),
				},
			],
			[
				'core/list-item',
				{ content: __( 'A second, shorter item', 'viget-parts-kit' ) },
			],
			[
				'core/list-item',
				{ content: __( 'A third item', 'viget-parts-kit' ) },
				[
					[
						'core/list',
						{},
						[
							[
								'core/list-item',
								{
									content: __(
										'A nested item',
										'viget-parts-kit'
									),
								},
							],
						],
					],
				],
			],
		],
	} ),

	'core/list-item': ( ctx ) => ( {
		attributes: { content: phrase( ctx ) },
	} ),

	'core/quote': ( ctx ) => ( {
		attributes: {
			citation: citation(),
		},
		innerBlocks: [ paragraph( sentence( ctx ) ) ],
	} ),

	'core/pullquote': ( ctx ) => ( {
		attributes: {
			value: sprintf(
				/* translators: %s: variant or block title. */
				__(
					'A pull quote pulls a key line out of the story, like this one in %s.',
					'viget-parts-kit'
				),
				ctx.label || ctx.title
			),
			citation: citation(),
		},
	} ),

	'core/buttons': () => ( {
		innerBlocks: [
			[
				'core/button',
				{
					text: __( 'Primary action', 'viget-parts-kit' ),
					url: '#',
				},
			],
			[
				'core/button',
				{
					text: __( 'Secondary action', 'viget-parts-kit' ),
					url: '#',
				},
			],
		],
	} ),

	'core/button': ( ctx ) => ( {
		attributes: {
			text: ctx.label || strings.button,
			url: '#',
		},
	} ),

	'core/image': ( ctx ) => ( {
		attributes: {
			url: placeholder( 1200, 800 ),
			alt: __( 'Placeholder image', 'viget-parts-kit' ),
			caption: sprintf(
				/* translators: %s: sample description. */
				__( 'Caption for %s', 'viget-parts-kit' ),
				phrase( ctx )
			),
		},
	} ),

	'core/gallery': () => ( {
		attributes: { linkTo: 'none' },
		innerBlocks: [
			[ 1200, 800 ],
			[ 800, 800 ],
			[ 800, 1100 ],
			[ 1600, 900 ],
			[ 800, 800 ],
			[ 1200, 800 ],
		].map( ( [ width, height ] ) => [
			'core/image',
			{
				url: placeholder( width, height ),
				alt: __( 'Placeholder image', 'viget-parts-kit' ),
			},
		] ),
	} ),

	'core/cover': ( ctx ) => ( {
		attributes: {
			url: placeholder( 1600, 900 ),
			dimRatio: 50,
			isDark: true,
		},
		innerBlocks: [
			heading( phrase( ctx ) ),
			paragraph(
				__(
					'Text over an image, checked for contrast and spacing.',
					'viget-parts-kit'
				)
			),
		],
	} ),

	'core/media-text': ( ctx ) => ( {
		attributes: {
			mediaUrl: placeholder( 1200, 800 ),
			mediaType: 'image',
			mediaAlt: __( 'Placeholder image', 'viget-parts-kit' ),
		},
		innerBlocks: [
			heading( phrase( ctx ), 3 ),
			paragraph( sentence( ctx ) ),
		],
	} ),

	'core/columns': ( ctx ) => ( {
		innerBlocks: [
			[
				'core/column',
				{},
				[
					heading( __( 'First column', 'viget-parts-kit' ), 3 ),
					paragraph( sentence( ctx ) ),
				],
			],
			[
				'core/column',
				{},
				[
					heading( __( 'Second column', 'viget-parts-kit' ), 3 ),
					paragraph( sentence( ctx ) ),
				],
			],
		],
	} ),

	'core/column': ( ctx ) => ( {
		innerBlocks: [ paragraph( sentence( ctx ) ) ],
	} ),

	'core/group': ( ctx ) => {
		const type = ctx.attributes?.layout?.type;

		if ( type === 'flex' || type === 'grid' ) {
			const count = type === 'grid' ? 6 : 3;

			return {
				innerBlocks: Array.from( { length: count }, ( _, i ) =>
					paragraph(
						sprintf(
							/* translators: %d: item number. */
							__( 'Item %d', 'viget-parts-kit' ),
							i + 1
						)
					)
				),
			};
		}

		return {
			innerBlocks: [
				heading( phrase( ctx ) ),
				paragraph( sentence( ctx ) ),
			],
		};
	},

	'core/details': ( ctx ) => ( {
		attributes: {
			summary: sprintf(
				/* translators: %s: sample description. */
				__( '%s (select to expand)', 'viget-parts-kit' ),
				phrase( ctx )
			),
			showContent: true,
		},
		innerBlocks: [ paragraph( sentence( ctx ) ) ],
	} ),

	'core/table': ( ctx ) => {
		const cell = ( content, tag = 'td' ) => ( { content, tag } );

		return {
			attributes: {
				head: [
					{
						cells: [
							cell( __( 'Plan', 'viget-parts-kit' ), 'th' ),
							cell( __( 'Seats', 'viget-parts-kit' ), 'th' ),
							cell( __( 'Price', 'viget-parts-kit' ), 'th' ),
						],
					},
				],
				body: [
					[ 'Starter', '5', '$12' ],
					[ 'Team', '25', '$49' ],
					[
						'Enterprise',
						__( 'Unlimited', 'viget-parts-kit' ),
						'$199',
					],
				].map( ( row ) => ( {
					cells: row.map( ( c ) => cell( c ) ),
				} ) ),
				caption: phrase( ctx ),
			},
		};
	},

	'core/code': () => ( {
		attributes: {
			content:
				'const partsKit = {\n\tpurpose: "Review every block",\n\tbuiltWith: "WordPress",\n};',
		},
	} ),

	'core/preformatted': ( ctx ) => ( {
		attributes: {
			content: [
				phrase( ctx ),
				`  ${ __( 'Preformatted text keeps its spacing', 'viget-parts-kit' ) }`,
				`      ${ __( 'and its line breaks.', 'viget-parts-kit' ) }`,
			].join( '\n' ),
		},
	} ),

	'core/verse': ( ctx ) => ( {
		attributes: {
			content: [
				phrase( ctx ),
				__( 'Verse keeps the line breaks', 'viget-parts-kit' ),
				__( 'that poetry and lyrics need.', 'viget-parts-kit' ),
			].join( '\n' ),
		},
	} ),

	'core/spacer': () => ( { attributes: { height: '64px' } } ),

	'core/html': ( ctx ) => ( {
		attributes: {
			content: `<p>${ phrase( ctx ) }: ${ __(
				'output from a Custom HTML block.',
				'viget-parts-kit'
			) }</p>`,
		},
	} ),

	'core/file': ( ctx ) => ( {
		attributes: {
			href: '#',
			fileName: phrase( ctx ),
			textLinkHref: '#',
			showDownloadButton: true,
			downloadButtonText: __( 'Download', 'viget-parts-kit' ),
		},
	} ),

	'core/social-links': () => ( {
		innerBlocks: [ 'wordpress', 'linkedin', 'instagram', 'youtube' ].map(
			( service ) => [ 'core/social-link', { service, url: '#' } ]
		),
	} ),

	'core/social-link': () => ( {
		attributes: { service: 'wordpress', url: '#' },
	} ),

	'core/query': () => ( {
		attributes: {
			query: {
				perPage: 3,
				pages: 0,
				offset: 0,
				postType: 'post',
				order: 'desc',
				orderBy: 'date',
				inherit: false,
			},
		},
		innerBlocks: [
			[
				'core/post-template',
				{},
				[
					[ 'core/post-title', { isLink: true } ],
					[ 'core/post-date' ],
					[ 'core/post-excerpt' ],
				],
			],
		],
	} ),

	'core/embed': ( ctx ) => {
		const urls = {
			youtube: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
			vimeo: 'https://vimeo.com/22439234',
		};
		const provider = ctx.attributes?.providerNameSlug;

		return {
			attributes: urls[ provider ]
				? {
						url: urls[ provider ],
						type: 'video',
						responsive: true,
						className: 'wp-embed-aspect-16-9 wp-has-aspect-ratio',
					}
				: {},
		};
	},
};

/**
 * Embed variations we have sample URLs for. Others are left out rather than shown empty.
 */
export const EMBEDS = [ 'youtube', 'vimeo' ];

/**
 * Filler paragraph shown beside floated samples.
 *
 * @return {Array} Template entry.
 */
export function floatFiller() {
	return paragraph( `${ filler() } ${ filler() }` );
}
