<?php
/**
 * Catalog class
 *
 * @package Viget\PartsKit
 */

namespace Viget\PartsKit;

use WP_Block_Styles_Registry;
use WP_Block_Type_Registry;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * Stores the block samples the generator builds in the editor.
 *
 * The catalog lives in one non-autoloaded option, so it costs nothing outside Parts Kit screens.
 */
class Catalog {

	/**
	 * Option holding the committed catalog.
	 */
	const OPTION_NAME = 'vgtpk_catalog';

	/**
	 * Option holding a catalog mid-upload.
	 */
	const PENDING_OPTION = 'vgtpk_catalog_pending';

	/**
	 * Catalog schema version. Bump when the stored shape changes.
	 */
	const SCHEMA = 2;

	/**
	 * REST namespace.
	 */
	const REST_NAMESPACE = 'vgtpk/v1';

	/**
	 * Blocks that can't stand alone on a sample page.
	 */
	const DEFAULT_EXCLUDED = [
		'core/missing',
		'core/freeform',
		'core/legacy-widget',
		'core/widget-group',
		'core/block',
		'core/pattern',
		'core/template-part',
		'core/post-content',
		'core/more',
		'core/nextpage',
		'core/shortcode',
		'core/rss',
		'core/footnotes',
		'core/home-link',
		'core/navigation-link',
		'core/navigation-submenu',
		'core/post-comments-form',
		'core/comments',
		'core/comment-template',
		'core/comments-pagination',
		'core/latest-comments',
		'core/query-pagination',
		'core/query-no-results',
		'core/post-template',
		Explorer::BLOCK_NAME,
	];

	/**
	 * Cached catalog for the request.
	 *
	 * @var array|null
	 */
	private ?array $catalog = null;

	/**
	 * Constructor.
	 */
	public function __construct() {
		add_action( 'rest_api_init', [ $this, 'register_routes' ] );
	}

	/**
	 * Get the committed catalog.
	 *
	 * @return array
	 */
	public function get(): array {
		if ( null === $this->catalog ) {
			$catalog       = get_option( self::OPTION_NAME, [] );
			$this->catalog = \is_array( $catalog ) && ( $catalog['schema'] ?? 0 ) === self::SCHEMA ? $catalog : [];
		}

		return $this->catalog;
	}

	/**
	 * Whether a catalog has been built.
	 *
	 * @return bool
	 */
	public function exists(): bool {
		return ! empty( $this->get()['items'] );
	}

	/**
	 * Get catalog items, minus excluded blocks, variations and categories.
	 *
	 * Exclusions apply here too, so changing a filter takes effect without a rebuild.
	 *
	 * @return array
	 */
	public function get_items(): array {
		$excluded   = $this->get_excluded_blocks();
		$categories = $this->get_excluded_categories();
		$items      = $this->get()['items'] ?? [];

		return array_values(
			array_filter(
				$items,
				static fn( $item ) => ! \in_array( $item['name'], $excluded, true )
					&& ! \in_array( $item['id'], $excluded, true )
					&& ! \in_array( $item['category'], $categories, true )
			)
		);
	}

	/**
	 * Get one item by ID.
	 *
	 * @param string $id Item ID, e.g. `core/paragraph` or `core/group/group-row`.
	 *
	 * @return array|null
	 */
	public function get_item( string $id ): ?array {
		foreach ( $this->get_items() as $item ) {
			if ( $item['id'] === $id ) {
				return $item;
			}
		}

		return null;
	}

	/**
	 * Blocks left out of the Parts Kit.
	 *
	 * @return array
	 */
	public function get_excluded_blocks(): array {
		/**
		 * Filters blocks left out of the Parts Kit.
		 *
		 * Accepts block names (`core/verse`) or single variations by item ID
		 * (`core/group/group-grid`). Remove an entry to bring a default exclusion back.
		 *
		 * @param array $excluded Defaults plus the list on the settings page.
		 */
		$excluded = apply_filters(
			'vgtpk_excluded_blocks',
			array_values( array_unique( array_merge( self::DEFAULT_EXCLUDED, (array) vgtpk()->settings->get( 'excluded_blocks' ) ) ) )
		);

		return array_values( array_map( 'strval', (array) $excluded ) );
	}

