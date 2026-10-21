<?php
/**
 * Block Index class
 *
 * @package Viget\PartsKit
 */

namespace Viget\PartsKit;

use WP_Block_Styles_Registry;
use WP_Block_Template;
use WP_Block_Type_Registry;
use WP_Post;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * Scans content for block usage and serves it to the Block Index screen.
 *
 * Scans run in batches from the admin screen and are stored in one non-autoloaded option.
 * Nothing hooks into saving posts: a refresh rescans only what changed since the last scan.
 */
class Block_Index {

	/**
	 * Option holding the index.
	 */
	const OPTION_NAME = 'vgtpk_block_index';

	/**
	 * Option holding an index mid-scan.
	 */
	const PENDING_OPTION = 'vgtpk_block_index_pending';

	/**
	 * Admin page slug.
	 */
	const PAGE_SLUG = 'vgtpk-block-index';

	/**
	 * Index schema version.
	 */
	const SCHEMA = 1;

	/**
	 * Posts per scan batch.
	 */
	const BATCH_SIZE = 100;

	/**
	 * Top-level blocks kept per record for the ribbon.
	 */
	const SEQUENCE_LIMIT = 120;

	/**
	 * Constructor.
	 */
	public function __construct() {
		add_action( 'rest_api_init', [ $this, 'register_routes' ] );
	}

	/**
	 * Post statuses that count as content.
	 *
	 * @return array
	 */
	public static function statuses(): array {
		return [ 'publish', 'future', 'draft', 'pending', 'private' ];
	}

	/**
	 * Post types to scan. Templates and template parts are read separately, so file-based ones count too.
	 *
	 * @return array
	 */
	public static function post_types(): array {
		$types = [];

		foreach ( get_post_types( [], 'objects' ) as $type ) {
			if ( \in_array( $type->name, [ 'attachment', 'revision', 'wp_template', 'wp_template_part', 'wp_global_styles', 'wp_font_family', 'wp_font_face', 'oembed_cache', 'customize_changeset', 'user_request', Post_Type::NAME ], true ) ) {
				continue;
			}

			if ( \in_array( $type->name, [ 'wp_block', 'wp_navigation' ], true ) || ( $type->show_ui && post_type_supports( $type->name, 'editor' ) ) ) {
				$types[] = $type->name;
			}
		}

		/**
		 * Filters the post types the Block Index scans.
		 *
		 * @param array $types Post type names.
		 */
		return array_values( (array) apply_filters( 'vgtpk_index_post_types', $types ) );
	}

	/**
	 * Get the stored index.
	 *
	 * @return array
	 */
	public function get(): array {
		$index = get_option( self::OPTION_NAME, [] );
		return \is_array( $index ) && ( $index['schema'] ?? 0 ) === self::SCHEMA ? $index : [];
	}

