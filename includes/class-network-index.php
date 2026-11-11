<?php
/**
 * Network Index class
 *
 * @package Viget\PartsKit
 */

namespace Viget\PartsKit;

use WP_REST_Response;
use WP_REST_Server;

/**
 * Rolls every site's Block Index up into one screen in Network Admin.
 *
 * Scans still run on each site, since block types, post types and templates come from that site's
 * theme and plugins. This reads what each site saved with its last scan.
 */
class Network_Index {

	/**
	 * Network admin page slug.
	 */
	const PAGE_SLUG = 'vgtpk-network-index';

	/**
	 * Constructor.
	 */
	public function __construct() {
		add_action( 'network_admin_menu', [ $this, 'menu' ] );
		add_action( 'rest_api_init', [ $this, 'register_routes' ] );
	}

	/**
	 * Add the network admin page.
	 *
	 * @return void
	 */
	public function menu(): void {
		$hook = add_menu_page(
			__( 'Block Index', 'viget-parts-kit' ),
			__( 'Block Index', 'viget-parts-kit' ),
			Admin::cap( Access::can_index_network() ),
			self::PAGE_SLUG,
			[ $this, 'render_page' ],
			'dashicons-screenoptions',
			25
		);

		if ( $hook ) {
			add_action( 'load-' . $hook, [ $this, 'enqueue' ] );
		}
	}

	/**
	 * Register REST routes.
	 *
	 * @return void
	 */
	public function register_routes(): void {
		register_rest_route(
			Catalog::REST_NAMESPACE,
			'/network/index',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'rest_get' ],
				'permission_callback' => static fn() => Access::can_index_network(),
			]
		);
	}

	/**
	 * Sites to include.
	 *
	 * @return array Site IDs.
	 */
	public static function site_ids(): array {
		$ids = get_sites(
			[
				'fields'   => 'ids',
				'number'   => 0,
				'archived' => 0,
				'deleted'  => 0,
				'spam'     => 0,
			]
		);

		/**
		 * Filters the sites the network Block Index reads.
		 *
		 * @param array $ids Site IDs.
		 */
		return array_values( array_map( 'intval', (array) apply_filters( 'vgtpk_network_index_sites', $ids ) ) );
	}

	/**
	 * Every site's saved index plus its scan status.
	 *
	 * @return WP_REST_Response
	 */
	public function rest_get(): WP_REST_Response {
		$plugin  = plugin_basename( VGTPK_PLUGIN_FILE );
		$network = isset( ( (array) get_site_option( 'active_sitewide_plugins', [] ) )[ $plugin ] );
		$sites   = [];
		$indexes = [];

		foreach ( self::site_ids() as $id ) {
			switch_to_blog( $id );

			$index   = get_option( Block_Index::OPTION_NAME, [] );
			$index   = \is_array( $index ) && ( $index['schema'] ?? 0 ) === Block_Index::SCHEMA ? $index : [];
			$context = $index['context'] ?? [];
			$active  = $network || \in_array( $plugin, (array) get_option( 'active_plugins', [] ), true );

			$sites[] = [
				'id'        => $id,
				'name'      => html_entity_decode( get_bloginfo( 'name' ), ENT_QUOTES, get_bloginfo( 'charset' ) ),
				'url'       => home_url( '/' ),
				'indexUrl'  => $active ? admin_url( 'edit.php?post_type=' . Post_Type::NAME . '&page=' . Block_Index::PAGE_SLUG ) : '',
				'active'    => $active,
				'scannedAt' => $index['scanned_at'] ?? null,
				// An index without context needs one more scan before it can be read here.
				'ready'     => (bool) $context,
				'changed'   => $context ? vgtpk()->block_index->count_changed( $index['scanned_at'], (array) ( $context['scanTypes'] ?? [] ) ) : null,
				'records'   => \count( $index['records'] ?? [] ),
			];

			if ( $context ) {
				$indexes[ $id ] = array_merge( $context, [ 'records' => array_values( $index['records'] ?? [] ) ] );
			}

			restore_current_blog();
		}

		return new WP_REST_Response(
			[
				'sites'   => $sites,
				'indexes' => (object) $indexes,
			]
		);
	}

	/**
	 * Enqueue the Block Index app in network mode.
	 *
	 * @return void
	 */
	public function enqueue(): void {
		if ( ! Access::can_index_network() ) {
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
					'network'  => true,
					'restRoot' => esc_url_raw( rest_url( Catalog::REST_NAMESPACE . '/' ) ),
					'nonce'    => wp_create_nonce( 'wp_rest' ),
					'siteName' => get_network()->site_name,
				]
			) . ';',
			'before'
		);
	}

	/**
	 * Render the network admin page.
	 *
	 * @return void
	 */
	public function render_page(): void {
		require VGTPK_PLUGIN_PATH . 'views/admin/block-index.php';
	}
}
