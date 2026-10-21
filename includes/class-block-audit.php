<?php
/**
 * Block Audit class
 *
 * @package Viget\PartsKit
 */

namespace Viget\PartsKit;

use Throwable;
use WP_Block_Type;
use WP_Block_Type_Registry;

/**
 * Inspects a block's registration, block.json and rendering for problems.
 *
 * Quick checks run for every block when the Block Index loads. File, ACF and render checks
 * only run for the one block being looked at.
 */
class Block_Audit {

	/**
	 * Keys the block.json schema defines.
	 */
	const SCHEMA_KEYS = [ '$schema', 'apiVersion', 'name', 'title', 'category', 'parent', 'ancestor', 'allowedBlocks', 'icon', 'description', 'keywords', 'version', 'textdomain', 'attributes', 'providesContext', 'usesContext', 'selectors', 'supports', 'styles', 'example', 'variations', 'blockHooks', 'editorScript', 'script', 'viewScript', 'viewScriptModule', 'editorStyle', 'style', 'viewStyle', 'render', '__experimental' ];

	/**
	 * Attribute types block.json accepts.
	 */
	const ATTRIBUTE_TYPES = [ 'null', 'boolean', 'object', 'array', 'string', 'integer', 'number', 'rich-text' ];

	/**
	 * Cached category slugs.
	 *
	 * @var array|null
	 */
	private ?array $categories = null;

	/**
	 * Build a finding.
	 *
	 * @param string $level  critical, serious, warning or info.
	 * @param string $code   Stable identifier.
	 * @param string $title  What's wrong.
	 * @param string $detail Why it matters.
	 * @param string $fix    What to do.
	 * @param string $path   Where, e.g. `attributes.align.default`.
	 *
	 * @return array
	 */
	private static function finding( string $level, string $code, string $title, string $detail = '', string $fix = '', string $path = '' ): array {
		return [
			'level'  => $level,
			'code'   => $code,
			'title'  => $title,
			'detail' => $detail,
			'fix'    => $fix,
			'path'   => $path,
		];
	}

	/**
	 * Registered category slugs.
	 *
	 * @return array
	 */
	private function categories(): array {
		if ( null === $this->categories ) {
			$this->categories = array_column( get_block_categories( new \WP_Post( (object) [ 'post_type' => 'post' ] ) ), 'slug' );
		}

		return $this->categories;
	}

