<?php
/**
 * Access class
 *
 * @package Viget\PartsKit
 */

namespace Viget\PartsKit;

/**
 * Decides who can view and manage the Parts Kit.
 */
class Access {

	/**
	 * Whether the current visitor can view the Parts Kit.
	 *
	 * @return bool
	 */
	public static function can_view(): bool {
		$settings = vgtpk()->settings;
		$can_view = 'public' === $settings->get( 'visibility' ) || current_user_can( (string) $settings->get( 'capability' ) );

		/**
		 * Filters whether the current visitor can view the Parts Kit.
		 *
		 * @param bool $can_view Whether the visitor can view it.
		 */
		return (bool) apply_filters( 'vgtpk_can_view', $can_view );
	}

	/**
	 * Whether the current user can rebuild the catalog and change settings.
	 *
	 * @return bool
	 */
	public static function can_manage(): bool {
		/**
		 * Filters whether the current user can rebuild the catalog and change settings.
		 *
		 * @param bool $can_manage Defaults to the edit_theme_options capability.
		 */
		return (bool) apply_filters( 'vgtpk_can_manage', current_user_can( 'edit_theme_options' ) );
	}

	/**
	 * Whether the current user can open the Block Index.
	 *
	 * @return bool
	 */
	public static function can_index(): bool {
		/**
		 * Filters whether the current user can open the Block Index.
		 *
		 * @param bool $can_index Defaults to the edit_others_posts capability.
		 */
		return (bool) apply_filters( 'vgtpk_can_index', current_user_can( 'edit_others_posts' ) );
	}

	/**
	 * Stop the request unless the visitor can view the Parts Kit.
	 *
	 * @return void
	 */
	public static function guard(): void {
		if ( self::can_view() ) {
			return;
		}

		if ( ! is_user_logged_in() ) {
			auth_redirect();
		}

		wp_die(
			esc_html__( 'You don’t have access to the Parts Kit. Ask a site administrator to change who can view it.', 'viget-parts-kit' ),
			esc_html__( 'Parts Kit', 'viget-parts-kit' ),
			[ 'response' => 403 ]
		);
	}
}
