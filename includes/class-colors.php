<?php
/**
 * Colors class
 *
 * @package Viget\PartsKit
 */

namespace Viget\PartsKit;

/**
 * Resolves the current user's admin color scheme into the palette the Parts Kit UI uses.
 *
 * Custom schemes (like VigetWP's) register on admin_init, so they don't exist on the
 * frontend explorer. Their swatches are remembered in a small autoloaded option, written
 * only when they change.
 */
class Colors {

	/**
	 * Option remembering custom scheme swatches for frontend screens.
	 */
	const OPTION_NAME = 'vgtpk_admin_schemes';

	/**
	 * Core schemes' --wp-admin-theme-color, from wp-base-styles. Others use their highlight swatch.
	 */
	const THEME_COLORS = [
		'fresh'     => '#2271b1',
		'light'     => '#007cba',
		'modern'    => '#3858e9',
		'blue'      => '#437aa8',
		'coffee'    => '#916745',
		'ectoplasm' => '#646c3e',
		'midnight'  => '#cf4339',
		'ocean'     => '#567958',
	];

	/**
	 * Core scheme keys, which never need remembering.
	 */
	const CORE_SCHEMES = [ 'fresh', 'light', 'modern', 'blue', 'coffee', 'ectoplasm', 'midnight', 'ocean', 'sunrise' ];

	/**
	 * Constructor.
	 */
	public function __construct() {
		add_action( 'admin_init', [ $this, 'remember_custom_schemes' ], 999 );
	}

	/**
	 * Remember custom schemes' swatches so frontend screens can use them.
	 *
	 * @return void
	 */
	public function remember_custom_schemes(): void {
		global $_wp_admin_css_colors;

		$custom = [];

		foreach ( (array) $_wp_admin_css_colors as $key => $scheme ) {
			if ( ! \in_array( $key, self::CORE_SCHEMES, true ) && ! empty( $scheme->colors ) ) {
				$custom[ $key ] = array_values( (array) $scheme->colors );
			}
		}

		if ( get_option( self::OPTION_NAME, [] ) !== $custom ) {
			update_option( self::OPTION_NAME, $custom, true );
		}
	}

	/**
	 * The current user's scheme key.
	 *
	 * @return string
	 */
	public static function scheme(): string {
		$scheme = is_user_logged_in() ? (string) get_user_option( 'admin_color' ) : '';

		return $scheme ? $scheme : 'fresh';
	}

	/**
	 * Swatches for a scheme.
	 *
	 * @param string $scheme Scheme key.
	 *
	 * @return array
	 */
	private static function swatches( string $scheme ): array {
		global $_wp_admin_css_colors;

		if ( empty( $_wp_admin_css_colors ) && function_exists( 'register_admin_color_schemes' ) ) {
			register_admin_color_schemes();
		}

		if ( ! empty( $_wp_admin_css_colors[ $scheme ]->colors ) ) {
			return array_values( (array) $_wp_admin_css_colors[ $scheme ]->colors );
		}

		$custom = (array) get_option( self::OPTION_NAME, [] );

		if ( ! empty( $custom[ $scheme ] ) ) {
			return $custom[ $scheme ];
		}

		return $_wp_admin_css_colors['fresh']->colors ?? [ '#1d2327', '#2c3338', '#2271b1', '#72aee6' ];
	}