	/**
	 * Quick checks from the registered block type alone. Cheap enough for every block.
	 *
	 * @param WP_Block_Type $type Block type.
	 *
	 * @return array Findings.
	 */
	public function quick( WP_Block_Type $type ): array {
		$findings = [];
		$core     = str_starts_with( $type->name, 'core/' );
		$registry = WP_Block_Type_Registry::get_instance();

		if ( ! $type->title ) {
			$findings[] = self::finding( 'serious', 'no-title', __( 'No title', 'viget-parts-kit' ), __( 'The inserter shows the raw block name instead.', 'viget-parts-kit' ), __( 'Add a "title" to block.json.', 'viget-parts-kit' ), 'title' );
		}

		if ( ! $type->description ) {
			$findings[] = self::finding( 'warning', 'no-description', __( 'No description', 'viget-parts-kit' ), __( 'Authors see an empty panel when they select the block, and the inserter preview has no explanation.', 'viget-parts-kit' ), __( 'Add a one-sentence "description" saying when to use the block.', 'viget-parts-kit' ), 'description' );
		}

		if ( ! $core && ! $type->icon ) {
			$findings[] = self::finding( 'info', 'no-icon', __( 'No icon', 'viget-parts-kit' ), __( 'The inserter falls back to a generic block icon, which makes it harder to find.', 'viget-parts-kit' ), __( 'Set "icon" to a Dashicon slug or an SVG.', 'viget-parts-kit' ), 'icon' );
		}

		if ( ! $core && ! $type->keywords ) {
			$findings[] = self::finding( 'info', 'no-keywords', __( 'No keywords', 'viget-parts-kit' ), __( 'Inserter search only matches the title.', 'viget-parts-kit' ), __( 'Add a few "keywords" authors might search for.', 'viget-parts-kit' ), 'keywords' );
		}

		if ( $type->category && ! \in_array( $type->category, $this->categories(), true ) ) {
			$findings[] = self::finding(
				'warning',
				'unknown-category',
				/* translators: %s: category slug. */
				sprintf( __( 'Category "%s" isn’t registered', 'viget-parts-kit' ), $type->category ),
				__( 'The block lands in an unexpected place in the inserter.', 'viget-parts-kit' ),
				__( 'Register the category with the block_categories_all filter, or use an existing one.', 'viget-parts-kit' ),
				'category'
			);
		}

		if ( (int) $type->api_version < 3 ) {
			$findings[] = self::finding(
				'warning',
				'api-version',
				/* translators: %d: API version. */
				sprintf( __( 'API version %d', 'viget-parts-kit' ), (int) $type->api_version ),
				__( 'Blocks below API version 3 keep the editor from using the iframed canvas, so editor styles and layout can differ from the frontend.', 'viget-parts-kit' ),
				__( 'Set "apiVersion": 3 and test the block in the editor.', 'viget-parts-kit' ),
				'apiVersion'
			);
		}

		foreach ( [
			'parent'         => 'parent',
			'ancestor'       => 'ancestor',
			'allowed_blocks' => 'allowedBlocks',
		] as $property => $key ) {
			foreach ( (array) ( $type->$property ?? [] ) as $name ) {
				if ( \is_string( $name ) && ! $registry->is_registered( $name ) ) {
					$findings[] = self::finding(
						'allowed_blocks' === $property ? 'warning' : 'serious',
						'unregistered-' . $key,
						/* translators: 1: block.json key, 2: block name. */
						sprintf( __( '%1$s lists "%2$s", which isn’t registered', 'viget-parts-kit' ), $key, $name ),
						'allowed_blocks' === $property
							? __( 'Authors can’t add it here, so the restriction does less than intended.', 'viget-parts-kit' )
							: __( 'The block can only be inserted inside a block that doesn’t exist, so authors can’t add it at all.', 'viget-parts-kit' ),
						__( 'Fix the name or register the missing block.', 'viget-parts-kit' ),
						$key
					);
				}
			}
		}

		foreach ( (array) $type->attributes as $name => $attribute ) {
			$findings = array_merge( $findings, $this->check_attribute( (string) $name, (array) $attribute ) );
		}

		$findings = array_merge( $findings, $this->check_variations( (array) $type->variations ) );

		if ( $type->is_dynamic() && ( $type->supports['html'] ?? true ) ) {
			$findings[] = self::finding( 'info', 'dynamic-html', __( 'Dynamic block allows “Edit as HTML”', 'viget-parts-kit' ), __( 'Its markup is generated on the server, so HTML edits are thrown away on save.', 'viget-parts-kit' ), __( 'Set "supports": { "html": false }.', 'viget-parts-kit' ), 'supports.html' );
		}

		if ( ! $core && empty( $type->example ) && ( $type->supports['inserter'] ?? true ) && empty( $type->parent ) ) {
			$findings[] = self::finding( 'info', 'no-example', __( 'No example', 'viget-parts-kit' ), __( 'The inserter can’t show a preview when authors hover the block.', 'viget-parts-kit' ), __( 'Add an "example" with representative attributes.', 'viget-parts-kit' ), 'example' );
		}

		return $findings;
	}

