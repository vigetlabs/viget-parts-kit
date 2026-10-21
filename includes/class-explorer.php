<?php
/**
 * Explorer class
 *
 * @package Viget\PartsKit
 */

namespace Viget\PartsKit;

/**
 * The Parts Kit explorer: a block that only renders on the Parts Kit archive and QA pages.
 */
class Explorer {

	/**
	 * Explorer block name.
	 */
	const BLOCK_NAME = 'viget-parts-kit/explorer';

	/**
	 * Query var for the legacy @viget/parts-kit JSON config.
	 */
	const JSON_QUERY_VAR = 'vgtpk_json';

	/**
	 * Constructor.
	 */
	public function __construct() {
		add_action( 'init', [ $this, 'register_block' ] );
		add_action( 'init', [ $this, 'add_json_rewrite' ] );
		add_filter( 'query_vars', [ $this, 'query_vars' ] );
		add_action( 'template_redirect', [ $this, 'render_json' ] );
	}

	/**
	 * Register the explorer block. Server-side only, hidden from the inserter.
	 *
	 * @return void
	 */
	public function register_block(): void {
		register_block_type(
			self::BLOCK_NAME,
			[
				'api_version'     => 3,
				'title'           => __( 'Parts Kit Explorer', 'viget-parts-kit' ),
				'category'        => 'widgets',
				'supports'        => [
					'inserter' => false,
					'html'     => false,
					'reusable' => false,
					'multiple' => false,
				],
				'render_callback' => [ $this, 'render_block' ],
			]
		);
	}

	/**
	 * Render the explorer mount point. Empty anywhere but the Parts Kit.
	 *
	 * @return string
	 */
	public function render_block(): string {
		if ( ! Post_Type::is_parts_kit_request() || Canvas::is_canvas_request() || ! Access::can_view() ) {
			return '';
		}

		$this->enqueue();

		return sprintf(
			'<div id="vgtpk-explorer" class="vgtpk-explorer"><noscript>%s</noscript></div><script type="application/json" id="vgtpk-explorer-data">%s</script>',
			esc_html__( 'The Parts Kit needs JavaScript.', 'viget-parts-kit' ),
			wp_json_encode( $this->get_data(), JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES )
		);
	}

	/**
	 * The explorer document template.
	 *
	 * @return string
	 */
	public function template(): string {
		show_admin_bar( false );
		return VGTPK_PLUGIN_PATH . 'views/explorer.php';
	}

	/**
	 * Enqueue the explorer app.
	 *
	 * @return void
	 */
	public function enqueue(): void {
		$asset = Canvas::asset( 'explorer' );

		wp_enqueue_style( 'vgtpk-explorer', VGTPK_PLUGIN_URL . 'build/style-explorer.css', [ 'dashicons' ], $asset['version'] );
		wp_add_inline_style( 'vgtpk-explorer', Colors::css( ':root' ) );
		wp_enqueue_script( 'vgtpk-explorer', VGTPK_PLUGIN_URL . 'build/explorer.js', $asset['dependencies'], $asset['version'], [ 'in_footer' => true ] );
		wp_set_script_translations( 'vgtpk-explorer', 'viget-parts-kit', VGTPK_PLUGIN_PATH . 'languages' );
	}

	/**
	 * Data the explorer boots with.
	 *
	 * @return array
	 */
	public function get_data(): array {
		$catalog = vgtpk()->catalog;
		$queried = is_singular( Post_Type::NAME ) ? get_queried_object_id() : 0;
		$palette = wp_get_global_settings( [ 'color', 'palette' ] );
		$colors  = [];

		foreach ( [ 'theme', 'custom', 'default' ] as $origin ) {
			if ( ! empty( $palette[ $origin ] ) ) {
				$colors = $palette[ $origin ];
				break;
			}
		}

		$manage = Access::can_manage();

		return [
			'version'    => VGTPK_VERSION,
			'site'       => [
				'name'  => get_bloginfo( 'name' ),
				'url'   => home_url( '/' ),
				'admin' => admin_url(),
			],
			'archiveUrl' => Post_Type::archive_url(),
			'canvasUrl'  => Canvas::url(),
			'nav'        => $catalog->get_nav(),
			'pages'      => Post_Type::get_pages(),
			'palette'    => array_values(
				array_map(
					static fn( $color ) => [
						'slug'  => $color['slug'] ?? '',
						'name'  => $color['name'] ?? '',
						'color' => $color['color'] ?? '',
					],
					array_filter( (array) $colors, static fn( $color ) => ! empty( $color['slug'] ) )
				)
			),
			'status'     => $manage || ! $catalog->exists() ? $catalog->status() : [
				'exists'      => true,
				'stale'       => false,
				'generatedAt' => $catalog->get()['generated_at'] ?? null,
				'count'       => \count( $catalog->get()['items'] ?? [] ),
			],
			'can'        => [
				'manage'    => $manage,
				'editPages' => current_user_can( 'publish_pages' ),
				'index'     => Access::can_index(),
			],
			'urls'       => [
				'generator'  => $manage ? Generator::url() : '',
				'newPage'    => current_user_can( 'publish_pages' ) ? admin_url( 'post-new.php?post_type=' . Post_Type::NAME ) : '',
				'pages'      => current_user_can( 'edit_pages' ) ? admin_url( 'edit.php?post_type=' . Post_Type::NAME ) : '',
				'blockIndex' => Access::can_index() ? admin_url( 'edit.php?post_type=' . Post_Type::NAME . '&page=' . Block_Index::PAGE_SLUG ) : '',
				'settings'   => $manage ? admin_url( 'edit.php?post_type=' . Post_Type::NAME . '&page=' . Settings::PAGE_SLUG ) : '',
			],
			'rest'       => [
				'root'  => esc_url_raw( rest_url( Catalog::REST_NAMESPACE . '/' ) ),
				'nonce' => is_user_logged_in() ? wp_create_nonce( 'wp_rest' ) : '',
			],
			'initial'    => [
				'page' => $queried,
			],
			'features'   => self::features(),
		];
	}

