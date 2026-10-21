<?php
/**
 * Sample Data class
 *
 * @package Viget\PartsKit
 */

namespace Viget\PartsKit;

use WP_Block_Type_Registry;

/**
 * Builds sample content for blocks, including ACF field data and placeholder images.
 */
class Sample_Data {

	/**
	 * Fake attachment IDs start here. They only resolve while the canvas is rendering.
	 */
	const FAKE_ID_BASE = 2000000000;

	/**
	 * Shapes for fake images, cycled by fake ID.
	 *
	 * @var array<int, array{0: int, 1: int}>
	 */
	const SHAPES = [
		[ 1200, 800 ],
		[ 800, 800 ],
		[ 800, 1100 ],
		[ 1600, 900 ],
	];

	/**
	 * Running fake ID offset while building ACF samples.
	 *
	 * @var int
	 */
	private int $next_image = 0;

	/**
	 * Placeholder image URL.
	 *
	 * @param int    $width  Width.
	 * @param int    $height Height.
	 * @param string $text   Optional label. Defaults to the dimensions.
	 *
	 * @return string
	 */
	public function placeholder_url( int $width, int $height, string $text = '' ): string {
		$images = $this->images();

		if ( $images ) {
			$url = $images[ ( $width * 7 + $height ) % \count( $images ) ];
		} else {
			$url = strtr(
				$this->placeholder_template(),
				[
					'{width}'  => $width,
					'{height}' => $height,
					'{text}'   => rawurlencode( $text ),
				]
			);
			$url = $text ? $url : remove_query_arg( 'text', $url );
		}

		/**
		 * Filters placeholder image URLs.
		 *
		 * @param string $url    Placeholder URL.
		 * @param int    $width  Width.
		 * @param int    $height Height.
		 * @param string $text   Label.
		 */
		return (string) apply_filters( 'vgtpk_placeholder_url', $url, $width, $height, $text );
	}

	/**
	 * Placeholder image URL template with {width}, {height} and {text} tokens.
	 *
	 * @return string
	 */
	public function placeholder_template(): string {
		$settings = vgtpk()->settings;

		/**
		 * Filters the placeholder image URL template.
		 *
		 * @param string $template URL with {width}, {height} and {text} tokens. Defaults to placehold.co
		 *                         in the colors from the settings page.
		 */
		return (string) apply_filters(
			'vgtpk_placeholder_template',
			sprintf(
				'https://placehold.co/{width}x{height}/%s/%s/png?text={text}',
				$settings->get( 'placeholder_bg' ),
				$settings->get( 'placeholder_fg' )
			)
		);
	}

	/**
	 * Real images to use instead of placeholders, as URLs.
	 *
	 * @return array
	 */
	public function images(): array {
		/**
		 * Filters images used in samples instead of placeholders. Samples cycle through them.
		 *
		 * @param array $images Image URLs or attachment IDs. Empty uses placeholders.
		 */
		$images = (array) apply_filters( 'vgtpk_sample_images', [] );

		return array_values(
			array_filter(
				array_map(
					static fn( $image ) => is_numeric( $image ) ? (string) wp_get_attachment_image_url( (int) $image, 'large' ) : esc_url_raw( (string) $image ),
					$images
				)
			)
		);
	}

