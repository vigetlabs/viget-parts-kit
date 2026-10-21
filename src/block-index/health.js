/**
 * Health tab: findings worth a look, most serious first.
 */

/**
 * WordPress dependencies
 */
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { num } from './data';
import { RecordLinks } from './common';

const LEVELS = {
	critical: { glyph: '!', label: __( 'Fix', 'viget-parts-kit' ) },
	serious: { glyph: '▲', label: __( 'Review', 'viget-parts-kit' ) },
	warning: { glyph: '◆', label: __( 'Consider', 'viget-parts-kit' ) },
	info: { glyph: 'i', label: __( 'Note', 'viget-parts-kit' ) },
};

const LIST_LIMIT = 12;

export default function Health( { issues, raw, goTo } ) {
	if ( ! issues.length ) {
		return (
			<div className="vgtpk-tab">
				<p className="vgtpk-empty">
					{ __(
						'Nothing needs attention with these filters. Every block in use is registered, and no page stands out.',
						'viget-parts-kit'
					) }
				</p>
			</div>
		);
	}

	return (
		<div className="vgtpk-tab">
			<ol className="vgtpk-findings">
				{ issues.map( ( issue ) => {
					const level = LEVELS[ issue.level ];
					const count = (
						issue.blocks ||
						issue.records ||
						issue.styles
					).length;

					return (
						<li
							key={ issue.key }
							className={ `vgtpk-finding vgtpk-finding--${ issue.level }` }
						>
							<header>
								<span className="vgtpk-finding__level">
									<span aria-hidden="true">
										{ level.glyph }
									</span>
									{ level.label }
								</span>
								<h2>{ issue.title }</h2>
								<span className="vgtpk-finding__count">
									{ num( count ) }
								</span>
							</header>
							<p>{ issue.detail }</p>

							{ issue.blocks && (
								<ul className="vgtpk-tag-list">
									{ issue.blocks.map( ( block ) => (
										<li key={ block.name }>
											<button
												type="button"
												onClick={ () =>
													goTo( 'blocks', {
														expand: block.name,
														status: 'all',
													} )
												}
											>
												{ block.title }
												<code>{ block.name }</code>
												{ block.instances > 0 && (
													<span>
														{ sprintf(
															/* translators: %s: page count. */
															_n(
																'%s page',
																'%s pages',
																block.pages
																	.length,
																'viget-parts-kit'
															),
															num(
																block.pages
																	.length
															)
														) }
													</span>
												) }
											</button>
										</li>
									) ) }
								</ul>
							) }

							{ issue.styles && (
								<ul className="vgtpk-tag-list">
									{ issue.styles.map(
										( { block, style, count: uses } ) => (
											<li
												key={ `${ block.name }-${ style }` }
											>
												<button
													type="button"
													onClick={ () =>
														goTo( 'blocks', {
															expand: block.name,
															status: 'all',
														} )
													}
												>
													{ block.title }
													<code>
														is-style-{ style }
													</code>
													<span>{ num( uses ) }</span>
												</button>
											</li>
										)
									) }
								</ul>
							) }

							{ issue.records && (
								<ul className="vgtpk-finding__records">
									{ issue.records
										.slice( 0, LIST_LIMIT )
										.map( ( record ) => (
											<li key={ record.key }>
												<span>
													{ record.title ||
														__(
															'(no title)',
															'viget-parts-kit'
														) }
													<small>
														{ raw.postTypes[
															record.type
														] || record.type }
													</small>
												</span>
												<RecordLinks
													record={ record }
												/>
											</li>
										) ) }
									{ issue.records.length > LIST_LIMIT && (
										<li className="vgtpk-muted">
											{ sprintf(
												/* translators: %s: number of further items. */
												__(
													'And %s more. Export the Content tab to see them all.',
													'viget-parts-kit'
												),
												num(
													issue.records.length -
														LIST_LIMIT
												)
											) }
										</li>
									) }
								</ul>
							) }
						</li>
					);
				} ) }
			</ol>
		</div>
	);
}