	/**
	 * Which explorer controls are on, and their defaults.
	 *
	 * @return array
	 */
	public static function features(): array {
		$contexts = [];
		foreach ( Canvas::contexts() as $slug => $context ) {
			$contexts[] = [
				'slug'  => (string) $slug,
				'label' => (string) ( $context['label'] ?? $slug ),
			];
		}

		$defaults = [
			'search'       => true,
			'qaPages'      => true,
			'home'         => true,
			'viewports'    => [
				[
					'slug'  => 'mobile',
					'label' => __( 'Mobile', 'viget-parts-kit' ),
					'width' => 390,
				],
				[
					'slug'  => 'tablet',
					'label' => __( 'Tablet', 'viget-parts-kit' ),
					'width' => 820,
				],
				[
					'slug'  => 'desktop',
					'label' => __( 'Desktop', 'viget-parts-kit' ),
					'width' => 1280,
				],
				[
					'slug'  => 'full',
					'label' => __( 'Fill', 'viget-parts-kit' ),
					'width' => null,
				],
			],
			'resize'       => true,
			'backgrounds'  => true,
			'contexts'     => $contexts,
			'labels'       => true,
			'details'      => true,
			'copyMarkup'   => true,
			'createPage'   => true,
			'openInNewTab' => true,
			'blockIndex'   => true,
			'autoRebuild'  => true,
			'keyboard'     => true,
			'defaults'     => [
				'viewport' => 'full',
				'bg'       => '',
				'ctx'      => 'none',
				'labels'   => true,
			],
		];

		/**
		 * Filters which explorer controls show, and their starting values.
		 *
		 * Set any control to false to hide it. `viewports` and `contexts` take lists
		 * (or false); `backgrounds` takes true, false, or a list of palette slugs to offer.
		 * `defaults` sets the starting viewport, background, context and labels.
		 *
		 * @param array $features Features.
		 */
		$features = (array) apply_filters( 'vgtpk_explorer_features', $defaults );

		$features['defaults'] = array_merge( $defaults['defaults'], (array) ( $features['defaults'] ?? [] ) );

		return array_merge( $defaults, $features );
	}

	/**
	 * Rewrite for /parts-kit.json.
	 *
	 * @return void
	 */
	public function add_json_rewrite(): void {
		add_rewrite_rule( '^' . preg_quote( Post_Type::slug(), '/' ) . '\.json$', 'index.php?' . self::JSON_QUERY_VAR . '=1', 'top' );
	}

	/**
	 * Register the JSON query var.
	 *
	 * @param array $vars Query vars.
	 *
	 * @return array
	 */
	public function query_vars( array $vars ): array {
		$vars[] = self::JSON_QUERY_VAR;
		return $vars;
	}

	/**
	 * Serve a config for the standalone @viget/parts-kit viewer, pointing at canvas URLs.
	 *
	 * @return void
	 */
	public function render_json(): void {
		if ( ! get_query_var( self::JSON_QUERY_VAR ) ) {
			return;
		}

		Access::guard();

		$nav = [];

		foreach ( vgtpk()->catalog->get_nav() as $category ) {
			$nav[] = [
				'title'    => $category['title'],
				'url'      => '',
				'children' => array_map(
					static fn( $item ) => [
						'title'    => $item['title'],
						'url'      => Canvas::url( [ 'item' => $item['id'] ] ),
						'children' => array_map(
							static fn( $child ) => [
								'title'    => $child['title'],
								'url'      => Canvas::url( [ 'item' => $child['id'] ] ),
								'children' => [],
							],
							$item['children']
						),
					],
					$category['items']
				),
			];
		}

		$pages = Post_Type::get_pages();
		if ( $pages ) {
			$nav[] = [
				'title'    => __( 'QA Pages', 'viget-parts-kit' ),
				'url'      => '',
				'children' => array_map(
					static fn( $page ) => [
						'title'    => $page['title'],
						'url'      => add_query_arg( Canvas::QUERY_ARG, 1, $page['url'] ),
						'children' => [],
					],
					$pages
				),
			];
		}

		/**
		 * Filters the nav served at /parts-kit.json. Kept from 1.x.
		 *
		 * @param array $nav Nav items in the @viget/parts-kit schema.
		 */
		$nav = apply_filters( 'vgtpk_parts_kit', $nav );

		nocache_headers();
		wp_send_json(
			[
				'schemaVersion' => '0.0.1',
				'nav'           => array_values( $nav ),
			]
		);
	}
}