	/**
	 * Register REST routes.
	 *
	 * @return void
	 */
	public function register_routes(): void {
		$permission = static fn() => Access::can_index();

		register_rest_route(
			Catalog::REST_NAMESPACE,
			'/index',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'rest_get' ],
				'permission_callback' => $permission,
			]
		);

		register_rest_route(
			Catalog::REST_NAMESPACE,
			'/index/block',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'rest_block' ],
				'permission_callback' => $permission,
				'args'                => [
					'name' => [
						'type'     => 'string',
						'required' => true,
					],
				],
			]
		);

		register_rest_route(
			Catalog::REST_NAMESPACE,
			'/index/scan',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'rest_scan' ],
				'permission_callback' => $permission,
				'args'                => [
					'mode'   => [
						'type'    => 'string',
						'enum'    => [ 'full', 'changes' ],
						'default' => 'changes',
					],
					'offset' => [
						'type'    => 'integer',
						'default' => 0,
						'minimum' => 0,
					],
				],
			]
		);
	}

	/**
	 * Count posts changed since the last scan. One cheap query.
	 *
	 * @param string $since GMT datetime.
	 *
	 * @return int
	 */
	public function count_changed( string $since ): int {
		global $wpdb;

		$types    = self::post_types();
		$statuses = self::statuses();

		if ( ! $types ) {
			return 0;
		}

		$types_in    = implode( ',', array_fill( 0, \count( $types ), '%s' ) );
		$statuses_in = implode( ',', array_fill( 0, \count( $statuses ), '%s' ) );

		// phpcs:disable WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery -- Placeholder lists built above; a count is cheaper than WP_Query here.
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(ID) FROM {$wpdb->posts} WHERE post_type IN ($types_in) AND post_status IN ($statuses_in) AND post_modified_gmt > %s",
				array_merge( $types, $statuses, [ gmdate( 'Y-m-d H:i:s', strtotime( $since ) ) ] )
			)
		);
		// phpcs:enable
	}

	/**
	 * Return the index plus everything the screen needs to make sense of it.
	 *
	 * @return WP_REST_Response
	 */
	public function rest_get(): WP_REST_Response {
		$index = $this->get();

		$registered = [];
		$styles     = WP_Block_Styles_Registry::get_instance();
		$audit      = new Block_Audit();
		$icons      = [];

		foreach ( vgtpk()->catalog->get_items() as $item ) {
			if ( empty( $icons[ $item['name'] ] ) && ! empty( $item['icon'] ) ) {
				$icons[ $item['name'] ] = $item['icon'];
			}
		}

		foreach ( WP_Block_Type_Registry::get_instance()->get_all_registered() as $name => $type ) {
			if ( Explorer::BLOCK_NAME === $name ) {
				continue;
			}

			$block_styles = array_map(
				static fn( $style ) => [
					'name'      => $style['name'] ?? '',
					'label'     => $style['label'] ?? '',
					'isDefault' => ! empty( $style['isDefault'] ) || ! empty( $style['is_default'] ),
				],
				array_merge( (array) ( $type->styles ?? [] ), array_values( $styles->get_registered_styles_for_block( $name ) ) )
			);

			$registered[] = [
				'name'        => $name,
				'title'       => $type->title ? $type->title : $name,
				'description' => (string) $type->description,
				'category'    => (string) $type->category,
				'parent'      => (array) $type->parent,
				'dynamic'     => $type->is_dynamic(),
				'inserter'    => (bool) ( $type->supports['inserter'] ?? true ),
				'styles'      => array_values( array_filter( $block_styles, static fn( $style ) => $style['name'] ) ),
				'inKit'       => isset( $icons[ $name ] ) || \in_array( $name, array_column( vgtpk()->catalog->get_items(), 'name' ), true ),
				'icon'        => $icons[ $name ] ?? self::icon( $type->icon ),
				'audit'       => array_values(
					array_filter(
						$audit->quick( $type ),
						// Icons set in JavaScript only show up in the catalog.
						static fn( $finding ) => 'no-icon' !== $finding['code'] || empty( $icons[ $name ] )
					)
				),
			];
		}

		$post_types = [];
		foreach ( array_merge( self::post_types(), [ 'wp_template', 'wp_template_part' ] ) as $type ) {
			$object = get_post_type_object( $type );
			if ( $object ) {
				$post_types[ $type ] = $object->labels->singular_name;
			}
		}

		$statuses = [];
		foreach ( self::statuses() as $status ) {
			$object              = get_post_status_object( $status );
			$statuses[ $status ] = $object ? $object->label : $status;
		}

		return new WP_REST_Response(
			[
				'scannedAt'  => $index['scanned_at'] ?? null,
				'changed'    => ! empty( $index['scanned_at'] ) ? $this->count_changed( $index['scanned_at'] ) : null,
				'records'    => array_values( $index['records'] ?? [] ),
				'registered' => $registered,
				'categories' => array_map(
					static fn( $category ) => [
						'slug'  => $category['slug'],
						'title' => $category['title'],
					],
					get_block_categories( new WP_Post( (object) [ 'post_type' => 'post' ] ) )
				),
				'postTypes'  => $post_types,
				'statuses'   => $statuses,
				'theme'      => array_values( array_unique( [ 'acf', get_stylesheet(), get_template(), (string) wp_get_theme()->get( 'TextDomain' ) ] ) ),
				'blockTheme' => wp_is_block_theme(),
			]
		);
	}

	/**
	 * Spec, audit and a sample render for one block.
	 *
	 * @param WP_REST_Request $request Request.
	 *
	 * @return WP_REST_Response
	 */
	public function rest_block( WP_REST_Request $request ): WP_REST_Response {
		$inspection = ( new Block_Audit() )->inspect( (string) $request->get_param( 'name' ) );

		if ( ! $inspection ) {
			return new WP_REST_Response( [ 'message' => __( 'That block isn’t registered.', 'viget-parts-kit' ) ], 404 );
		}

		return new WP_REST_Response( $inspection );
	}

	/**
	 * A block.json icon as catalog-style markup: a sanitized SVG, or `dashicon:slug`.
	 *
	 * @param mixed $icon Icon from the block type.
	 *
	 * @return string
	 */
	public static function icon( mixed $icon ): string {
		if ( \is_array( $icon ) ) {
			$icon = $icon['src'] ?? '';
		}

		if ( ! \is_string( $icon ) || '' === $icon ) {
			return '';
		}

		return str_contains( $icon, '<svg' ) ? Catalog::sanitize_icon( $icon ) : Catalog::sanitize_icon( 'dashicon:' . $icon );
	}

	/**
	 * Scan one batch.
	 *
	 * @param WP_REST_Request $request Request.
	 *
	 * @return WP_REST_Response
	 */
	public function rest_scan( WP_REST_Request $request ): WP_REST_Response {
		$index  = $this->get();
		$mode   = empty( $index['scanned_at'] ) ? 'full' : $request->get_param( 'mode' );
		$offset = (int) $request->get_param( 'offset' );

		if ( 0 === $offset ) {
			$pending = [
				'schema'     => self::SCHEMA,
				'mode'       => $mode,
				'started_at' => gmdate( 'Y-m-d H:i:s' ),
				'since'      => $index['scanned_at'] ?? null,
				'records'    => 'changes' === $mode ? ( $index['records'] ?? [] ) : [],
				'total'      => $this->count_to_scan( $mode, $index['scanned_at'] ?? null ),
			];
		} else {
			$pending = get_option( self::PENDING_OPTION );
			$pending = \is_array( $pending ) ? $pending : [
				'schema'     => self::SCHEMA,
				'mode'       => 'full',
				'started_at' => gmdate( 'Y-m-d H:i:s' ),
				'since'      => null,
				'records'    => [],
				'total'      => 0,
			];
		}

		$args = [
			'post_type'              => self::post_types(),
			'post_status'            => self::statuses(),
			'posts_per_page'         => self::BATCH_SIZE,
			'offset'                 => $offset,
			'orderby'                => 'ID',
			'order'                  => 'ASC',
			'no_found_rows'          => true,
			'update_post_meta_cache' => false,
			'update_post_term_cache' => false,
			'ignore_sticky_posts'    => true,
			'suppress_filters'       => true,
		];

		if ( 'changes' === $pending['mode'] && $pending['since'] ) {
			$args['date_query'] = [
				[
					'column' => 'post_modified_gmt',
					'after'  => $pending['since'],
				],
			];
		}

		$posts = get_posts( $args );

		foreach ( $posts as $post ) {
			$record                               = $this->scan_post( $post );
			$pending['records'][ $record['key'] ] = $record;
		}

		$processed = $offset + \count( $posts );
		$done      = \count( $posts ) < self::BATCH_SIZE;

		if ( ! $done ) {
			update_option( self::PENDING_OPTION, $pending, false );

			return new WP_REST_Response(
				[
					'done'      => false,
					'offset'    => $processed,
					'processed' => $processed,
					'total'     => $pending['total'],
				]
			);
		}

		if ( 'changes' === $pending['mode'] ) {
			$pending['records'] = $this->prune( $pending['records'] );
		}

		foreach ( $this->scan_templates() as $record ) {
			$pending['records'][ $record['key'] ] = $record;
		}

		update_option(
			self::OPTION_NAME,
			[
				'schema'     => self::SCHEMA,
				'scanned_at' => $pending['started_at'],
				'records'    => $pending['records'],
			],
			false
		);
		delete_option( self::PENDING_OPTION );

		return new WP_REST_Response(
			[
				'done'      => true,
				'offset'    => $processed,
				'processed' => $processed,
				'total'     => $pending['total'],
			]
		);
	}

	/**
	 * How many posts a scan will read.
	 *
	 * @param string      $mode  Scan mode.
	 * @param string|null $since Last scan time.
	 *
	 * @return int
	 */
	private function count_to_scan( string $mode, ?string $since ): int {
		if ( 'changes' === $mode && $since ) {
			return $this->count_changed( $since );
		}

		$total = 0;
		foreach ( self::post_types() as $type ) {
			$counts = wp_count_posts( $type );
			foreach ( self::statuses() as $status ) {
				$total += (int) ( $counts->$status ?? 0 );
			}
		}

		return $total;
	}

	/**
	 * Drop records for posts that were deleted or trashed since the last scan.
	 *
	 * @param array $records Records.
	 *
	 * @return array
	 */
	private function prune( array $records ): array {
		$ids = get_posts(
			[
				'post_type'        => self::post_types(),
				'post_status'      => self::statuses(),
				'posts_per_page'   => -1,
				'fields'           => 'ids',
				'no_found_rows'    => true,
				'suppress_filters' => true,
			]
		);
		$ids = array_flip( array_map( 'intval', $ids ) );

		return array_filter(
			$records,
			static fn( $record ) => 'post' !== $record['source'] || isset( $ids[ $record['id'] ] )
		);
	}

	/**
	 * Index one post.
	 *
	 * @param WP_Post $post Post.
	 *
	 * @return array
	 */
	public function scan_post( WP_Post $post ): array {
		$record = $this->scan_content( (string) $post->post_content );
		$type   = get_post_type_object( $post->post_type );

		return array_merge(
			[
				'key'      => 'post:' . $post->ID,
				'source'   => 'post',
				'id'       => $post->ID,
				'type'     => $post->post_type,
				'status'   => $post->post_status,
				'title'    => html_entity_decode( get_the_title( $post ), ENT_QUOTES, get_bloginfo( 'charset' ) ),
				'modified' => strtotime( $post->post_modified_gmt . ' UTC' ),
				'url'      => 'publish' === $post->post_status && is_post_type_viewable( $post->post_type ) ? get_permalink( $post ) : '',
				'edit'     => $type && $type->show_ui ? admin_url( 'post.php?post=' . $post->ID . '&action=edit' ) : '',
			],
			$record
		);
	}

	/**
	 * Index block templates and template parts, including file-based ones.
	 *
	 * @return array
	 */
	public function scan_templates(): array {
		if ( ! wp_is_block_theme() ) {
			return [];
		}

		$records = [];

		foreach ( [ 'wp_template', 'wp_template_part' ] as $type ) {
			foreach ( get_block_templates( [], $type ) as $template ) {
				if ( ! $template instanceof WP_Block_Template ) {
					continue;
				}

				$records[] = array_merge(
					[
						'key'      => 'template:' . $type . ':' . $template->id,
						'source'   => 'template',
						'id'       => $template->wp_id ? (int) $template->wp_id : 0,
						'type'     => $type,
						'status'   => 'publish',
						'title'    => $template->title ? $template->title : $template->slug,
						'modified' => $template->modified ? strtotime( (string) $template->modified ) : 0,
						'url'      => '',
						'edit'     => admin_url( 'site-editor.php?p=' . rawurlencode( '/' . $type . '/' . $template->id ) . '&canvas=edit' ),
						'origin'   => $template->source,
					],
					$this->scan_content( (string) $template->content )
				);
			}
		}

		return $records;
	}

	/**
	 * Tally blocks in a piece of content.
	 *
	 * @param string $content Post content.
	 *
	 * @return array
	 */
	public function scan_content( string $content ): array {
		$stats = [
			'total'   => 0,
			'depth'   => 0,
			'blocks'  => [],
			'styles'  => [],
			'aligns'  => [],
			'refs'    => [],
			'seq'     => [],
			'classic' => false,
		];

		if ( '' === trim( $content ) ) {
			return $stats;
		}

		$blocks = parse_blocks( $content );

		foreach ( $blocks as $block ) {
			if ( ! empty( $block['blockName'] ) && \count( $stats['seq'] ) < self::SEQUENCE_LIMIT ) {
				$stats['seq'][] = $block['blockName'];
			}
		}

		$this->walk( $blocks, 1, $stats );

		if ( 0 === $stats['total'] && '' !== trim( wp_strip_all_tags( $content ) ) ) {
			$stats['classic'] = true;
		}

		$stats['refs'] = array_values( array_unique( $stats['refs'] ) );

		return $stats;
	}

	/**
	 * Walk parsed blocks, tallying into $stats.
	 *
	 * @param array $blocks Parsed blocks.
	 * @param int   $depth  Current depth.
	 * @param array $stats  Running tallies.
	 *
	 * @return void
	 */
	private function walk( array $blocks, int $depth, array &$stats ): void {
		foreach ( $blocks as $block ) {
			$name = $block['blockName'] ?? null;

			if ( $name ) {
				++$stats['total'];
				$stats['depth']           = max( $stats['depth'], $depth );
				$stats['blocks'][ $name ] = ( $stats['blocks'][ $name ] ?? 0 ) + 1;
				$attrs                    = (array) ( $block['attrs'] ?? [] );

				if ( ! empty( $attrs['className'] ) && preg_match_all( '/\bis-style-([a-z0-9\-_]+)/i', (string) $attrs['className'], $matches ) ) {
					foreach ( $matches[1] as $style ) {
						$key                     = $name . '|' . $style;
						$stats['styles'][ $key ] = ( $stats['styles'][ $key ] ?? 0 ) + 1;
					}
				}

				if ( ! empty( $attrs['align'] ) && \is_string( $attrs['align'] ) ) {
					$key                     = $name . '|' . $attrs['align'];
					$stats['aligns'][ $key ] = ( $stats['aligns'][ $key ] ?? 0 ) + 1;
				}

				if ( 'core/block' === $name && ! empty( $attrs['ref'] ) ) {
					$stats['refs'][] = (int) $attrs['ref'];
				}
			}

			if ( ! empty( $block['innerBlocks'] ) ) {
				$this->walk( $block['innerBlocks'], $name ? $depth + 1 : $depth, $stats );
			}
		}
	}

	/**
	 * Enqueue the Block Index app. Runs on the page's load hook.
	 *
	 * @return void
	 */
	public function enqueue(): void {
		if ( ! Access::can_index() ) {
			wp_die( esc_html__( 'You don’t have access to the Block Index.', 'viget-parts-kit' ), '', [ 'response' => 403 ] );
		}

		$asset = Canvas::asset( 'block-index' );

		wp_enqueue_style( 'vgtpk-block-index', VGTPK_PLUGIN_URL . 'build/style-block-index.css', [], $asset['version'] );
		wp_add_inline_style( 'vgtpk-block-index', Colors::css( '.vgtpk-index' ) );
		wp_enqueue_script( 'vgtpk-block-index', VGTPK_PLUGIN_URL . 'build/block-index.js', $asset['dependencies'], $asset['version'], [ 'in_footer' => true ] );
		wp_set_script_translations( 'vgtpk-block-index', 'viget-parts-kit', VGTPK_PLUGIN_PATH . 'languages' );
		wp_add_inline_script(
			'vgtpk-block-index',
			'window.vgtpkBlockIndex = ' . wp_json_encode(
				[
					'restRoot'    => esc_url_raw( rest_url( Catalog::REST_NAMESPACE . '/' ) ),
					'nonce'       => wp_create_nonce( 'wp_rest' ),
					'partsKitUrl' => Post_Type::archive_url(),
					'siteName'    => get_bloginfo( 'name' ),
				]
			) . ';',
			'before'
		);
	}

	/**
	 * Render the admin page.
	 *
	 * @return void
	 */
	public function render_page(): void {
		require VGTPK_PLUGIN_PATH . 'views/admin/block-index.php';
	}
}
