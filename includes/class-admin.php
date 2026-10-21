<?php
/**
 * Admin class
 *
 * @package Viget\PartsKit
 */

namespace Viget\PartsKit;

use WP_Admin_Bar;

/**
 * Admin menu, links and the admin bar shortcut.
 */
class Admin {

	/**
	 * Constructor.
	 */
	public function __construct() {
		add_action( 'admin_menu', [ $this, 'menu' ] );
		add_action( 'admin_bar_menu', [ $this, 'admin_bar' ], 80 );
		add_filter( 'plugin_action_links_' . plugin_basename( VGTPK_PLUGIN_FILE ), [ $this, 'action_links' ] );
	}

	/**
	 * Parent menu slug.
	 *
	 * @return string
	 */
	private static function parent(): string {
		return 'edit.php?post_type=' . Post_Type::NAME;
	}

	/**
	 * Add submenu pages under the post type menu.
	 *
	 * @return void
	 */
	public function menu(): void {
		$parent = self::parent();

		add_submenu_page(
			$parent,
			__( 'Open Parts Kit', 'viget-parts-kit' ),
			__( 'Open Parts Kit', 'viget-parts-kit' ),
			'read',
			Post_Type::archive_url(),
			'',
			0
		);

		$index_hook = add_submenu_page(
			$parent,
			__( 'Block Index', 'viget-parts-kit' ),
			__( 'Block Index', 'viget-parts-kit' ),
			'edit_others_posts',
			Block_Index::PAGE_SLUG,
			[ vgtpk()->block_index, 'render_page' ]
		);

		if ( $index_hook ) {
			add_action( 'load-' . $index_hook, [ vgtpk()->block_index, 'enqueue' ] );
		}

		add_submenu_page(
			$parent,
			__( 'Parts Kit Settings', 'viget-parts-kit' ),
			__( 'Settings', 'viget-parts-kit' ),
			'edit_theme_options',
			Settings::PAGE_SLUG,
			[ vgtpk()->settings, 'render_page' ]
		);
	}

	/**
	 * Shortcut to the Parts Kit in the admin bar, under the site name.
	 *
	 * @param WP_Admin_Bar $admin_bar Admin bar.
	 *
	 * @return void
	 */
	public function admin_bar( WP_Admin_Bar $admin_bar ): void {
		if ( ! current_user_can( (string) vgtpk()->settings->get( 'capability' ) ) ) {
			return;
		}

		$admin_bar->add_node(
			[
				'parent' => 'site-name',
				'id'     => 'vgtpk-parts-kit',
				'title'  => __( 'Parts Kit', 'viget-parts-kit' ),
				'href'   => Post_Type::archive_url(),
			]
		);
	}

	/**
	 * Links on the Plugins screen.
	 *
	 * @param array $links Action links.
	 *
	 * @return array
	 */
	public function action_links( array $links ): array {
		return array_merge(
			[
				'open'     => sprintf( '<a href="%s">%s</a>', esc_url( Post_Type::archive_url() ), esc_html__( 'Open Parts Kit', 'viget-parts-kit' ) ),
				'settings' => sprintf( '<a href="%s">%s</a>', esc_url( admin_url( self::parent() . '&page=' . Settings::PAGE_SLUG ) ), esc_html__( 'Settings', 'viget-parts-kit' ) ),
			],
			$links
		);
	}
}
