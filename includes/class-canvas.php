<?php
/**
 * Canvas class
 *
 * @package Viget\PartsKit
 */

namespace Viget\PartsKit;

use WP_Post;

/**
 * Renders samples or a QA page inside the theme's own styles, for the explorer's iframe.
 */
class Canvas {

	/**
	 * Query arg that switches a Parts Kit URL into canvas mode.
	 */
	const QUERY_ARG = 'vgtpk_canvas';

	/**
	 * Rendered body markup.
	 *
	 * @var string
	 */
	public string $content = '';

	/**
	 * Title for the document.
	 *
	 * @var string
	 */
	public string $title = '';

	/**
	 * Classes for the main element.
	 *
	 * @var array
	 */
	public array $main_classes = [];

	/**
	 * Whether this request is a canvas render.
	 *
	 * @return bool
	 */
	public static function is_canvas_request(): bool {
		return isset( $_GET[ self::QUERY_ARG ] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only view switch.
	}

	/**
	 * Canvas URL for a catalog item or QA page.
	 *
	 * @param array $args Query args.
	 *
	 * @return string
	 */
	public static function url( array $args = [] ): string {
		return Post_Type::archive_url( array_merge( [ self::QUERY_ARG => 1 ], $args ) );
	}

	/**
	 * Read a request arg.
	 *
	 * @param string $key     Arg name.
	 * @param string $fallback Fallback.
	 *
	 * @return string
	 */
	private static function arg( string $key, string $fallback = '' ): string {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only view options.
		return isset( $_GET[ $key ] ) ? sanitize_text_field( wp_unslash( $_GET[ $key ] ) ) : $fallback;
	}

	/**
	 * Prepare the canvas and return its template.
	 *
	 * Rendering happens here, before wp_head, so block styles enqueue into the head.
	 *
	 * @return string
	 */
	public function template(): string {
		// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- Kept from 1.x; themes check it.
		defined( 'IS_PARTS_KIT' ) || define( 'IS_PARTS_KIT', true );

		$this->disable_admin_bar();
		vgtpk()->sample_data->enable_render_filters();

		$context = self::arg( 'ctx', 'none' );
		$context = \array_key_exists( $context, self::contexts() ) ? $context : 'none';
		$labels  = '0' !== self::arg( 'labels', '1' );

		if ( is_singular( Post_Type::NAME ) ) {
			$this->prepare_page( get_queried_object() );
		} else {
			$this->prepare_item( self::arg( 'item' ), self::arg( 'sample' ), $context, $labels );
		}

		$this->main_classes = [ 'vgtpk-canvas__main' ];

		if ( wp_is_block_theme() ) {
			$this->main_classes[] = 'is-layout-constrained';
			$this->main_classes[] = 'has-global-padding';
		}

		$background = sanitize_title( self::arg( 'bg' ) );
		if ( $background ) {
			$this->main_classes[] = 'has-background';
			$this->main_classes[] = 'has-' . $background . '-background-color';
		}

		add_filter( 'body_class', [ $this, 'body_class' ] );
		add_action( 'wp_enqueue_scripts', [ $this, 'enqueue' ], 99 );
		add_action( 'wp_enqueue_scripts', [ $this, 'dequeue_plugin_scripts' ], PHP_INT_MAX );
		$this->remove_plugin_output();

		return VGTPK_PLUGIN_PATH . 'views/canvas.php';
	}

	/**
	 * Render a QA page.
	 *
	 * @param mixed $post The queried post.
	 *
	 * @return void
	 */
	private function prepare_page( mixed $post ): void {
		if ( ! $post instanceof WP_Post ) {
			return;
		}

		/** This action is documented in includes/class-canvas.php */
		do_action( 'vgtpk_canvas_render', $post );

		$this->title = get_the_title( $post );

		if ( post_password_required( $post ) ) {
			$this->content = get_the_password_form( $post );
			return;
		}

		setup_postdata( $GLOBALS['post'] = $post ); // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited, Squiz.PHP.DisallowMultipleAssignments.Found -- The canvas is the loop for this post.

		// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Core filter.
		$this->content = (string) apply_filters( 'the_content', $post->post_content );
	}

	/**
	 * Render a catalog item's samples.
	 *
	 * @param string $id      Item ID.
	 * @param string $sample  Optional sample key to render alone.
	 * @param string $context Layout context.
	 * @param bool   $labels  Whether to label each sample.
	 *
	 * @return void
	 */
	private function prepare_item( string $id, string $sample, string $context, bool $labels ): void {
		$item = $id ? vgtpk()->catalog->get_item( Catalog::sanitize_id( $id ) ) : null;

		if ( ! $item ) {
			$this->title   = __( 'Parts Kit', 'viget-parts-kit' );
			$this->content = sprintf(
				'<p class="vgtpk-empty">%s</p>',
				esc_html__( 'Choose a block from the list to see it here.', 'viget-parts-kit' )
			);
			return;
		}

		/**
		 * Fires before a Parts Kit canvas renders.
		 *
		 * @param array|WP_Post $subject The catalog item, or the QA page.
		 */
		do_action( 'vgtpk_canvas_render', $item );

		$this->title = $item['title'];
		$samples     = $item['samples'];

		if ( $sample ) {
			$samples = array_values( array_filter( $samples, static fn( $s ) => $s['key'] === $sample ) );
		}

		$markup = '';

		foreach ( $samples as $entry ) {
			$block = $this->wrap( $entry['markup'], $context );

			/**
			 * Filters a sample's block markup before it renders.
			 *
			 * @param string $block  Block markup.
			 * @param array  $entry  The sample.
			 * @param array  $item   The catalog item.
			 */
			$block = (string) apply_filters( 'vgtpk_sample_markup', $block, $entry, $item );

			$markup .= sprintf(
				'<div class="vgtpk-label%s" id="vgtpk-sample-%s" data-vgtpk-sample="%s"><span class="vgtpk-label__name">%s</span>%s</div>',
				$labels ? '' : ' is-hidden',
				esc_attr( $entry['key'] ),
				esc_attr( $entry['key'] ),
				esc_html( $entry['label'] ),
				$entry['description'] ? '<span class="vgtpk-label__description">' . esc_html( $entry['description'] ) . '</span>' : ''
			);
			$markup .= "\n\n" . $block . "\n\n";
		}

		if ( $this->needs_post_context( $markup ) ) {
			$this->setup_context_post();
		}

		add_filter( 'render_block', [ $this, 'render_empty_as_preview' ], 10, 3 );

		// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Core filter, so samples render exactly as on a real page.
		$this->content = (string) apply_filters( 'the_content', $markup );
	}

	/**
	 * Layout contexts a sample can be wrapped in.
	 *
	 * @return array<string, array{label: string, markup: string}>
	 */
	public static function contexts(): array {
		$column  = '<!-- wp:column --><div class="wp-block-column">%s</div><!-- /wp:column -->';
		$columns = '<!-- wp:columns --><div class="wp-block-columns">%s</div><!-- /wp:columns -->';
		$narrow  = '<!-- wp:column {"width":"%1$s"} --><div class="wp-block-column" style="flex-basis:%1$s">%2$s</div><!-- /wp:column -->';
		$padding = 'var(--wp--preset--spacing--50)';

		$contexts = [
			'none'      => [
				'label'  => __( 'None', 'viget-parts-kit' ),
				'markup' => '{{block}}',
			],
			'group'     => [
				'label'  => __( 'Padded group', 'viget-parts-kit' ),
				'markup' => '<!-- wp:group {"style":{"spacing":{"padding":{"top":"var:preset|spacing|50","bottom":"var:preset|spacing|50","left":"var:preset|spacing|50","right":"var:preset|spacing|50"}}},"layout":{"type":"constrained"}} --><div class="wp-block-group" style="padding-top:' . $padding . ';padding-right:' . $padding . ';padding-bottom:' . $padding . ';padding-left:' . $padding . '">{{block}}</div><!-- /wp:group -->',
			],
			'columns-2' => [
				'label'  => __( 'Two columns', 'viget-parts-kit' ),
				'markup' => sprintf( $columns, sprintf( $column, '{{block}}' ) . sprintf( $column, '{{filler}}' ) ),
			],
			'columns-3' => [
				'label'  => __( 'Three columns', 'viget-parts-kit' ),
				'markup' => sprintf( $columns, sprintf( $column, '{{block}}' ) . sprintf( $column, '{{filler}}' ) . sprintf( $column, '{{filler}}' ) ),
			],
			'sidebar'   => [
				'label'  => __( 'Narrow sidebar', 'viget-parts-kit' ),
				'markup' => sprintf( $columns, sprintf( $narrow, '66.66%', '{{filler}}' ) . sprintf( $narrow, '33.33%', '{{block}}' ) ),
			],
		];

		/**
		 * Filters the layouts a sample can be shown inside. Add one for your theme's
		 * containers, like a card or a dark section.
		 *
		 * @param array $contexts Slug => `label` and `markup`. In the markup, `{{block}}` is
		 *                        replaced with the sample and `{{filler}}` with a paragraph.
		 */
		$contexts = (array) apply_filters( 'vgtpk_contexts', $contexts );

		$contexts['none'] = $contexts['none'] ?? [
			'label'  => __( 'None', 'viget-parts-kit' ),
			'markup' => '{{block}}',
		];

		return $contexts;
	}

	/**
	 * Wrap block markup in a layout context.
	 *
	 * @param string $markup  Block markup.
	 * @param string $context Context slug.
	 *
	 * @return string
	 */
	public function wrap( string $markup, string $context ): string {
		$contexts = self::contexts();
		$template = $contexts[ $context ]['markup'] ?? '{{block}}';
		$filler   = '<!-- wp:paragraph --><p>' . esc_html( vgtpk()->sample_data->content()['filler'] ?? '' ) . '</p><!-- /wp:paragraph -->';

		return strtr(
			$template,
			[
				'{{block}}'  => $markup,
				'{{filler}}' => $filler,
			]
		);
	}

	/**
	 * Whether markup has blocks that read the current post.
	 *
	 * @param string $markup Block markup.
	 *
	 * @return bool
	 */
	private function needs_post_context( string $markup ): bool {
		return (bool) preg_match( '/<!-- wp:(post-|query|read-more|comment|avatar|footnotes|term-)/', $markup );
	}

	/**
	 * Make the latest post current, so post blocks have something real to show.
	 *
	 * Only done when a sample needs it. Embeds rendered against a real post cache into its meta.
	 *
	 * @return void
	 */
	private function setup_context_post(): void {
		$posts = get_posts(
			[
				'post_type'      => 'post',
				'posts_per_page' => 1,
				'no_found_rows'  => true,
			]
		);

		/**
		 * Filters the post used for post-context blocks like Post Title.
		 *
		 * @param WP_Post|null $post The latest post.
		 */
		$post = apply_filters( 'vgtpk_context_post', $posts[0] ?? null );

		if ( $post instanceof WP_Post ) {
			setup_postdata( $GLOBALS['post'] = $post ); // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited, Squiz.PHP.DisallowMultipleAssignments.Found -- Context for post blocks.
		}
	}

	/**
	 * Render a dynamic block that came out empty again the way the editor would, so blocks that
	 * only show sample content in the editor (an is_admin() or $is_preview check) still show something.
	 *
	 * @param string $content Rendered block.
	 * @param array  $parsed  Parsed block.
	 * @param mixed  $block   Block instance, a WP_Block.
	 *
	 * @return string
	 */
	public function render_empty_as_preview( string $content, array $parsed, mixed $block = null ): string {
		static $rendering = false;

		if ( $rendering || '' !== trim( $content ) || ! $block instanceof \WP_Block || ! $block->block_type?->is_dynamic() ) {
			return $content;
		}

		$rendering = true;
		$screen    = $GLOBALS['current_screen'] ?? null;

		try {
			$GLOBALS['current_screen'] = self::admin_screen(); // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Restored below.

			$content = (string) $block->render();

			if ( '' === trim( $content ) && str_starts_with( $block->name, 'acf/' ) && function_exists( 'acf_rendered_block' ) ) {
				$inner = implode( '', array_map( static fn( $inner_block ) => $inner_block->render(), iterator_to_array( $block->inner_blocks ) ) );
				$html  = (string) acf_rendered_block( array_merge( $block->attributes, [ 'name' => $block->name ] ), $inner, true, (int) get_the_ID(), $block );

				$content = function_exists( 'acf_replace_inner_blocks_in_block_content' ) ? (string) acf_replace_inner_blocks_in_block_content( $inner, $html ) : $html;
			}
		} catch ( \Throwable $error ) {
			$content = '';
		} finally {
			$GLOBALS['current_screen'] = $screen; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Restoring.
			$rendering                 = false;
		}

		return $content;
	}

	/**
	 * A front-end stand-in for an admin screen, so is_admin() is true while it's current.
	 *
	 * @return object
	 */
	private static function admin_screen(): object {
		if ( ! class_exists( 'WP_Screen' ) ) {
			require_once ABSPATH . 'wp-admin/includes/class-wp-screen.php';
		}

		return \WP_Screen::get( 'vgtpk-canvas' );
	}

	/**
	 * Keep plugins from adding things like cookie banners, chat widgets and analytics to the canvas.
	 * Removes plugin callbacks from wp_head, wp_body_open and wp_footer. Core, the theme and block assets stay.
	 *
	 * @return void
	 */
	private function remove_plugin_output(): void {
		global $wp_filter;

		foreach ( [ 'wp_head', 'wp_body_open', 'wp_footer' ] as $hook ) {
			if ( empty( $wp_filter[ $hook ] ) ) {
				continue;
			}

			foreach ( $wp_filter[ $hook ]->callbacks as $priority => $callbacks ) {
				foreach ( $callbacks as $callback ) {
					if ( self::is_plugin_callback( $callback['function'], $hook ) ) {
						remove_action( $hook, $callback['function'], $priority );
					}
				}
			}
		}
	}

	/**
	 * Dequeue plugin scripts that no registered block uses.
	 *
	 * @return void
	 */
	public function dequeue_plugin_scripts(): void {
		$scripts = wp_scripts();
		$keep    = [];

		foreach ( \WP_Block_Type_Registry::get_instance()->get_all_registered() as $type ) {
			$keep = array_merge( $keep, (array) $type->script_handles, (array) $type->view_script_handles );
		}

		foreach ( $scripts->queue as $handle ) {
			$src = (string) ( $scripts->registered[ $handle ]->src ?? '' );

			if ( \in_array( $handle, $keep, true ) || ! self::is_plugin_url( $src ) ) {
				continue;
			}

			/**
			 * Filters whether a plugin script stays on the canvas.
			 *
			 * @param bool   $keep   Whether to keep it. Defaults to false.
			 * @param string $handle Script handle.
			 */
			if ( ! apply_filters( 'vgtpk_canvas_keep_script', false, $handle ) ) {
				wp_dequeue_script( $handle );
			}
		}
	}

	/**
	 * Whether a URL points into the plugins or mu-plugins folder, other than this plugin.
	 *
	 * @param string $url URL.
	 *
	 * @return bool
	 */
	private static function is_plugin_url( string $url ): bool {
		if ( '' === $url || str_starts_with( $url, VGTPK_PLUGIN_URL ) ) {
			return false;
		}

		return str_starts_with( $url, WP_PLUGIN_URL ) || str_starts_with( $url, WPMU_PLUGIN_URL );
	}

	/**
	 * Whether a hook callback is defined in another plugin or an mu-plugin.
	 *
	 * @param mixed  $callback Callback.
	 * @param string $hook     Hook name.
	 *
	 * @return bool
	 */
	private static function is_plugin_callback( mixed $callback, string $hook ): bool {
		try {
			if ( \is_string( $callback ) && str_contains( $callback, '::' ) ) {
				$callback = explode( '::', $callback, 2 );
			}

			if ( \is_array( $callback ) ) {
				$reflection = new \ReflectionMethod( $callback[0], $callback[1] );
			} elseif ( \is_object( $callback ) && ! $callback instanceof \Closure ) {
				$reflection = new \ReflectionMethod( $callback, '__invoke' );
			} else {
				$reflection = new \ReflectionFunction( $callback );
			}
		} catch ( \ReflectionException $error ) {
			return false;
		}

		$file = wp_normalize_path( (string) $reflection->getFileName() );

		if ( '' === $file || str_starts_with( $file, wp_normalize_path( VGTPK_PLUGIN_PATH ) ) ) {
			return false;
		}

		$is_plugin = str_starts_with( $file, wp_normalize_path( WP_PLUGIN_DIR ) . '/' ) || str_starts_with( $file, wp_normalize_path( WPMU_PLUGIN_DIR ) . '/' );

		/**
		 * Filters whether a plugin's wp_head, wp_body_open or wp_footer callback is removed from the canvas.
		 *
		 * @param bool   $remove   Whether to remove it. True for anything defined in a plugin or mu-plugin.
		 * @param mixed  $callback Callback.
		 * @param string $hook     Hook name.
		 * @param string $file     File the callback is defined in.
		 */
		return (bool) apply_filters( 'vgtpk_canvas_remove_callback', $is_plugin, $callback, $hook, $file );
	}

	/**
	 * Hide the admin bar inside the iframe.
	 *
	 * @return void
	 */
	private function disable_admin_bar(): void {
		add_filter( 'show_admin_bar', '__return_false' );
	}

	/**
	 * Add a body class.
	 *
	 * @param array $classes Body classes.
	 *
	 * @return array
	 */
	public function body_class( array $classes ): array {
		$classes[] = 'vgtpk-canvas';
		return $classes;
	}

	/**
	 * Enqueue the canvas helper styles and script.
	 *
	 * @return void
	 */
	public function enqueue(): void {
		$asset = self::asset( 'canvas' );

		wp_enqueue_style( 'vgtpk-canvas', VGTPK_PLUGIN_URL . 'build/style-canvas.css', [], $asset['version'] );
		wp_enqueue_script( 'vgtpk-canvas', VGTPK_PLUGIN_URL . 'build/canvas.js', $asset['dependencies'], $asset['version'], [ 'in_footer' => true ] );
	}

	/**
	 * Read a build asset file.
	 *
	 * @param string $name Entry name.
	 *
	 * @return array{dependencies: array, version: string}
	 */
	public static function asset( string $name ): array {
		$file  = VGTPK_PLUGIN_PATH . 'build/' . $name . '.asset.php';
		$asset = is_file( $file ) ? require $file : [];

		return [
			'dependencies' => $asset['dependencies'] ?? [],
			'version'      => $asset['version'] ?? VGTPK_VERSION,
		];
	}
}