	/**
	 * Text templates for sample content.
	 *
	 * @return array<string, string>
	 */
	public function content(): array {
		/**
		 * Filters the text samples are written with. Each is a sprintf() template.
		 *
		 * @param array $content {
		 *     @type string $sentence        Body text. %1$s is the block title.
		 *     @type string $sentenceVariant Body text for a variant. %1$s block title, %2$s variant, e.g. "Style: Outline".
		 *     @type string $heading         Heading text for a variant. %1$s is the variant.
		 *     @type string $headingDefault  Heading text for the default sample.
		 *     @type string $button          Button label.
		 *     @type string $citation        Quote citation.
		 *     @type string $filler          Text beside floated samples and in neighboring columns.
		 * }
		 */
		return array_map(
			'strval',
			(array) apply_filters(
				'vgtpk_sample_content',
				[
					/* translators: %1$s: block title. */
					'sentence'        => __( 'This is the %1$s block. The sentence runs long enough to wrap, so you can check line height, measure and spacing against the rest of the design.', 'viget-parts-kit' ),
					/* translators: 1: block title, 2: variant, e.g. "Style: Outline". */
					'sentenceVariant' => __( 'This is the %1$s block (%2$s). The sentence runs long enough to wrap, so you can check line height, measure and spacing against the rest of the design.', 'viget-parts-kit' ),
					/* translators: %1$s: variant or block title. */
					'heading'         => __( 'A heading in %1$s', 'viget-parts-kit' ),
					'headingDefault'  => __( 'A sample heading for review', 'viget-parts-kit' ),
					'button'          => __( 'Button label', 'viget-parts-kit' ),
					'citation'        => __( 'A Person, Their Title', 'viget-parts-kit' ),
					'filler'          => __( 'Body copy that sits next to the block, so you can see how it relates to ordinary text and how it wraps when floated.', 'viget-parts-kit' ),
				]
			)
		);
	}

	/**
	 * Whether an ID is one of ours.
	 *
	 * @param mixed $id Attachment ID.
	 *
	 * @return bool
	 */
	public static function is_fake_id( mixed $id ): bool {
		return is_numeric( $id ) && (int) $id >= self::FAKE_ID_BASE && (int) $id < self::FAKE_ID_BASE + 1000;
	}

	/**
	 * Width and height for a fake ID.
	 *
	 * @param int $id Fake attachment ID.
	 *
	 * @return array{0: int, 1: int}
	 */
	public static function fake_shape( int $id ): array {
		return self::SHAPES[ ( $id - self::FAKE_ID_BASE ) % \count( self::SHAPES ) ];
	}

	/**
	 * Hook the filters that make fake attachments resolve. Only called on canvas requests.
	 *
	 * @return void
	 */
	public function enable_render_filters(): void {
		add_filter( 'acf/pre_format_value', [ $this, 'format_acf_image' ], 10, 4 );
		add_filter( 'image_downsize', [ $this, 'downsize_fake_image' ], 10, 3 );
		add_filter( 'wp_get_attachment_metadata', [ $this, 'fake_image_metadata' ], 10, 2 );
		add_filter( 'wp_get_attachment_url', [ $this, 'fake_image_url' ], 10, 2 );
		add_filter( 'wp_get_attachment_caption', [ $this, 'fake_image_caption' ], 10, 2 );
	}

	/**
	 * Resolve fake IDs in ACF image and gallery fields.
	 *
	 * @param mixed $check   Null to continue normally.
	 * @param mixed $value   Raw value.
	 * @param mixed $post_id Post ID.
	 * @param array $field   Field.
	 *
	 * @return mixed
	 */
	public function format_acf_image( mixed $check, mixed $value, mixed $post_id, array $field ): mixed {
		if ( null !== $check || ! \in_array( $field['type'] ?? '', [ 'image', 'gallery' ], true ) ) {
			return $check;
		}

		$format = $field['return_format'] ?? 'array';

		if ( 'image' === $field['type'] ) {
			return self::is_fake_id( $value ) ? $this->format_fake_image( (int) $value, $format ) : $check;
		}

		if ( ! \is_array( $value ) || ! $value || ! self::is_fake_id( reset( $value ) ) ) {
			return $check;
		}

		return array_map( fn( $id ) => $this->format_fake_image( (int) $id, $format ), $value );
	}