	/**
	 * Inserter categories left out of the Parts Kit.
	 *
	 * @return array
	 */
	public function get_excluded_categories(): array {
		/**
		 * Filters inserter categories left out of the Parts Kit, e.g. `embed` or `widgets`.
		 *
		 * @param array $categories Category slugs.
		 */
		return array_values( array_map( 'strval', (array) apply_filters( 'vgtpk_excluded_categories', [] ) ) );
	}

	/**
	 * Fingerprint of everything that changes what the catalog would contain.
	 *
	 * Only computed on Parts Kit screens. JS-only block registrations can't be seen here,
	 * which is what the Rebuild button is for.
	 *
	 * @return string
	 */
	public function current_hash(): string {
		global $wp_version;

		$blocks = array_keys( WP_Block_Type_Registry::get_instance()->get_all_registered() );
		sort( $blocks );

		$styles = [];
		foreach ( WP_Block_Styles_Registry::get_instance()->get_all_registered() as $block => $block_styles ) {
			$styles[ $block ] = array_keys( $block_styles );
		}
		ksort( $styles );

		$theme = wp_get_theme();
		$files = array_merge(
			glob( get_stylesheet_directory() . '/blocks/*/block.json' ) ? glob( get_stylesheet_directory() . '/blocks/*/block.json' ) : [],
			glob( get_stylesheet_directory() . '/blocks/*/*/block.json' ) ? glob( get_stylesheet_directory() . '/blocks/*/*/block.json' ) : [],
			[ get_stylesheet_directory() . '/theme.json', get_template_directory() . '/theme.json' ]
		);
		$mtime = 0;
		foreach ( array_unique( $files ) as $file ) {
			if ( is_file( $file ) ) {
				$mtime = max( $mtime, (int) filemtime( $file ) );
			}
		}

		$parts = [
			'schema'   => self::SCHEMA,
			'plugin'   => VGTPK_VERSION,
			'wp'       => $wp_version,
			'theme'    => $theme->get_stylesheet() . '@' . $theme->get( 'Version' ),
			'plugins'  => array_merge( (array) get_option( 'active_plugins', [] ), array_keys( (array) get_site_option( 'active_sitewide_plugins', [] ) ) ),
			'blocks'   => $blocks,
			'styles'   => $styles,
			'mtime'    => $mtime,
			'excluded' => $this->get_excluded_blocks(),
		];

		/**
		 * Filters what goes into the catalog fingerprint. A changed fingerprint marks the catalog stale.
		 *
		 * @param array $parts Fingerprint parts.
		 */
		$parts = apply_filters( 'vgtpk_catalog_hash_parts', $parts );

		return md5( (string) wp_json_encode( $parts ) );
	}

	/**
	 * Whether the catalog is missing or out of date.
	 *
	 * @return bool
	 */
	public function is_stale(): bool {
		return ! $this->exists() || ( $this->get()['hash'] ?? '' ) !== $this->current_hash();
	}

	/**
	 * Status summary for the explorer and REST.
	 *
	 * @return array
	 */
	public function status(): array {
		$catalog = $this->get();

		return [
			'exists'      => $this->exists(),
			'stale'       => $this->is_stale(),
			'generatedAt' => $catalog['generated_at'] ?? null,
			'count'       => \count( $catalog['items'] ?? [] ),
		];
	}

