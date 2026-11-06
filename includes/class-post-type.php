<?php
/**
 * Post Type class
 *
 * @package Viget\PartsKit
 */

namespace Viget\PartsKit;

use WP_Query;

/**
 * Registers the Parts Kit post type and routes its archive and singles.
 */
class Post_Type {

	/**
	 * Post type name.
	 */
	const NAME = 'vgtpk_part';

	/**
	 * Constructor.
	 */
	public function __construct() {
		add_action( 'init', [ $this, 'register' ] );
		add_action( 'pre_get_posts', [ $this, 'trim_archive_query' ] );
		add_filter( 'template_include', [ $this, 'template_include' ], 999 );
		add_filter( 'wp_robots', [ $this, 'robots' ] );
		add_filter( 'wp_sitemaps_post_types', [ $this, 'remove_from_sitemaps' ] );
		add_filter( 'rank_math/sitemap/exclude_post_type', [ $this, 'exclude_from_seo_sitemap' ], 10, 2 );
		add_filter( 'wpseo_sitemap_exclude_post_type', [ $this, 'exclude_from_seo_sitemap' ], 10, 2 );
	}

	/**
	 * The URL slug for the archive and singles.
	 *
	 * @return string
	 */
	public static function slug(): string {
		/**
		 * Filters the Parts Kit URL slug. Flush rewrite rules after changing it.
		 *
		 * @param string $slug Defaults to `parts-kit`.
		 */
		return sanitize_title( apply_filters( 'vgtpk_slug', 'parts-kit' ) );
	}

	/**
	 * The Parts Kit archive URL.
	 *
	 * @param array $args Optional query args.
	 *
	 * @return string
	 */
	public static function archive_url( array $args = [] ): string {
		$url = get_post_type_archive_link( self::NAME );
		$url = $url ? $url : home_url( '/' . self::slug() . '/' );

		return $args ? add_query_arg( $args, $url ) : $url;
	}

	/**
	 * Register the post type.
	 *
	 * @return void
	 */
	public function register(): void {
		if ( post_type_exists( self::NAME ) ) {
			return;
		}

		register_post_type(
			self::NAME,
			[
				'labels'              => [
					'name'               => __( 'Parts Kit', 'viget-parts-kit' ),
					'singular_name'      => __( 'Parts Kit Page', 'viget-parts-kit' ),
					'menu_name'          => __( 'Parts Kit', 'viget-parts-kit' ),
					'all_items'          => __( 'QA Pages', 'viget-parts-kit' ),
					'add_new'            => __( 'Add QA Page', 'viget-parts-kit' ),
					'add_new_item'       => __( 'Add QA Page', 'viget-parts-kit' ),
					'edit_item'          => __( 'Edit QA Page', 'viget-parts-kit' ),
					'new_item'           => __( 'New QA Page', 'viget-parts-kit' ),
					'view_item'          => __( 'View in Parts Kit', 'viget-parts-kit' ),
					'view_items'         => __( 'Open Parts Kit', 'viget-parts-kit' ),
					'search_items'       => __( 'Search QA pages', 'viget-parts-kit' ),
					'not_found'          => __( 'No QA pages yet. Add one to demo a kitchen sink or a specific block setup.', 'viget-parts-kit' ),
					'not_found_in_trash' => __( 'No QA pages in the trash.', 'viget-parts-kit' ),
					'parent_item_colon'  => __( 'Parent page:', 'viget-parts-kit' ),
				],
				'description'         => __( 'QA pages, kitchen sinks and block demos shown in the Parts Kit.', 'viget-parts-kit' ),
				'public'              => true,
				'exclude_from_search' => true,
				'show_in_nav_menus'   => false,
				'show_in_admin_bar'   => false,
				'show_in_rest'        => true,
				'hierarchical'        => true,
				'menu_position'       => 58,
				'menu_icon'           => 'dashicons-screenoptions',
				'capability_type'     => 'page',
				'map_meta_cap'        => true,
				'supports'            => [ 'title', 'editor', 'page-attributes', 'revisions', 'excerpt' ],
				'has_archive'         => self::slug(),
				'rewrite'             => [
					'slug'       => self::slug(),
					'with_front' => false,
					'feeds'      => false,
				],
				'query_var'           => self::slug(),
			]
		);
	}