	/**
	 * Format a fake image like ACF would.
	 *
	 * @param int    $id     Fake ID.
	 * @param string $format ACF return format.
	 *
	 * @return array|string|int
	 */
	public function format_fake_image( int $id, string $format = 'array' ): array|string|int {
		[ $width, $height ] = self::fake_shape( $id );
		$url                = $this->placeholder_url( $width, $height );

		if ( 'id' === $format ) {
			return $id;
		}

		if ( 'url' === $format ) {
			return $url;
		}

		$sizes = [];
		foreach ( wp_get_registered_image_subsizes() as $size => $data ) {
			[ $size_width, $size_height ] = $this->fit( $width, $height, (int) $data['width'], (int) $data['height'], (bool) $data['crop'] );

			$sizes[ $size ]             = $this->placeholder_url( $size_width, $size_height );
			$sizes[ $size . '-width' ]  = $size_width;
			$sizes[ $size . '-height' ] = $size_height;
		}

		return [
			'ID'          => $id,
			'id'          => $id,
			'title'       => __( 'Placeholder image', 'viget-parts-kit' ),
			'filename'    => sprintf( '%dx%d.png', $width, $height ),
			'filesize'    => 0,
			'url'         => $url,
			'link'        => $url,
			/* translators: 1: width, 2: height. */
			'alt'         => sprintf( __( 'Placeholder image, %1$d by %2$d', 'viget-parts-kit' ), $width, $height ),
			'author'      => 0,
			'description' => '',
			'caption'     => __( 'A caption describing the image.', 'viget-parts-kit' ),
			'name'        => sprintf( 'placeholder-%dx%d', $width, $height ),
			'status'      => 'inherit',
			'uploaded_to' => 0,
			'date'        => '',
			'modified'    => '',
			'menu_order'  => 0,
			'mime_type'   => 'image/png',
			'type'        => 'image',
			'subtype'     => 'png',
			'icon'        => includes_url( 'images/media/default.png' ),
			'width'       => $width,
			'height'      => $height,
			'sizes'       => $sizes,
		];
	}

	/**
	 * Short-circuit wp_get_attachment_image_src() and friends for fake IDs.
	 *
	 * @param array|false  $downsize Short-circuit value.
	 * @param mixed        $id       Attachment ID.
	 * @param string|array $size     Requested size.
	 *
	 * @return array|false
	 */
	public function downsize_fake_image( mixed $downsize, mixed $id, mixed $size ): array|false {
		if ( ! self::is_fake_id( $id ) ) {
			return $downsize;
		}

		[ $width, $height ] = self::fake_shape( (int) $id );

		if ( \is_array( $size ) ) {
			[ $width, $height ] = $this->fit( $width, $height, (int) ( $size[0] ?? 0 ), (int) ( $size[1] ?? 0 ), false );
		} else {
			$sizes = wp_get_registered_image_subsizes();
			if ( isset( $sizes[ $size ] ) ) {
				[ $width, $height ] = $this->fit( $width, $height, (int) $sizes[ $size ]['width'], (int) $sizes[ $size ]['height'], (bool) $sizes[ $size ]['crop'] );
			}
		}

		return [ $this->placeholder_url( $width, $height ), $width, $height, false ];
	}

	/**
	 * Metadata for fake IDs, so srcset and dimension lookups don't fail.
	 *
	 * @param mixed $data Metadata.
	 * @param mixed $id   Attachment ID.
	 *
	 * @return mixed
	 */
	public function fake_image_metadata( mixed $data, mixed $id ): mixed {
		if ( ! self::is_fake_id( $id ) ) {
			return $data;
		}

		[ $width, $height ] = self::fake_shape( (int) $id );

		return [
			'width'  => $width,
			'height' => $height,
			'file'   => '',
			'sizes'  => [],
		];
	}

	/**
	 * URL for fake IDs.
	 *
	 * @param mixed $url URL.
	 * @param mixed $id  Attachment ID.
	 *
	 * @return mixed
	 */
	public function fake_image_url( mixed $url, mixed $id ): mixed {
		if ( ! self::is_fake_id( $id ) ) {
			return $url;
		}

		[ $width, $height ] = self::fake_shape( (int) $id );

		return $this->placeholder_url( $width, $height );
	}

	/**
	 * Caption for fake IDs.
	 *
	 * @param mixed $caption Caption.
	 * @param mixed $id      Attachment ID.
	 *
	 * @return mixed
	 */
	public function fake_image_caption( mixed $caption, mixed $id ): mixed {
		return self::is_fake_id( $id ) ? __( 'A caption describing the image.', 'viget-parts-kit' ) : $caption;
	}

