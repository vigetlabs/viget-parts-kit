/**
 * Styles tab: registered block styles against what content actually uses.
 */

/**
 * WordPress dependencies
 */
import { useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { num, originColor } from './data';

export default function StylesTab( { blocks, goTo } ) {
	const rows = useMemo(
		() =>
			blocks
				.filter(
					( block ) =>
						block.registeredStyles.length ||
						Object.keys( block.styles ).length
				)
				.map( ( block ) => {
					const names = [
						...new Set( [
							...block.registeredStyles.map(
								( style ) => style.name
							),
							...Object.keys( block.styles ),
						] ),
					];

					return {
						block,
						styles: names.map( ( name ) => ( {
							name,
							label:
								block.registeredStyles.find(
									( style ) => style.name === name
								)?.label || name,
							registered: block.registeredStyles.some(
								( style ) => style.name === name
							),
							count: block.styles[ name ] || 0,
						} ) ),
					};
				} )
				.sort( ( a, b ) => b.block.instances - a.block.instances ),
		[ blocks ]
	);

	if ( ! rows.length ) {
		return (
			<p className="vgtpk-empty">
				{ __(
					'No block styles are registered or used.',
					'viget-parts-kit'
				) }
			</p>
		);
	}

	return (
		<div className="vgtpk-tab">
			<p className="vgtpk-intro">
				{ __(
					'Each block’s registered styles, with how often content uses them. Styles never used may not need maintaining; styles used but no longer registered can’t be picked again by authors.',
					'viget-parts-kit'
				) }
			</p>

			<ul className="vgtpk-style-grid">
				{ rows.map( ( { block, styles } ) => {
					const max = Math.max(
						1,
						...styles.map( ( style ) => style.count )
					);

					return (
						<li key={ block.name } className="vgtpk-style-card">
							<button
								type="button"
								className="vgtpk-style-card__title"
								onClick={ () =>
									goTo( 'blocks', {
										expand: block.name,
										status: 'all',
									} )
								}
							>
								<span
									className="vgtpk-origin-dot"
									style={ {
										background: originColor( block.origin ),
									} }
									aria-hidden="true"
								/>
								<strong>{ block.title }</strong>
								<code>{ block.name }</code>
							</button>
							<ul className="vgtpk-style-card__styles">
								{ styles.map( ( style ) => (
									<li
										key={ style.name }
										className={ `${ style.count ? '' : 'is-unused' }${ style.registered ? '' : ' is-unregistered' }` }
									>
										<span className="vgtpk-style-card__name">
											{ style.label }
											{ ! style.registered && (
												<em>
													{ __(
														'not registered',
														'viget-parts-kit'
													) }
												</em>
											) }
										</span>
										<span
											className="vgtpk-style-card__bar"
											aria-hidden="true"
										>
											<span
												style={ {
													width: `${ ( style.count / max ) * 100 }%`,
													background: originColor(
														block.origin
													),
												} }
											/>
										</span>
										<span className="vgtpk-style-card__count">
											{ style.count
												? num( style.count )
												: __(
														'never',
														'viget-parts-kit'
													) }
										</span>
									</li>
								) ) }
							</ul>
						</li>
					);
				} ) }
			</ul>
		</div>
	);
}