	/**
	 * The archive renders the explorer, not a post loop, so skip loading posts.
	 *
	 * @param WP_Query $query The query.
	 *
	 * @return void
	 */
	public function trim_archive_query( WP_Query $query ): void {
		if ( is_admin() || ! $query->is_main_query() || ! $query->is_post_type_archive( self::NAME ) ) {
			return;
		}

		$query->set( 'posts_per_page', 1 );
		$query->set( 'no_found_rows', true );
		$query->set( 'update_post_meta_cache', false );
		$query->set( 'update_post_term_cache', false );
	}

	/**
	 * Whether this request is a Parts Kit screen.
	 *
	 * @return bool
	 */
	public static function is_parts_kit_request(): bool {
		return is_post_type_archive( self::NAME ) || is_singular( self::NAME );
	}

	/**
	 * Swap in the explorer or canvas template.
	 *
	 * @param string $template The template WordPress chose.
	 *
	 * @return string
	 */
	public function template_include( string $template ): string {
		if ( ! self::is_parts_kit_request() ) {
			return $template;
		}

		Access::guard();

		if ( Canvas::is_canvas_request() ) {
			return vgtpk()->canvas->template();
		}

		return vgtpk()->explorer->template();
	}

	/**
	 * Keep Parts Kit screens out of search engines.
	 *
	 * @param array $robots Robots directives.
	 *
	 * @return array
	 */
	public function robots( array $robots ): array {
		if ( ! self::is_parts_kit_request() ) {
			return $robots;
		}

		$robots['noindex']  = true;
		$robots['nofollow'] = true;

		return $robots;
	}

	/**
	 * Remove the post type from core sitemaps.
	 *
	 * @param array $post_types Post types in the sitemap.
	 *
	 * @return array
	 */
	public function remove_from_sitemaps( array $post_types ): array {
		unset( $post_types[ self::NAME ] );
		return $post_types;
	}

	/**
	 * Remove the post type from Rank Math and Yoast sitemaps.
	 *
	 * @param bool   $exclude   Whether to exclude.
	 * @param string $post_type Post type name.
	 *
	 * @return bool
	 */
	public function exclude_from_seo_sitemap( $exclude, $post_type ): bool {
		return self::NAME === $post_type ? true : (bool) $exclude;
	}

	/**
	 * QA pages for the explorer nav, in menu order.
	 *
	 * @return array
	 */
	public static function get_pages(): array {
		$statuses = [ 'publish', 'private' ];

		if ( current_user_can( 'edit_pages' ) ) {
			$statuses = [ 'publish', 'private', 'draft', 'pending', 'future' ];
		}

		$posts = get_posts(
			[
				'post_type'              => self::NAME,
				'post_status'            => $statuses,
				'posts_per_page'         => 200, // phpcs:ignore WordPress.WP.PostsPerPage.posts_per_page_posts_per_page -- QA pages number in the dozens; capped anyway.
				'orderby'                => [
					'menu_order' => 'ASC',
					'title'      => 'ASC',
				],
				'no_found_rows'          => true,
				'update_post_meta_cache' => false,
				'update_post_term_cache' => false,
			]
		);

		return array_map(
			static fn( $post ) => [
				'id'          => $post->ID,
				'title'       => get_the_title( $post ) ? get_the_title( $post ) : __( '(no title)', 'viget-parts-kit' ),
				'slug'        => $post->post_name,
				'parent'      => $post->post_parent,
				'status'      => $post->post_status,
				'description' => wp_strip_all_tags( $post->post_excerpt ),
				'url'         => get_permalink( $post ),
				'editUrl'     => current_user_can( 'edit_post', $post->ID ) ? get_edit_post_link( $post->ID, 'raw' ) : '',
				'blocks'      => \count( array_filter( parse_blocks( $post->post_content ), static fn( $block ) => ! empty( $block['blockName'] ) ) ),
				'modified'    => get_post_modified_time( 'c', true, $post ),
			],
			$posts
		);
	}
}