	/**
	 * Check one attribute definition.
	 *
	 * @param string $name      Attribute name.
	 * @param array  $attribute Definition.
	 *
	 * @return array Findings.
	 */
	private function check_attribute( string $name, array $attribute ): array {
		$findings = [];
		$path     = 'attributes.' . $name;
		$types    = (array) ( $attribute['type'] ?? [] );

		if ( ! $types && empty( $attribute['enum'] ) ) {
			$findings[] = self::finding(
				'warning',
				'attribute-no-type',
				/* translators: %s: attribute name. */
				sprintf( __( 'Attribute "%s" has no type', 'viget-parts-kit' ), $name ),
				__( 'Values aren’t validated, so anything can be saved into it.', 'viget-parts-kit' ),
				__( 'Add a "type".', 'viget-parts-kit' ),
				$path
			);
			return $findings;
		}

		foreach ( $types as $type ) {
			if ( ! \in_array( $type, self::ATTRIBUTE_TYPES, true ) ) {
				$findings[] = self::finding(
					'serious',
					'attribute-bad-type',
					/* translators: 1: attribute name, 2: type. */
					sprintf( __( 'Attribute "%1$s" has an unknown type "%2$s"', 'viget-parts-kit' ), $name, $type ),
					__( 'The editor rejects every value, so the attribute never saves.', 'viget-parts-kit' ),
					/* translators: %s: valid types. */
					sprintf( __( 'Use one of: %s.', 'viget-parts-kit' ), implode( ', ', self::ATTRIBUTE_TYPES ) ),
					$path . '.type'
				);
			}
		}

		// A null default means "unset", which core uses throughout.
		if ( isset( $attribute['default'] ) && $types && ! $this->matches_type( $attribute['default'], $types ) ) {
			$findings[] = self::finding(
				'warning',
				'attribute-default-type',
				/* translators: 1: attribute name, 2: declared type. */
				sprintf( __( 'Default for "%1$s" doesn’t match its type (%2$s)', 'viget-parts-kit' ), $name, implode( ', ', $types ) ),
				__( 'The editor treats the default as invalid and may drop it or show the block as needing recovery.', 'viget-parts-kit' ),
				__( 'Change the default or the type so they agree.', 'viget-parts-kit' ),
				$path . '.default'
			);
		}

		if ( ! empty( $attribute['enum'] ) && \array_key_exists( 'default', $attribute ) && ! \in_array( $attribute['default'], (array) $attribute['enum'], true ) ) {
			$findings[] = self::finding(
				'warning',
				'attribute-default-enum',
				/* translators: %s: attribute name. */
				sprintf( __( 'Default for "%s" isn’t one of its allowed values', 'viget-parts-kit' ), $name ),
				__( 'The block starts in a state authors can’t pick again.', 'viget-parts-kit' ),
				__( 'Add the default to "enum", or change it.', 'viget-parts-kit' ),
				$path . '.enum'
			);
		}

		return $findings;
	}