	/**
	 * Fit dimensions inside a box, like WordPress image sizes do.
	 *
	 * @param int  $width      Source width.
	 * @param int  $height     Source height.
	 * @param int  $max_width  Box width, 0 for unbounded.
	 * @param int  $max_height Box height, 0 for unbounded.
	 * @param bool $crop       Whether the size crops to the box.
	 *
	 * @return array{0: int, 1: int}
	 */
	private function fit( int $width, int $height, int $max_width, int $max_height, bool $crop ): array {
		if ( $crop && $max_width && $max_height ) {
			return [ $max_width, $max_height ];
		}

		return wp_constrain_dimensions( $width, $height, $max_width, $max_height );
	}

	/**
	 * Sample `data` for every ACF block, keyed by field key.
	 *
	 * Key-based data makes ACF simulate a save into local meta, which handles repeaters
	 * and groups without touching the database.
	 *
	 * @return array<string, array>
	 */
	public function acf_samples(): array {
		if ( ! function_exists( 'acf_get_block_fields' ) ) {
			return [];
		}

		$samples = [];

		foreach ( WP_Block_Type_Registry::get_instance()->get_all_registered() as $name => $block_type ) {
			if ( ! str_starts_with( $name, 'acf/' ) ) {
				continue;
			}

			$fields = acf_get_block_fields( [ 'name' => $name ] );

			if ( ! $fields ) {
				continue;
			}

			$this->next_image = 0;
			$data             = $this->sample_fields( $fields, (string) $block_type->title );

			/**
			 * Filters sample ACF data for a block.
			 *
			 * @param array  $data   Field key => value.
			 * @param string $name   Block name.
			 * @param array  $fields ACF fields.
			 */
			$data = apply_filters( 'vgtpk_acf_sample_data', $data, $name, $fields );

			if ( $data ) {
				$samples[ $name ] = $data;
			}
		}

		return $samples;
	}

	/**
	 * Sample values for a list of fields, keyed by field key.
	 *
	 * @param array  $fields      ACF fields.
	 * @param string $block_title Block title, for descriptive text.
	 *
	 * @return array
	 */
	private function sample_fields( array $fields, string $block_title ): array {
		$data = [];

		foreach ( $fields as $field ) {
			if ( empty( $field['key'] ) ) {
				continue;
			}

			$value = $this->sample_value( $field, $block_title );

			if ( null !== $value ) {
				$data[ $field['key'] ] = $value;
			}
		}

		return $data;
	}

