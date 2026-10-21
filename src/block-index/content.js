/**
 * Content tab: every scanned page, post and template, with its block ribbon.
 */

/**
 * WordPress dependencies
 */
import { Fragment, useMemo, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { MISSING_COLOR, downloadCsv, num, originColor, originOf } from './data';
import {
	OriginLegend,
	RecordLinks,
	Ribbon,
	SortHeader,
	sortRows,
	useTooltip,
} from './common';

const PAGE_SIZE = 100;

export default function Content( {
	raw,
	blocks,
	records,
	registeredSet,
	view,
	setView,
} ) {
	const [ sort, setSort ] = useState( {
		column: 'total',
		direction: 'desc',
	} );
	const [ limit, setLimit ] = useState( PAGE_SIZE );
	const [ open, setOpen ] = useState( '' );
	const [ tip, show, hide ] = useTooltip();
	const query = view.search.trim().toLowerCase();
	const titles = useMemo(
		() =>
			Object.fromEntries(
				blocks.map( ( block ) => [ block.name, block.title ] )
			),
		[ blocks ]
	);

	const rows = useMemo( () => {
		const filtered = records.filter(
			( record ) =>
				( ! view.contains || record.blocks[ view.contains ] ) &&
				( ! query ||
					( record.title || '' ).toLowerCase().includes( query ) )
		);

		return sortRows( filtered, sort, ( row, column ) => {
			if ( column === 'unique' ) {
				return Object.keys( row.blocks ).length;
			}
			if ( column === 'type' ) {
				return raw.postTypes[ row.type ] || row.type;
			}
			return row[ column ] ?? '';
		} );
	}, [ records, view.contains, query, sort ] );

	const usedBlocks = useMemo(
		() =>
			blocks
				.filter( ( block ) => block.instances )
				.sort( ( a, b ) => a.title.localeCompare( b.title ) ),
		[ blocks ]
	);

	const exportCsv = () =>
		downloadCsv( 'block-index-content.csv', [
			[
				'Title',
				'Type',
				'Status',
				'Blocks',
				'Unique blocks',
				'Depth',
				'Edit URL',
				'Blocks used',
			],
			...rows.map( ( row ) => [
				row.title,
				raw.postTypes[ row.type ] || row.type,
				row.status,
				row.total,
				Object.keys( row.blocks ).length,
				row.depth,
				row.edit,
				Object.entries( row.blocks )
					.map( ( [ name, count ] ) => `${ name } (${ count })` )
					.join( '; ' ),
			] ),
		] );

	return (
		<div className="vgtpk-tab">
			<div className="vgtpk-filters">
				<label
					htmlFor="vgtpk-content-field-1"
					className="vgtpk-field vgtpk-field--search"
				>
					<span className="screen-reader-text">
						{ __( 'Search by title', 'viget-parts-kit' ) }
					</span>
					<input
						id="vgtpk-content-field-1"
						type="search"
						value={ view.search }
						onChange={ ( event ) =>
							setView( { search: event.target.value } )
						}
						placeholder={ __(
							'Search by title',
							'viget-parts-kit'
						) }
					/>
				</label>

				<label htmlFor="vgtpk-content-field-2" className="vgtpk-field">
					<span className="screen-reader-text">
						{ __( 'Contains block', 'viget-parts-kit' ) }
					</span>
					<select
						id="vgtpk-content-field-2"
						value={ view.contains }
						onChange={ ( event ) =>
							setView( { contains: event.target.value } )
						}
					>
						<option value="">
							{ __( 'Contains any block', 'viget-parts-kit' ) }
						</option>
						{ usedBlocks.map( ( block ) => (
							<option key={ block.name } value={ block.name }>
								{ block.title } ({ num( block.pages.length ) })
							</option>
						) ) }
					</select>
				</label>

				<OriginLegend missing />

				<button
					type="button"
					className="vgtpk-button vgtpk-button--ghost"
					onClick={ exportCsv }
				>
					{ __( 'Export CSV', 'viget-parts-kit' ) }
				</button>
			</div>

			<p className="vgtpk-count" aria-live="polite">
				{ sprintf(
					/* translators: %s: number of items. */
					_n( '%s item', '%s items', rows.length, 'viget-parts-kit' ),
					num( rows.length )
				) }
			</p>

			<table className="vgtpk-table vgtpk-table--content">
				<thead>
					<tr>
						<SortHeader
							label={ __( 'Title', 'viget-parts-kit' ) }
							column="title"
							sort={ sort }
							setSort={ setSort }
						/>
						<SortHeader
							label={ __( 'Type', 'viget-parts-kit' ) }
							column="type"
							sort={ sort }
							setSort={ setSort }
						/>
						<SortHeader
							label={ __( 'Blocks', 'viget-parts-kit' ) }
							column="total"
							sort={ sort }
							setSort={ setSort }
							numeric
						/>
						<SortHeader
							label={ __( 'Unique', 'viget-parts-kit' ) }
							column="unique"
							sort={ sort }
							setSort={ setSort }
							numeric
						/>
						<SortHeader
							label={ __( 'Depth', 'viget-parts-kit' ) }
							column="depth"
							sort={ sort }
							setSort={ setSort }
							numeric
						/>
						<th scope="col">
							{ __( 'Page structure', 'viget-parts-kit' ) }
						</th>
					</tr>
				</thead>
				<tbody>
					{ rows.slice( 0, limit ).map( ( record ) => {
						const isOpen = open === record.key;

						return (
							<Fragment key={ record.key }>
								<tr
									className={ `vgtpk-table__row${ isOpen ? ' is-open' : '' }` }
								>
									<td>
										<button
											type="button"
											className="vgtpk-row-toggle"
											aria-expanded={ isOpen }
											onClick={ () =>
												setOpen(
													isOpen ? '' : record.key
												)
											}
										>
											<span>
												<strong>
													{ record.title ||
														__(
															'(no title)',
															'viget-parts-kit'
														) }
												</strong>
												{ record.status !==
													'publish' && (
													<em className="vgtpk-status">
														{ raw.statuses[
															record.status
														] || record.status }
													</em>
												) }
											</span>
										</button>
									</td>
									<td>
										{ raw.postTypes[ record.type ] ||
											record.type }
									</td>
									<td className="is-numeric">
										{ num( record.total ) }
									</td>
									<td className="is-numeric">
										{ num(
											Object.keys( record.blocks ).length
										) }
									</td>
									<td className="is-numeric">
										{ record.depth || '—' }
									</td>
									<td className="vgtpk-table__ribbon">
										<Ribbon
											record={ record }
											theme={ raw.theme }
											registered={ registeredSet }
											highlight={ view.contains }
											onHover={ ( event, name ) =>
												show(
													event,
													<>
														<strong>
															{ titles[ name ] ||
																name }
														</strong>
														<code>{ name }</code>
													</>
												)
											}
											onLeave={ hide }
										/>
									</td>
								</tr>
								{ isOpen && (
									<tr className="vgtpk-table__detail">
										<td colSpan={ 6 }>
											<div className="vgtpk-detail">
												<div className="vgtpk-detail__main">
													<h3>
														{ __(
															'Blocks on this page',
															'viget-parts-kit'
														) }
													</h3>
													<ul className="vgtpk-tag-list">
														{ Object.entries(
															record.blocks
														)
															.sort(
																( a, b ) =>
																	b[ 1 ] -
																	a[ 1 ]
															)
															.map(
																( [
																	name,
																	count,
																] ) => (
																	<li
																		key={
																			name
																		}
																	>
																		<button
																			type="button"
																			onClick={ () =>
																				setView(
																					{
																						contains:
																							name,
																					}
																				)
																			}
																		>
																			<span
																				className="vgtpk-origin-dot"
																				style={ {
																					background:
																						registeredSet.has(
																							name
																						)
																							? originColor(
																									originOf(
																										name,
																										raw.theme
																									)
																								)
																							: MISSING_COLOR,
																				} }
																				aria-hidden="true"
																			/>
																			{ titles[
																				name
																			] ||
																				name }
																			<span>
																				{ num(
																					count
																				) }
																			</span>
																		</button>
																	</li>
																)
															) }
													</ul>
												</div>
												<div className="vgtpk-detail__side">
													<RecordLinks
														record={ record }
													/>
													{ record.origin && (
														<p className="vgtpk-muted">
															{ record.origin ===
															'theme'
																? __(
																		'From the theme’s files',
																		'viget-parts-kit'
																	)
																: __(
																		'Customized in the Site Editor',
																		'viget-parts-kit'
																	) }
														</p>
													) }
												</div>
											</div>
										</td>
									</tr>
								) }
							</Fragment>
						);
					} ) }
				</tbody>
			</table>

			{ rows.length > limit && (
				<button
					type="button"
					className="vgtpk-button vgtpk-button--ghost vgtpk-more"
					onClick={ () => setLimit( limit + PAGE_SIZE ) }
				>
					{ sprintf(
						/* translators: %s: remaining items. */
						__( 'Show more (%s left)', 'viget-parts-kit' ),
						num( rows.length - limit )
					) }
				</button>
			) }

			{ ! rows.length && (
				<p className="vgtpk-empty">
					{ __(
						'Nothing matches. Clear the search or the block filter.',
						'viget-parts-kit'
					) }
				</p>
			) }
			{ tip }
		</div>
	);
}