	/**
	 * Whether a value matches any of the declared attribute types.
	 *
	 * @param mixed $value Value.
	 * @param array $types Types.
	 *
	 * @return bool
	 */
	private function matches_type( mixed $value, array $types ): bool {
		foreach ( $types as $type ) {
			$ok = match ( $type ) {
				'string', 'rich-text' => \is_string( $value ),
				'boolean' => \is_bool( $value ),
				'integer' => \is_int( $value ),
				'number'  => \is_int( $value ) || \is_float( $value ),
				'array'   => \is_array( $value ) && array_is_list( $value ),
				'object'  => \is_array( $value ) || \is_object( $value ),
				'null'    => null === $value,
				default   => true,
			};

			if ( $ok ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check variations.
	 *
	 * @param array $variations Variations.
	 *
	 * @return array Findings.
	 */
	private function check_variations( array $variations ): array {
		$findings = [];
		$defaults = 0;

		foreach ( $variations as $index => $variation ) {
			$variation = (array) $variation;
			$name      = $variation['name'] ?? (string) $index;

			if ( ! empty( $variation['isDefault'] ) ) {
				++$defaults;
			}

			if ( \array_key_exists( 'default', $variation ) && ! \array_key_exists( 'isDefault', $variation ) ) {
				$findings[] = self::finding(
					'warning',
					'variation-default-key',
					/* translators: %s: variation name. */
					sprintf( __( 'Variation "%s" uses "default" instead of "isDefault"', 'viget-parts-kit' ), $name ),
					__( 'The editor ignores "default", so the base block shows in the inserter alongside every variation.', 'viget-parts-kit' ),
					__( 'Rename the key to "isDefault".', 'viget-parts-kit' ),
					'variations.' . $name
				);
			}

			if ( empty( $variation['title'] ) ) {
				$findings[] = self::finding(
					'warning',
					'variation-no-title',
					/* translators: %s: variation name. */
					sprintf( __( 'Variation "%s" has no title', 'viget-parts-kit' ), $name ),
					__( 'It shows in the inserter without a name.', 'viget-parts-kit' ),
					__( 'Add a "title".', 'viget-parts-kit' ),
					'variations.' . $name
				);
			}
		}

		if ( $defaults > 1 ) {
			$findings[] = self::finding(
				'warning',
				'variation-multiple-defaults',
				/* translators: %d: count. */
				sprintf( __( '%d variations are marked isDefault', 'viget-parts-kit' ), $defaults ),
				__( 'Only one can replace the base block in the inserter, and which one wins isn’t guaranteed.', 'viget-parts-kit' ),
				__( 'Keep isDefault on one variation.', 'viget-parts-kit' ),
				'variations'
			);
		}

		return $findings;
	}

	/**
	 * Find the block.json a block was registered from.
	 *
	 * Core and Viget Blocks Toolkit blocks are found directly. Anything else is searched for
	 * in the active theme and plugins, which is why this only runs for one block at a time.
	 *
	 * @param string $name Block name.
	 *
	 * @return string Path, or empty.
	 */
	public function locate_block_json( string $name ): string {
		if ( str_starts_with( $name, 'core/' ) ) {
			$file = ABSPATH . WPINC . '/blocks/' . substr( $name, 5 ) . '/block.json';
			return is_file( $file ) ? $file : '';
		}

		$toolkit = '\Viget\BlocksToolkit\BlockRegistration';
		if ( str_starts_with( $name, 'acf/' ) && class_exists( $toolkit ) && method_exists( $toolkit, 'get_block_location' ) ) {
			$file = $toolkit::get_block_location( $name, 'json' );
			if ( $file && is_file( $file ) ) {
				return $file;
			}
		}

		$roots = array_unique( [ get_stylesheet_directory(), get_template_directory() ] );
		foreach ( (array) get_option( 'active_plugins', [] ) as $plugin ) {
			$roots[] = WP_PLUGIN_DIR . '/' . dirname( $plugin );
		}

		$short = substr( $name, (int) strpos( $name, '/' ) + 1 );

		foreach ( $roots as $root ) {
			if ( ! $root || '.' === basename( $root ) || ! is_dir( $root ) ) {
				continue;
			}

			foreach ( [ '/*/block.json', '/*/*/block.json', '/*/*/*/block.json', '/*/*/*/*/block.json' ] as $pattern ) {
				foreach ( (array) glob( $root . $pattern ) as $file ) {
					if ( str_contains( $file, '/node_modules/' ) || str_contains( $file, '/vendor/' ) ) {
						continue;
					}

					$json = json_decode( (string) file_get_contents( $file ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file.
					if ( \is_array( $json ) && ( ( $json['name'] ?? '' ) === $name || ( str_starts_with( $name, 'acf/' ) && ( $json['name'] ?? '' ) === $short ) ) ) {
						return $file;
					}
				}
			}
		}

		return '';
	}

	/**
	 * Checks against the block.json file itself.
	 *
	 * @param string $file Path to block.json.
	 * @param array  $json Decoded JSON.
	 *
	 * @return array Findings.
	 */
	public function check_json( string $file, array $json ): array {
		$findings = [];
		$dir      = dirname( $file );

		/**
		 * Filters block.json keys the audit treats as known, beyond the core schema.
		 *
		 * @param array $keys Extra keys. Defaults include ACF's `acf` and Viget Blocks Toolkit's `settings`.
		 */
		$known = array_merge( self::SCHEMA_KEYS, (array) apply_filters( 'vgtpk_audit_known_keys', [ 'acf', 'settings' ] ) );

		foreach ( array_keys( $json ) as $key ) {
			if ( ! \in_array( $key, $known, true ) ) {
				$findings[] = self::finding(
					'warning',
					'json-unknown-key',
					/* translators: %s: key. */
					sprintf( __( 'Unknown key "%s"', 'viget-parts-kit' ), $key ),
					__( 'It isn’t part of the block.json schema, so WordPress ignores it. Often a typo or a key that belongs inside "supports".', 'viget-parts-kit' ),
					__( 'Fix the spelling, move it, or add it to vgtpk_audit_known_keys if a plugin reads it.', 'viget-parts-kit' ),
					$key
				);
			}
		}

		if ( empty( $json['$schema'] ) ) {
			$findings[] = self::finding( 'info', 'json-no-schema', __( 'No $schema', 'viget-parts-kit' ), __( 'Editors can’t autocomplete or validate the file.', 'viget-parts-kit' ), __( 'Add "$schema": "https://schemas.wp.org/trunk/block.json".', 'viget-parts-kit' ), '$schema' );
		}

		if ( empty( $json['textdomain'] ) && ! str_starts_with( (string) ( $json['name'] ?? '' ), 'core/' ) ) {
			$findings[] = self::finding( 'info', 'json-no-textdomain', __( 'No textdomain', 'viget-parts-kit' ), __( 'The title, description and keywords can’t be translated.', 'viget-parts-kit' ), __( 'Add the theme or plugin text domain.', 'viget-parts-kit' ), 'textdomain' );
		}

		foreach ( [ 'editorScript', 'script', 'viewScript', 'viewScriptModule', 'editorStyle', 'style', 'viewStyle', 'render' ] as $key ) {
			foreach ( (array) ( $json[ $key ] ?? [] ) as $reference ) {
				if ( ! \is_string( $reference ) || ! str_starts_with( $reference, 'file:' ) ) {
					continue;
				}

				$path = wp_normalize_path( $dir . '/' . ltrim( substr( $reference, 5 ), './' ) );

				if ( ! is_file( $path ) ) {
					$findings[] = self::finding(
						'serious',
						'json-missing-file',
						/* translators: 1: key, 2: file reference. */
						sprintf( __( '%1$s points to %2$s, which doesn’t exist', 'viget-parts-kit' ), $key, $reference ),
						'render' === $key
							? __( 'The block renders nothing on the frontend.', 'viget-parts-kit' )
							: __( 'The asset never loads. Usually a missing build step.', 'viget-parts-kit' ),
						__( 'Build the asset or fix the path.', 'viget-parts-kit' ),
						$key
					);
				}
			}
		}

		if ( ! empty( $json['acf'] ) && \is_array( $json['acf'] ) ) {
			$acf = $json['acf'];

			if ( empty( $acf['mode'] ) ) {
				$findings[] = self::finding( 'info', 'acf-no-mode', __( 'No ACF mode', 'viget-parts-kit' ), __( 'ACF picks its default, which may open the field form instead of a preview.', 'viget-parts-kit' ), __( 'Set "acf": { "mode": "preview" }.', 'viget-parts-kit' ), 'acf.mode' );
			}

			$template = $acf['renderTemplate'] ?? '';
			if ( $template && ! is_file( $dir . '/' . $template ) && ! is_file( $template ) ) {
				$findings[] = self::finding(
					'serious',
					'acf-missing-template',
					/* translators: %s: template path. */
					sprintf( __( 'renderTemplate %s doesn’t exist', 'viget-parts-kit' ), $template ),
					__( 'The block renders nothing.', 'viget-parts-kit' ),
					__( 'Fix the path or add the template.', 'viget-parts-kit' ),
					'acf.renderTemplate'
				);
			}
		}

		return $findings;
	}

	/**
	 * Render a sample of the block and report what happened.
	 *
	 * @param string $name Block name.
	 *
	 * @return array
	 */
	public function render_check( string $name ): array {
		$markup = '';
		$source = 'empty';

		foreach ( vgtpk()->catalog->get_items() as $item ) {
			if ( $item['name'] === $name && ! empty( $item['samples'][0]['markup'] ) ) {
				$markup = $item['samples'][0]['markup'];
				$source = 'catalog';
				break;
			}
		}

		if ( ! $markup ) {
			$markup = '<!-- wp:' . preg_replace( '#^core/#', '', $name ) . ' /-->';
		}

		vgtpk()->sample_data->enable_render_filters();

		$notices = [];
		$started = microtime( true );
		$output  = '';
		$error   = '';

		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_set_error_handler -- Collects notices from one sample render, then restores the previous handler.
		set_error_handler(
			static function ( $errno, $message, $file, $line ) use ( &$notices ) {
				$notices[] = sprintf( '%s (%s:%d)', $message, str_replace( wp_normalize_path( ABSPATH ), '', wp_normalize_path( $file ) ), $line );
				return true;
			}
		);

		ob_start();
		try {
			$output = do_blocks( $markup );
		} catch ( Throwable $exception ) {
			$error = $exception->getMessage();
		}
		$echoed = (string) ob_get_clean();

		restore_error_handler();

		$html = $echoed . $output;
		$text = trim( wp_strip_all_tags( $html ) );

		return [
			'source'  => $source,
			'ms'      => (int) round( ( microtime( true ) - $started ) * 1000 ),
			'bytes'   => \strlen( $html ),
			'text'    => mb_substr( $text, 0, 160 ),
			'empty'   => '' === trim( $html ),
			'notices' => array_slice( array_unique( $notices ), 0, 10 ),
			'error'   => $error,
		];
	}

	/**
	 * Everything about one block, for the Spec and Audit tabs.
	 *
	 * @param string $name Block name.
	 *
	 * @return array|null
	 */
	public function inspect( string $name ): ?array {
		$type = WP_Block_Type_Registry::get_instance()->get_registered( $name );

		if ( ! $type ) {
			return null;
		}

		$findings = $this->quick( $type );
		$file     = $this->locate_block_json( $name );
		$json     = $file ? json_decode( (string) file_get_contents( $file ), true ) : null; // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file.

		if ( $file && \is_array( $json ) ) {
			$findings = array_merge( $findings, $this->check_json( $file, $json ) );
		} elseif ( $file ) {
			$findings[] = self::finding( 'critical', 'json-invalid', __( 'block.json isn’t valid JSON', 'viget-parts-kit' ), json_last_error_msg(), __( 'Fix the syntax error.', 'viget-parts-kit' ) );
		}

		$fields = [];
		if ( str_starts_with( $name, 'acf/' ) && function_exists( 'acf_get_block_fields' ) ) {
			foreach ( acf_get_block_fields( [ 'name' => $name ] ) as $field ) {
				$fields[] = [
					'label'    => (string) ( $field['label'] ?? '' ),
					'name'     => (string) ( $field['name'] ?? '' ),
					'type'     => (string) ( $field['type'] ?? '' ),
					'required' => ! empty( $field['required'] ),
				];
			}
		}

		$render = $this->render_check( $name );

		if ( $render['error'] ) {
			$findings[] = self::finding( 'critical', 'render-error', __( 'The sample throws an error when it renders', 'viget-parts-kit' ), $render['error'], __( 'Check the render template with the sample content shown in the Parts Kit.', 'viget-parts-kit' ) );
		}

		if ( $render['notices'] ) {
			$findings[] = self::finding(
				'serious',
				'render-notices',
				/* translators: %d: count. */
				sprintf( _n( 'Rendering raises %d PHP notice', 'Rendering raises %d PHP notices', \count( $render['notices'] ), 'viget-parts-kit' ), \count( $render['notices'] ) ),
				implode( "\n", $render['notices'] ),
				__( 'Usually an unchecked field or array key. Guard it in the render template.', 'viget-parts-kit' )
			);
		}

		if ( $render['empty'] && ! $render['error'] ) {
			$findings[] = self::finding( 'warning', 'render-empty', __( 'The sample renders nothing', 'viget-parts-kit' ), __( 'With sample content, the block produced no markup. It may need content or context the sample doesn’t provide.', 'viget-parts-kit' ), __( 'Give it sample content with vgtpk_block_config, or check the render template.', 'viget-parts-kit' ) );
		}

		$assets = [];
		foreach ( [
			'editor_script_handles' => 'editorScript',
			'script_handles'        => 'script',
			'view_script_handles'   => 'viewScript',
			'editor_style_handles'  => 'editorStyle',
			'style_handles'         => 'style',
			'view_style_handles'    => 'viewStyle',
		] as $property => $key ) {
			foreach ( (array) ( $type->$property ?? [] ) as $handle ) {
				$assets[] = [
					'kind'   => $key,
					'handle' => (string) $handle,
				];
			}
		}

		return [
			'name'       => $name,
			'file'       => $file ? str_replace( wp_normalize_path( ABSPATH ), '', wp_normalize_path( $file ) ) : '',
			'json'       => \is_array( $json ) ? $json : null,
			'apiVersion' => (int) $type->api_version,
			'dynamic'    => $type->is_dynamic(),
			'textdomain' => (string) ( $type->textdomain ? $type->textdomain : ( $json['textdomain'] ?? '' ) ),
			'keywords'   => array_values( (array) $type->keywords ),
			'parent'     => array_values( (array) $type->parent ),
			'ancestor'   => array_values( (array) $type->ancestor ),
			'allowed'    => array_values( (array) ( $type->allowed_blocks ?? [] ) ),
			'attributes' => (object) $type->attributes,
			'supports'   => (object) $type->supports,
			'provides'   => (object) $type->provides_context,
			'uses'       => array_values( (array) $type->uses_context ),
			'variations' => array_values(
				array_map(
					static fn( $variation ) => [
						'name'      => (string) ( $variation['name'] ?? '' ),
						'title'     => (string) ( $variation['title'] ?? '' ),
						'isDefault' => ! empty( $variation['isDefault'] ),
						'scope'     => array_values( (array) ( $variation['scope'] ?? [] ) ),
					],
					(array) $type->variations
				)
			),
			'assets'     => $assets,
			'fields'     => $fields,
			'render'     => $render,
			'findings'   => $findings,
		];
	}
}
