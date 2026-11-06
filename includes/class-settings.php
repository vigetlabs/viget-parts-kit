<?php
/**
 * Settings class
 *
 * @package Viget\PartsKit
 */

namespace Viget\PartsKit;

/**
 * Stores and renders plugin settings.
 */
class Settings {

	/**
	 * Option name.
	 */
	const OPTION_NAME = 'vgtpk_settings';

	/**
	 * Settings page slug.
	 */
	const PAGE_SLUG = 'vgtpk-settings';

	/**
	 * Cached settings for the request.
	 *
	 * @var array|null
	 */
	private ?array $settings = null;

	/**
	 * Constructor.
	 */
	public function __construct() {
		add_action( 'admin_init', [ $this, 'register' ] );
	}

	/**
	 * Default settings.
	 *
	 * @return array
	 */
	public static function defaults(): array {
		return [
			'visibility'      => 'private',
			'capability'      => 'edit_posts',
			'excluded_blocks' => [],
			'placeholder_bg'  => 'E5F6FC',
			'placeholder_fg'  => '00365E',
		];
	}

	/**
	 * Store defaults without autoloading them. Settings are only read on Parts Kit screens.
	 *
	 * @return void
	 */
	public static function add_defaults(): void {
		add_option( self::OPTION_NAME, self::defaults(), '', false );
	}

	/**
	 * Get all settings merged over defaults.
	 *
	 * @return array
	 */
	public function get_settings(): array {
		if ( null === $this->settings ) {
			$saved          = get_option( self::OPTION_NAME, [] );
			$this->settings = array_merge( self::defaults(), \is_array( $saved ) ? $saved : [] );
		}

		/**
		 * Filters the Parts Kit settings.
		 *
		 * @param array $settings Settings merged over defaults.
		 */
		return apply_filters( 'vgtpk_settings', $this->settings );
	}

	/**
	 * Get one setting.
	 *
	 * @param string $key Setting key.
	 *
	 * @return mixed
	 */
	public function get( string $key ): mixed {
		return $this->get_settings()[ $key ] ?? null;
	}

	/**
	 * Register the setting with the Settings API.
	 *
	 * @return void
	 */
	public function register(): void {
		register_setting(
			self::PAGE_SLUG,
			self::OPTION_NAME,
			[
				'type'              => 'array',
				'sanitize_callback' => [ $this, 'sanitize' ],
				'default'           => self::defaults(),
			]
		);

		add_filter( 'option_page_capability_' . self::PAGE_SLUG, static fn() => 'edit_theme_options' );
	}

	/**
	 * Sanitize submitted settings.
	 *
	 * @param mixed $input Raw input.
	 *
	 * @return array
	 */
	public function sanitize( mixed $input ): array {
		$input    = \is_array( $input ) ? $input : [];
		$defaults = self::defaults();
		$caps     = array_keys( self::capability_choices() );

		$excluded = $input['excluded_blocks'] ?? [];
		if ( \is_string( $excluded ) ) {
			$excluded = preg_split( '/[\s,]+/', $excluded );
		}

		$excluded = array_values(
			array_unique(
				array_filter(
					array_map(
						static fn( $name ) => preg_replace( '/[^a-z0-9\-\/_]/', '', strtolower( (string) $name ) ),
						(array) $excluded
					)
				)
			)
		);

		$this->settings = null;

		return [
			'visibility'      => 'public' === ( $input['visibility'] ?? '' ) ? 'public' : 'private',
			'capability'      => \in_array( $input['capability'] ?? '', $caps, true ) ? $input['capability'] : $defaults['capability'],
			'excluded_blocks' => $excluded,
			'placeholder_bg'  => self::sanitize_hex( $input['placeholder_bg'] ?? '', $defaults['placeholder_bg'] ),
			'placeholder_fg'  => self::sanitize_hex( $input['placeholder_fg'] ?? '', $defaults['placeholder_fg'] ),
		];
	}

	/**
	 * Sanitize a hex color to six uppercase digits, no hash.
	 *
	 * @param string $value    Raw value.
	 * @param string $fallback Fallback value.
	 *
	 * @return string
	 */
	public static function sanitize_hex( string $value, string $fallback ): string {
		$value = ltrim( trim( $value ), '#' );

		if ( preg_match( '/^[0-9a-fA-F]{3}$/', $value ) ) {
			$value = $value[0] . $value[0] . $value[1] . $value[1] . $value[2] . $value[2];
		}

		return preg_match( '/^[0-9a-fA-F]{6}$/', $value ) ? strtoupper( $value ) : $fallback;
	}

	/**
	 * Capabilities offered for private visibility.
	 *
	 * @return array
	 */
	public static function capability_choices(): array {
		return [
			'read'               => __( 'Anyone logged in', 'viget-parts-kit' ),
			'edit_posts'         => __( 'Contributors and up', 'viget-parts-kit' ),
			'publish_pages'      => __( 'Editors and up', 'viget-parts-kit' ),
			'edit_theme_options' => __( 'Administrators only', 'viget-parts-kit' ),
		];
	}

	/**
	 * Render the settings page.
	 *
	 * @return void
	 */
	public function render_page(): void {
		$settings = $this->get_settings();
		$choices  = self::capability_choices();

		require VGTPK_PLUGIN_PATH . 'views/admin/settings.php';
	}
}