	/**
	 * Sample value for one ACF field.
	 *
	 * @param array  $field       ACF field.
	 * @param string $block_title Block title, for descriptive text.
	 *
	 * @return mixed Null to leave the field empty.
	 */
	public function sample_value( array $field, string $block_title = '' ): mixed {
		$label   = trim( (string) ( $field['label'] ?? '' ) );
		$name    = strtolower( (string) ( $field['name'] ?? '' ) );
		$default = $field['default_value'] ?? '';
		$choices = array_keys( (array) ( $field['choices'] ?? [] ) );

		/**
		 * Short-circuits the sample value for an ACF field.
		 *
		 * @param mixed  $value       Null to use the built-in sample.
		 * @param array  $field       ACF field.
		 * @param string $block_title Block title.
		 */
		$pre = apply_filters( 'vgtpk_pre_acf_sample_value', null, $field, $block_title );
		if ( null !== $pre ) {
			return $pre;
		}

		switch ( $field['type'] ?? '' ) {
			case 'text':
				if ( preg_match( '/phone|tel/', $name ) ) {
					return '(555) 010-1234';
				}
				if ( preg_match( '/title|heading|headline/', $name ) ) {
					/* translators: %s: block title. */
					return sprintf( __( 'A headline for the %s block', 'viget-parts-kit' ), $block_title );
				}
				if ( preg_match( '/eyebrow|kicker|label|tag/', $name ) ) {
					return $label ? $label : __( 'Label', 'viget-parts-kit' );
				}
				if ( preg_match( '/stat|number|value|figure/', $name ) ) {
					return '87%';
				}
				/* translators: %s: field label. */
				return sprintf( __( 'Sample %s', 'viget-parts-kit' ), $label ? strtolower( $label ) : __( 'text', 'viget-parts-kit' ) );

			case 'textarea':
				/* translators: 1: field label, 2: block title. */
				return sprintf( __( 'This is sample %1$s text for the %2$s block. It runs long enough to show how two or three lines wrap at this width.', 'viget-parts-kit' ), $label ? strtolower( $label ) : __( 'body', 'viget-parts-kit' ), $block_title );

			case 'wysiwyg':
				/* translators: %s: block title. */
				return '<p>' . sprintf( esc_html__( 'Rich text inside the %s block, with a sentence of realistic length so you can check line height and measure.', 'viget-parts-kit' ), esc_html( $block_title ) ) . '</p><ul><li>' . esc_html__( 'A first list item', 'viget-parts-kit' ) . '</li><li>' . esc_html__( 'A second list item', 'viget-parts-kit' ) . '</li></ul>';

			case 'number':
			case 'range':
				if ( '' !== $default && null !== $default ) {
					return $default;
				}
				return isset( $field['max'] ) && '' !== $field['max'] ? $field['max'] : 42;

			case 'email':
				return 'hello@example.com';

			case 'url':
				return home_url( '/' );

			case 'link':
				return [
					'title'  => __( 'Learn more', 'viget-parts-kit' ),
					'url'    => home_url( '/' ),
					'target' => '',
				];

			case 'page_link':
				return home_url( '/' );

			case 'image':
				return self::FAKE_ID_BASE + $this->next_image++;

			case 'gallery':
				return array_map( fn() => self::FAKE_ID_BASE + $this->next_image++, range( 1, 4 ) );

			case 'oembed':
				return 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';

			case 'select':
			case 'radio':
			case 'button_group':
				$value = '' !== $default && null !== $default ? $default : ( $choices[0] ?? null );
				return ! empty( $field['multiple'] ) && null !== $value ? (array) $value : $value;

			case 'checkbox':
				return $default ? (array) $default : array_slice( $choices, 0, 1 );

			case 'true_false':
				return '' !== $default && null !== $default ? (int) $default : 1;

			case 'color_picker':
				return $default ? $default : '#00365E';

			case 'date_picker':
				return gmdate( 'Ymd' );

			case 'date_time_picker':
				return gmdate( 'Y-m-d H:i:s' );

			case 'time_picker':
				return '09:30:00';

			case 'post_object':
			case 'relationship':
				$ids = get_posts(
					[
						'post_type'      => ! empty( $field['post_type'] ) ? (array) $field['post_type'] : 'post',
						'posts_per_page' => 'relationship' === $field['type'] ? 3 : 1,
						'fields'         => 'ids',
						'no_found_rows'  => true,
					]
				);
				if ( ! $ids ) {
					return null;
				}
				return 'post_object' === $field['type'] && empty( $field['multiple'] ) ? $ids[0] : $ids;

			case 'taxonomy':
				$terms = get_terms(
					[
						'taxonomy'   => $field['taxonomy'] ?? 'category',
						'number'     => 2,
						'fields'     => 'ids',
						'hide_empty' => false,
					]
				);
				return is_wp_error( $terms ) || ! $terms ? null : $terms;

			case 'user':
				return get_current_user_id() ? get_current_user_id() : null;

			case 'group':
				return $this->sample_fields( (array) ( $field['sub_fields'] ?? [] ), $block_title );

			case 'repeater':
				$min  = max( 1, (int) ( $field['min'] ?? 0 ) );
				$rows = max( $min, 3 );
				if ( ! empty( $field['max'] ) ) {
					$rows = min( $rows, (int) $field['max'] );
				}
				$value = [];
				for ( $i = 0; $i < $rows; $i++ ) {
					$value[ 'row-' . $i ] = $this->sample_fields( (array) ( $field['sub_fields'] ?? [] ), $block_title );
				}
				return $value;

			case 'flexible_content':
				$value = [];
				foreach ( array_values( (array) ( $field['layouts'] ?? [] ) ) as $i => $layout ) {
					$value[ 'row-' . $i ] = [ 'acf_fc_layout' => $layout['name'] ] + $this->sample_fields( (array) ( $layout['sub_fields'] ?? [] ), $block_title );
				}
				return $value;
		}

		return null;
	}
}
