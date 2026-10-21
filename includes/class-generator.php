<?php
/**
 * Generator class
 *
 * @package Viget\PartsKit
 */

namespace Viget\PartsKit;

use WP_Block_Type_Registry;

/**
 * Runs the catalog generator inside the block editor, where every block, style and
 * variation is registered exactly as authors see them.
 */
class Generator {

	/**
	 * Query arg that starts the generator on a new QA page screen.
	 */
	const QUERY_ARG = 'vgtpk_generate';

	/**
	 * Constructor.
	 */
	public function __construct() {
		add_action( 'enqueue_block_editor_assets', [ $this, 'enqueue' ] );
	}

	/**
	 * URL that opens the editor in generator mode.
	 *
	 * @param bool $embedded Whether the explorer is running it in a hidden iframe.
	 *
	 * @return string
	 */
	public static function url( bool $embedded = false ): string {
		$args = [
			'post_type'     => Post_Type::NAME,
			self::QUERY_ARG => 1,
		];

		if ( $embedded ) {
			$args['vgtpk_embedded'] = 1;
		}

		return add_query_arg( $args, admin_url( 'post-new.php' ) );
	}

	/**
	 * Whether this editor load is a generator run.
	 *
	 * @return bool
	 */
	private function is_generator_screen(): bool {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Only switches which script loads; saving is nonce-checked over REST.
		if ( empty( $_GET[ self::QUERY_ARG ] ) ) {
			return false;
		}

		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;

		return $screen && Post_Type::NAME === $screen->post_type && Access::can_manage();
	}

	/**
	 * Enqueue the generator.
	 *
	 * @return void
	 */
	public function enqueue(): void {
		if ( ! $this->is_generator_screen() ) {
			return;
		}

		$asset = Canvas::asset( 'generator' );

		wp_enqueue_style( 'vgtpk-generator', VGTPK_PLUGIN_URL . 'build/style-generator.css', [], $asset['version'] );
		wp_add_inline_style( 'vgtpk-generator', Colors::css( '.vgtpk-generator' ) );
		wp_enqueue_script( 'vgtpk-generator', VGTPK_PLUGIN_URL . 'build/generator.js', $asset['dependencies'], $asset['version'], [ 'in_footer' => true ] );
		wp_set_script_translations( 'vgtpk-generator', 'viget-parts-kit', VGTPK_PLUGIN_PATH . 'languages' );

		wp_add_inline_script(
			'vgtpk-generator',
			'window.vgtpkGenerator = ' . wp_json_encode(
				[
					'postId'      => get_the_ID(),
					// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Display flag.
					'embedded'    => ! empty( $_GET['vgtpk_embedded'] ),
					'explorerUrl' => Post_Type::archive_url(),
					'restRoot'    => esc_url_raw( rest_url( Catalog::REST_NAMESPACE . '/' ) ),
					'nonce'       => wp_create_nonce( 'wp_rest' ),
					'excluded'    => vgtpk()->catalog->get_excluded_blocks(),
					'categories'  => vgtpk()->catalog->get_excluded_categories(),
					'templates'   => $this->get_templates(),
					'acf'         => vgtpk()->sample_data->acf_samples(),
					'blockConfig' => $this->get_block_config(),
					'axes'        => self::get_axes(),
					'content'     => vgtpk()->sample_data->content(),
					'placeholder' => vgtpk()->sample_data->placeholder_template(),
					'images'      => vgtpk()->sample_data->images(),
					'siteName'    => get_bloginfo( 'name' ),
				]
			) . ';',
			'before'
		);
	}

	/**
	 * Inner block templates for blocks whose templates live on the server, like ACF blocks.
	 *
	 * The editor only applies these when an InnerBlocks component mounts, so the generator
	 * needs them handed over to build complete samples.
	 *
	 * @return array<string, array>
	 */
	public function get_templates(): array {
		$templates = [];
		$toolkit   = '\Viget\BlocksToolkit\BlockRegistration';

		foreach ( array_keys( WP_Block_Type_Registry::get_instance()->get_all_registered() ) as $name ) {
			$template = [];

			if ( str_starts_with( $name, 'acf/' ) && class_exists( $toolkit ) && method_exists( $toolkit, 'get_block' ) && method_exists( $toolkit, 'get_inner_blocks' ) ) {
				$block = $toolkit::get_block( $name );

				if ( \is_array( $block ) ) {
					$template = $toolkit::get_inner_blocks( $block, $block );
				}
			}

			/**
			 * Filters the inner block template used to build a block's samples.
			 *
			 * @param array  $template Template in `[ name, attributes, innerBlocks ]` form.
			 * @param string $name     Block name.
			 */
			$template = apply_filters( 'vgtpk_block_template', $template, $name );

			if ( $template ) {
				$templates[ $name ] = array_values( (array) $template );
			}
		}

		return $templates;
	}

	/**
	 * Which sample sets every block gets, unless its config says otherwise.
	 *
	 * @return array<string, bool>
	 */
	public static function get_axes(): array {
		/**
		 * Filters the sample sets built for every block.
		 *
		 * @param array $axes `styles`, `align`, `textAlign`, `levels` (headings), `ordered` (lists),
		 *                    `justify` (flex layouts) and `variations`, each true or false.
		 */
		return array_map(
			'boolval',
			(array) apply_filters(
				'vgtpk_sample_axes',
				[
					'styles'     => true,
					'align'      => true,
					'textAlign'  => true,
					'levels'     => true,
					'ordered'    => true,
					'justify'    => true,
					'variations' => true,
				]
			)
		);
	}

	/**
	 * Per-block configuration, only for blocks that have any.
	 *
	 * @return array<string, array>
	 */
	public function get_block_config(): array {
		$config = [];

		foreach ( array_keys( WP_Block_Type_Registry::get_instance()->get_all_registered() ) as $name ) {
			/**
			 * Filters how one block is presented in the Parts Kit.
			 *
			 * Every key is optional:
			 *
			 * - `hidden`      bool   Leave the block out.
			 * - `title`, `description`, `category` string  Override what the nav shows.
			 * - `axes`        array  Turn sample sets on or off, like `vgtpk_sample_axes`.
			 * - `styles`      array|false  Style names to show, or false for none.
			 * - `aligns`      array  Alignments to show.
			 * - `attributes`  array  Merged into every sample.
			 * - `innerBlocks` array  Replaces the sample's inner blocks (template form).
			 * - `before`, `after` array  Blocks placed around every sample (template form).
			 * - `demos`       array  Extra samples. Each takes `key`, `label`, `description`, and
			 *                        either `attributes`/`innerBlocks` or raw block `markup`.
			 * - `parent`      string For child blocks, the parent to show them in.
			 * - `repeat`      int    How many children the default child sample shows.
			 * - `variations`  array  The same keys, per variation name.
			 *
			 * @param array  $config Empty by default.
			 * @param string $name   Block name.
			 */
			$block = apply_filters( 'vgtpk_block_config', [], $name );

			if ( $block ) {
				$config[ $name ] = (array) $block;
			}
		}

		return $config;
	}
}
