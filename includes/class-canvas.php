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
				'label'  => __( 'On its own', 'viget-parts-kit' ),
				'markup' => '{{block}}',
			],
			'group'     => [
				'label'  => __( 'In a padded group', 'viget-parts-kit' ),
				'markup' => '<!-- wp:group {"style":{"spacing":{"padding":{"top":"var:preset|spacing|50","bottom":"var:preset|spacing|50","left":"var:preset|spacing|50","right":"var:preset|spacing|50"}}},"layout":{"type":"constrained"}} --><div class="wp-block-group" style="padding-top:' . $padding . ';padding-right:' . $padding . ';padding-bottom:' . $padding . ';padding-left:' . $padding . '">{{block}}</div><!-- /wp:group -->',
			],
			'columns-2' => [
				'label'  => __( 'In two columns', 'viget-parts-kit' ),
				'markup' => sprintf( $columns, sprintf( $column, '{{block}}' ) . sprintf( $column, '{{filler}}' ) ),
			],
			'columns-3' => [
				'label'  => __( 'In three columns', 'viget-parts-kit' ),
				'markup' => sprintf( $columns, sprintf( $column, '{{block}}' ) . sprintf( $column, '{{filler}}' ) . sprintf( $column, '{{filler}}' ) ),
			],
			'sidebar'   => [
				'label'  => __( 'In a narrow sidebar', 'viget-parts-kit' ),
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
			'label'  => __( 'On its own', 'viget-parts-kit' ),
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
