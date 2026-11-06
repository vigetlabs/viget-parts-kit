<?php
/**
 * Settings page.
 *
 * @var array $settings Current settings.
 * @var array $choices  Capability choices.
 *
 * @package Viget\PartsKit
 */

use Viget\PartsKit\Settings;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$option = Settings::OPTION_NAME;
?>
<div class="wrap">
	<h1><?php esc_html_e( 'Parts Kit Settings', 'viget-parts-kit' ); ?></h1>

	<form method="post" action="options.php">
		<?php settings_fields( Settings::PAGE_SLUG ); ?>

		<table class="form-table" role="presentation">
			<tr>
				<th scope="row"><?php esc_html_e( 'Who can view', 'viget-parts-kit' ); ?></th>
				<td>
					<fieldset>
						<label>
							<input type="radio" name="<?php echo esc_attr( $option ); ?>[visibility]" value="private" <?php checked( 'private', $settings['visibility'] ); ?>>
							<?php esc_html_e( 'Logged-in users with this role or higher:', 'viget-parts-kit' ); ?>
						</label>
						<select name="<?php echo esc_attr( $option ); ?>[capability]" aria-label="<?php esc_attr_e( 'Minimum role', 'viget-parts-kit' ); ?>">
							<?php foreach ( $choices as $cap => $label ) : ?>
								<option value="<?php echo esc_attr( $cap ); ?>" <?php selected( $cap, $settings['capability'] ); ?>><?php echo esc_html( $label ); ?></option>
							<?php endforeach; ?>
						</select>
						<br>
						<label>
							<input type="radio" name="<?php echo esc_attr( $option ); ?>[visibility]" value="public" <?php checked( 'public', $settings['visibility'] ); ?>>
							<?php esc_html_e( 'Anyone with the link', 'viget-parts-kit' ); ?>
						</label>
						<p class="description"><?php esc_html_e( 'Public is handy for client review on staging. Parts Kit pages are always kept out of search engines and sitemaps.', 'viget-parts-kit' ); ?></p>
					</fieldset>
				</td>
			</tr>
			<tr>
				<th scope="row"><label for="vgtpk-excluded"><?php esc_html_e( 'Leave out blocks', 'viget-parts-kit' ); ?></label></th>
				<td>
					<textarea id="vgtpk-excluded" class="large-text code" rows="4" name="<?php echo esc_attr( $option ); ?>[excluded_blocks]" placeholder="core/verse&#10;core/rss"><?php echo esc_textarea( implode( "\n", $settings['excluded_blocks'] ) ); ?></textarea>
					<p class="description"><?php esc_html_e( 'One block name per line. These stay out of the Parts Kit even if they’re registered.', 'viget-parts-kit' ); ?></p>
				</td>
			</tr>
			<tr>
				<th scope="row"><?php esc_html_e( 'Placeholder images', 'viget-parts-kit' ); ?></th>
				<td>
					<label>
						<?php esc_html_e( 'Background', 'viget-parts-kit' ); ?>
						<input type="text" class="small-text code" maxlength="7" name="<?php echo esc_attr( $option ); ?>[placeholder_bg]" value="<?php echo esc_attr( '#' . $settings['placeholder_bg'] ); ?>">
					</label>
					&nbsp;
					<label>
						<?php esc_html_e( 'Text', 'viget-parts-kit' ); ?>
						<input type="text" class="small-text code" maxlength="7" name="<?php echo esc_attr( $option ); ?>[placeholder_fg]" value="<?php echo esc_attr( '#' . $settings['placeholder_fg'] ); ?>">
					</label>
					<p class="description">
						<?php
						printf(
							/* translators: %s: placehold.co link. */
							esc_html__( 'Sample images come from %s. Rebuild the Parts Kit after changing these.', 'viget-parts-kit' ),
							'<a href="https://placehold.co/" target="_blank" rel="noopener">placehold.co</a>'
						);
						?>
					</p>
				</td>
			</tr>
		</table>

		<?php submit_button(); ?>
	</form>
</div>