	/**
	 * Register REST routes.
	 *
	 * @return void
	 */
	public function register_routes(): void {
		$manage = static fn() => Access::can_manage();

		register_rest_route(
			self::REST_NAMESPACE,
			'/catalog/begin',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'rest_begin' ],
				'permission_callback' => $manage,
			]
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/catalog/items',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'rest_items' ],
				'permission_callback' => $manage,
			]
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/catalog/commit',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'rest_commit' ],
				'permission_callback' => $manage,
			]
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/catalog/status',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => fn() => new WP_REST_Response( $this->status() ),
				'permission_callback' => static fn() => Access::can_view(),
			]
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/catalog/item',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'rest_item' ],
				'permission_callback' => static fn() => Access::can_view(),
				'args'                => [
					'id' => [
						'type'     => 'string',
						'required' => true,
					],
				],
			]
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/pages',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'rest_create_page' ],
				'permission_callback' => static fn() => current_user_can( 'publish_pages' ),
			]
		);
	}

	/**
	 * One item with its sample markup, for the explorer's markup panel.
	 *
	 * @param WP_REST_Request $request Request.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public function rest_item( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$item = $this->get_item( self::sanitize_id( (string) $request->get_param( 'id' ) ) );

		if ( ! $item ) {
			return new WP_Error( 'vgtpk_not_found', __( 'That block isn’t in the Parts Kit.', 'viget-parts-kit' ), [ 'status' => 404 ] );
		}

		return new WP_REST_Response( $item );
	}

	/**
	 * Start a catalog upload.
	 *
	 * @param WP_REST_Request $request Request.
	 *
	 * @return WP_REST_Response
	 */
	public function rest_begin( WP_REST_Request $request ): WP_REST_Response {
		$categories = array_values(
			array_filter(
				array_map(
					static fn( $category ) => \is_array( $category ) && ! empty( $category['slug'] ) ? [
						'slug'  => sanitize_title( $category['slug'] ),
						'title' => sanitize_text_field( $category['title'] ?? $category['slug'] ),
					] : null,
					(array) $request->get_param( 'categories' )
				)
			)
		);

		update_option(
			self::PENDING_OPTION,
			[
				'categories' => $categories,
				'items'      => [],
			],
			false
		);

		return new WP_REST_Response( [ 'ok' => true ] );
	}

	/**
	 * Append a batch of items to the pending upload.
	 *
	 * @param WP_REST_Request $request Request.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public function rest_items( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$pending = get_option( self::PENDING_OPTION );

		if ( ! \is_array( $pending ) ) {
			return new WP_Error( 'vgtpk_no_upload', __( 'Start a rebuild before sending blocks.', 'viget-parts-kit' ), [ 'status' => 409 ] );
		}

		foreach ( (array) $request->get_param( 'items' ) as $item ) {
			$item = \is_array( $item ) ? $this->sanitize_item( $item ) : null;

			if ( $item ) {
				$pending['items'][] = $item;
			}
		}

		update_option( self::PENDING_OPTION, $pending, false );

		return new WP_REST_Response( [ 'count' => \count( $pending['items'] ) ] );
	}

	/**
	 * Commit the pending upload and clean up the generator's auto-draft.
	 *
	 * @param WP_REST_Request $request Request.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public function rest_commit( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$pending = get_option( self::PENDING_OPTION );

		if ( ! \is_array( $pending ) || empty( $pending['items'] ) ) {
			return new WP_Error( 'vgtpk_empty_upload', __( 'No blocks were received, so the Parts Kit was left as it was.', 'viget-parts-kit' ), [ 'status' => 409 ] );
		}

		$this->catalog = [
			'schema'       => self::SCHEMA,
			'hash'         => $this->current_hash(),
			'generated_at' => gmdate( 'c' ),
			'generated_by' => get_current_user_id(),
			'categories'   => $pending['categories'],
			'items'        => $pending['items'],
		];

		update_option( self::OPTION_NAME, $this->catalog, false );
		delete_option( self::PENDING_OPTION );

		$this->delete_generator_draft( absint( $request->get_param( 'post_id' ) ) );

		/**
		 * Fires after the catalog is rebuilt.
		 *
		 * @param array $catalog The new catalog.
		 */
		do_action( 'vgtpk_catalog_rebuilt', $this->catalog );

		return new WP_REST_Response( $this->status() );
	}

	/**
	 * Delete the auto-draft the generator ran in, if it's still an untouched auto-draft.
	 *
	 * @param int $post_id Post ID.
	 *
	 * @return void
	 */
	private function delete_generator_draft( int $post_id ): void {
		$post = $post_id ? get_post( $post_id ) : null;

		if ( ! $post || Post_Type::NAME !== $post->post_type || 'auto-draft' !== $post->post_status || get_current_user_id() !== (int) $post->post_author ) {
			return;
		}

		wp_delete_post( $post_id, true );
	}

	/**
	 * Create a draft QA page from catalog samples.
	 *
	 * @param WP_REST_Request $request Request.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public function rest_create_page( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$ids     = array_map( 'strval', (array) $request->get_param( 'items' ) );
		$all     = 'all' === $request->get_param( 'samples' );
		$content = '';

		foreach ( $ids as $id ) {
			$item = $this->get_item( $id );

			if ( ! $item || empty( $item['samples'] ) ) {
				continue;
			}

			if ( \count( $ids ) > 1 ) {
				$content .= serialize_block(
					[
						'blockName'    => 'core/heading',
						'attrs'        => [],
						'innerBlocks'  => [],
						'innerHTML'    => '<h2 class="wp-block-heading">' . esc_html( $item['title'] ) . '</h2>',
						'innerContent' => [ '<h2 class="wp-block-heading">' . esc_html( $item['title'] ) . '</h2>' ],
					]
				) . "\n\n";
			}

			$samples = $all ? $item['samples'] : [ $item['samples'][0] ];

			foreach ( $samples as $sample ) {
				$content .= $sample['markup'] . "\n\n";
			}
		}

		if ( ! $content ) {
			return new WP_Error( 'vgtpk_no_samples', __( 'None of those blocks are in the Parts Kit. Rebuild it and try again.', 'viget-parts-kit' ), [ 'status' => 400 ] );
		}

		$title   = sanitize_text_field( (string) $request->get_param( 'title' ) );
		$post_id = wp_insert_post(
			[
				'post_type'    => Post_Type::NAME,
				'post_status'  => 'draft',
				'post_title'   => $title ? $title : __( 'Kitchen Sink', 'viget-parts-kit' ),
				'post_content' => current_user_can( 'unfiltered_html' ) ? $content : filter_block_content( $content, 'post' ),
			],
			true
		);

		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}

		return new WP_REST_Response(
			[
				'id'      => $post_id,
				'editUrl' => get_edit_post_link( $post_id, 'raw' ),
			]
		);
	}

	/**
	 * Sanitize one catalog item from the generator.
	 *
	 * @param array $item Raw item.
	 *
	 * @return array|null
	 */
	public function sanitize_item( array $item ): ?array {
		$id   = self::sanitize_id( (string) ( $item['id'] ?? '' ) );
		$name = self::sanitize_id( (string) ( $item['name'] ?? '' ) );

		if ( ! $id || ! $name || ! str_contains( $name, '/' ) ) {
			return null;
		}

		$samples = [];
		foreach ( (array) ( $item['samples'] ?? [] ) as $sample ) {
			if ( ! \is_array( $sample ) || empty( $sample['markup'] ) ) {
				continue;
			}

			$markup = (string) $sample['markup'];

			$samples[] = [
				'key'         => sanitize_key( $sample['key'] ?? 'sample-' . \count( $samples ) ),
				'group'       => sanitize_key( $sample['group'] ?? 'default' ),
				'label'       => sanitize_text_field( $sample['label'] ?? '' ),
				'description' => sanitize_text_field( $sample['description'] ?? '' ),
				'markup'      => current_user_can( 'unfiltered_html' ) ? $markup : filter_block_content( $markup, 'post' ),
			];
		}

		if ( ! $samples ) {
			return null;
		}

		return [
			'id'          => $id,
			'name'        => $name,
			'variation'   => sanitize_key( $item['variation'] ?? '' ),
			'title'       => sanitize_text_field( $item['title'] ?? $name ),
			'description' => sanitize_text_field( $item['description'] ?? '' ),
			'category'    => sanitize_title( $item['category'] ?? 'uncategorized' ),
			'parent'      => self::sanitize_id( (string) ( $item['parent'] ?? '' ) ),
			'icon'        => self::sanitize_icon( (string) ( $item['icon'] ?? '' ) ),
			'keywords'    => array_values( array_map( 'sanitize_text_field', array_filter( (array) ( $item['keywords'] ?? [] ), 'is_string' ) ) ),
			'styles'      => array_values(
				array_map(
					static fn( $style ) => [
						'name'  => sanitize_key( $style['name'] ?? '' ),
						'label' => sanitize_text_field( $style['label'] ?? '' ),
					],
					array_filter( (array) ( $item['styles'] ?? [] ), 'is_array' )
				)
			),
			'supports'    => array_values( array_map( 'sanitize_key', array_filter( (array) ( $item['supports'] ?? [] ), 'is_string' ) ) ),
			'samples'     => $samples,
		];
	}

	/**
	 * Sanitize a block name or item ID.
	 *
	 * @param string $id Raw ID.
	 *
	 * @return string
	 */
	public static function sanitize_id( string $id ): string {
		return (string) preg_replace( '/[^a-z0-9\-\/_]/', '', strtolower( $id ) );
	}

	/**
	 * Keep only safe SVG markup for block icons, or a `dashicon:slug` reference.
	 *
	 * @param string $svg Raw SVG.
	 *
	 * @return string
	 */
	public static function sanitize_icon( string $svg ): string {
		// Dashicon slugs, which the editor draws with the Dashicons font.
		if ( preg_match( '/^dashicon:(?:dashicons-)?([a-z0-9-]+)$/', $svg, $matches ) ) {
			return 'dashicon:' . $matches[1];
		}

		if ( ! str_contains( $svg, '<svg' ) ) {
			return '';
		}

		$shape   = [
			'd'               => true,
			'fill'            => true,
			'fill-rule'       => true,
			'clip-rule'       => true,
			'stroke'          => true,
			'stroke-width'    => true,
			'stroke-linecap'  => true,
			'stroke-linejoin' => true,
			'transform'       => true,
			'opacity'         => true,
			'x'               => true,
			'y'               => true,
			'width'           => true,
			'height'          => true,
			'rx'              => true,
			'ry'              => true,
			'cx'              => true,
			'cy'              => true,
			'r'               => true,
			'x1'              => true,
			'x2'              => true,
			'y1'              => true,
			'y2'              => true,
			'points'          => true,
		];
		$allowed = [
			'svg'      => [
				'xmlns'       => true,
				'viewbox'     => true,
				'width'       => true,
				'height'      => true,
				'fill'        => true,
				'aria-hidden' => true,
				'focusable'   => true,
				'role'        => true,
			],
			'g'        => $shape,
			'path'     => $shape,
			'rect'     => $shape,
			'circle'   => $shape,
			'ellipse'  => $shape,
			'line'     => $shape,
			'polyline' => $shape,
			'polygon'  => $shape,
		];

		return wp_kses( $svg, $allowed );
	}

	/**
	 * Nav tree for the explorer: categories in inserter order, child blocks nested under parents.
	 *
	 * @return array
	 */
	public function get_nav(): array {
		$items      = $this->get_items();
		$categories = $this->get()['categories'] ?? [];
		$ids        = array_column( $items, 'id' );
		$children   = [];
		$groups     = [];

		foreach ( $items as $item ) {
			$entry = [
				'id'          => $item['id'],
				'name'        => $item['name'],
				'title'       => $item['title'],
				'description' => $item['description'],
				'icon'        => $item['icon'],
				'keywords'    => $item['keywords'],
				'styles'      => $item['styles'],
				'supports'    => $item['supports'],
				'samples'     => array_map(
					static fn( $sample ) => [
						'key'         => $sample['key'],
						'group'       => $sample['group'],
						'label'       => $sample['label'],
						'description' => $sample['description'],
					],
					$item['samples']
				),
				'children'    => [],
			];

			if ( $item['parent'] && \in_array( $item['parent'], $ids, true ) ) {
				$children[ $item['parent'] ][] = $entry;
				continue;
			}

			$groups[ $item['category'] ][] = $entry;
		}

		$nav   = [];
		$known = array_column( $categories, 'slug' );

		foreach ( $groups as $slug => $group ) {
			if ( ! \in_array( $slug, $known, true ) ) {
				$categories[] = [
					'slug'  => $slug,
					'title' => ucwords( str_replace( '-', ' ', $slug ) ),
				];
			}
		}

		$by_title = static fn( $a, $b ) => strnatcasecmp( $a['title'], $b['title'] );

		foreach ( $children as &$list ) {
			usort( $list, $by_title );
		}
		unset( $list );

		foreach ( $categories as $category ) {
			if ( empty( $groups[ $category['slug'] ] ) ) {
				continue;
			}

			usort( $groups[ $category['slug'] ], $by_title );

			$nav[] = [
				'slug'  => $category['slug'],
				'title' => $category['title'],
				'items' => array_map(
					static function ( $entry ) use ( $children ) {
						$entry['children'] = $children[ $entry['id'] ] ?? [];
						return $entry;
					},
					$groups[ $category['slug'] ]
				),
			];
		}

		/**
		 * Filters the explorer nav: categories in inserter order, blocks alphabetical within each.
		 *
		 * @param array $nav Categories, each with `slug`, `title` and `items`.
		 */
		return (array) apply_filters( 'vgtpk_nav', $nav );
	}
}