	/**
	 * The palette for the current user.
	 *
	 * @return array{base: string, onBase: string, primary: string, onPrimary: string, accent: string, scheme: string}
	 */
	public static function get(): array {
		$scheme   = self::scheme();
		$swatches = self::swatches( $scheme );
		$base     = $swatches[0] ?? '#1d2327';
		$primary  = self::THEME_COLORS[ $scheme ] ?? ( $swatches[2] ?? $swatches[1] ?? '#2271b1' );
		$accent   = $swatches[3] ?? $primary;

		$colors = [
			'scheme'  => $scheme,
			'base'    => $base,
			'primary' => $primary,
			'accent'  => $accent,
		];

		/**
		 * Filters the colors the Parts Kit and Block Index use. Defaults come from the
		 * current user's admin color scheme.
		 *
		 * @param array $colors `base` (sidebar), `primary` (buttons, links, active states)
		 *                      and `accent` (the active-item marker), plus `scheme`.
		 */
		$colors = (array) apply_filters( 'vgtpk_admin_colors', $colors );

		$base    = self::sanitize( $colors['base'] ?? '', '#1d2327' );
		$primary = self::readable( self::sanitize( $colors['primary'] ?? '', '#2271b1' ), '#ffffff', 4.5 );

		return [
			'scheme'    => (string) ( $colors['scheme'] ?? $scheme ),
			'base'      => $base,
			'onBase'    => self::contrast( $base, '#ffffff' ) >= 4.5 ? '#ffffff' : '#1e1e1e',
			'primary'   => $primary,
			'onPrimary' => self::contrast( $primary, '#ffffff' ) >= 4.5 ? '#ffffff' : '#1e1e1e',
			'accent'    => self::sanitize( $colors['accent'] ?? '', $primary ),
		];
	}

	/**
	 * CSS custom properties for the palette, scoped to a selector.
	 *
	 * @param string $selector Selector to scope to.
	 *
	 * @return string
	 */
	public static function css( string $selector = ':root' ): string {
		$colors = self::get();

		return sprintf(
			'%s{--vgtpk-base:%s;--vgtpk-on-base:%s;--vgtpk-primary:%s;--vgtpk-on-primary:%s;--vgtpk-accent:%s;}',
			$selector,
			$colors['base'],
			$colors['onBase'],
			$colors['primary'],
			$colors['onPrimary'],
			$colors['accent']
		);
	}

	/**
	 * Sanitize a hex color.
	 *
	 * @param string $color    Raw color.
	 * @param string $fallback Fallback.
	 *
	 * @return string
	 */
	private static function sanitize( string $color, string $fallback ): string {
		$color = sanitize_hex_color( trim( $color ) );

		if ( ! $color ) {
			return $fallback;
		}

		if ( 4 === \strlen( $color ) ) {
			$color = '#' . $color[1] . $color[1] . $color[2] . $color[2] . $color[3] . $color[3];
		}

		return strtolower( $color );
	}

	/**
	 * Relative luminance of a hex color.
	 *
	 * @param string $hex Six-digit hex.
	 *
	 * @return float
	 */
	private static function luminance( string $hex ): float {
		$channels = array_map(
			static function ( $pair ) {
				$value = hexdec( $pair ) / 255;
				return $value <= 0.03928 ? $value / 12.92 : ( ( $value + 0.055 ) / 1.055 ) ** 2.4;
			},
			str_split( ltrim( $hex, '#' ), 2 )
		);

		return 0.2126 * $channels[0] + 0.7152 * $channels[1] + 0.0722 * $channels[2];
	}

	/**
	 * WCAG contrast ratio between two hex colors.
	 *
	 * @param string $a Hex.
	 * @param string $b Hex.
	 *
	 * @return float
	 */
	public static function contrast( string $a, string $b ): float {
		$la = self::luminance( $a );
		$lb = self::luminance( $b );

		return ( max( $la, $lb ) + 0.05 ) / ( min( $la, $lb ) + 0.05 );
	}

	/**
	 * Darken a color until it reaches a contrast ratio against a background.
	 *
	 * Some schemes' highlights are too light for links and button text on white.
	 *
	 * @param string $hex        Hex.
	 * @param string $background Background hex.
	 * @param float  $ratio      Target ratio.
	 *
	 * @return string
	 */
	private static function readable( string $hex, string $background, float $ratio ): string {
		$steps = 0;

		while ( self::contrast( $hex, $background ) < $ratio && $steps < 20 ) {
			$hex = '#' . implode(
				'',
				array_map(
					static fn( $pair ) => str_pad( dechex( (int) round( hexdec( $pair ) * 0.92 ) ), 2, '0', STR_PAD_LEFT ),
					str_split( ltrim( $hex, '#' ), 2 )
				)
			);
			++$steps;
		}

		return $hex;
	}
}
