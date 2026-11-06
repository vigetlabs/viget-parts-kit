/**
 * Explorer toolbar: viewport, background, layout context and actions for the current view.
 */

/**
 * WordPress dependencies
 */
import { useState, useRef, useEffect } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import {
	CodeIcon,
	DesktopIcon,
	ExternalIcon,
	FullIcon,
	LabelIcon,
	MenuIcon,
	PencilIcon,
	PhoneIcon,
	PlusIcon,
	TabletIcon,
} from './icons';

const VIEWPORT_ICONS = {
	mobile: PhoneIcon,
	tablet: TabletIcon,
	desktop: DesktopIcon,
	full: FullIcon,
};

// Background swatch picker.
function Backgrounds( { palette, value, onChange } ) {
	const [ open, setOpen ] = useState( false );
	const ref = useRef();

	useEffect( () => {
		if ( ! open ) {
			return;
		}

		const close = ( event ) => {
			if (
				event.type === 'keydown'
					? event.key === 'Escape'
					: ! ref.current?.contains( event.target )
			) {
				setOpen( false );
			}
		};

		document.addEventListener( 'mousedown', close );
		document.addEventListener( 'keydown', close );

		return () => {
			document.removeEventListener( 'mousedown', close );
			document.removeEventListener( 'keydown', close );
		};
	}, [ open ] );

	if ( ! palette.length ) {
		return null;
	}

	const current = palette.find( ( color ) => color.slug === value );

	return (
		<div className="vgtpk-popover-wrap" ref={ ref }>
			<button
				type="button"
				className="vgtpk-tool"
				aria-expanded={ open }
				aria-haspopup="true"
				onClick={ () => setOpen( ! open ) }
				title={ __( 'Background', 'viget-parts-kit' ) }
			>
				<span
					className={ `vgtpk-swatch${ current ? '' : ' is-none' }` }
					style={
						current ? { background: current.color } : undefined
					}
				/>
				<span className="vgtpk-tool__text">
					{ current
						? current.name
						: __( 'No background', 'viget-parts-kit' ) }
				</span>
			</button>
			{ open && (
				<div
					className="vgtpk-popover"
					role="group"
					aria-label={ __( 'Background', 'viget-parts-kit' ) }
				>
					<p className="vgtpk-popover__title">
						{ __( 'Show samples on', 'viget-parts-kit' ) }
					</p>
					<div className="vgtpk-swatches">
						<button
							type="button"
							className={ `vgtpk-swatch-button${ ! value ? ' is-active' : '' }` }
							onClick={ () => onChange( '' ) }
							aria-pressed={ ! value }
						>
							<span className="vgtpk-swatch is-none" />
							{ __( 'Page default', 'viget-parts-kit' ) }
						</button>
						{ palette.map( ( color ) => (
							<button
								type="button"
								key={ color.slug }
								className={ `vgtpk-swatch-button${ value === color.slug ? ' is-active' : '' }` }
								onClick={ () => onChange( color.slug ) }
								aria-pressed={ value === color.slug }
							>
								<span
									className="vgtpk-swatch"
									style={ { background: color.color } }
								/>
								{ color.name }
							</button>
						) ) }
					</div>
				</div>
			) }
		</div>
	);
}

export default function Toolbar( {
	data,
	state,
	setState,
	current,
	canvasUrl,
	infoOpen,
	setInfoOpen,
	onMenu,
	onCreatePage,
	creating,
} ) {
	const features = data.features;
	const viewports = features.viewports || [];
	const contexts = features.contexts || [];

	return (
		<div className="vgtpk-toolbar">
			<button
				type="button"
				className="vgtpk-tool vgtpk-tool--menu"
				onClick={ onMenu }
				aria-label={ __( 'Show block list', 'viget-parts-kit' ) }
			>
				<MenuIcon />
			</button>

			<div className="vgtpk-toolbar__title">
				<h1>
					{ current?.title || __( 'Parts Kit', 'viget-parts-kit' ) }
				</h1>
				{ current?.name && <code>{ current.name }</code> }
			</div>

			{ current && (
				<div className="vgtpk-toolbar__tools">
					{ viewports.length > 0 && (
						<div
							className="vgtpk-segmented"
							role="radiogroup"
							aria-label={ __( 'Viewport', 'viget-parts-kit' ) }
						>
							{ viewports.map( ( viewport ) => {
								const Icon =
									VIEWPORT_ICONS[ viewport.slug ] ||
									DesktopIcon;
								const active = state.viewport === viewport.slug;

								return (
									<button
										type="button"
										key={ viewport.slug }
										role="radio"
										aria-checked={ active }
										className={ active ? 'is-active' : '' }
										onClick={ () =>
											setState( {
												viewport: viewport.slug,
												width: null,
											} )
										}
										title={
											viewport.width
												? sprintf(
														/* translators: 1: viewport name, 2: width in pixels. */
														__(
															'%1$s, %2$dpx',
															'viget-parts-kit'
														),
														viewport.label,
														viewport.width
													)
												: viewport.label
										}
									>
										<Icon />
										<span className="screen-reader-text">
											{ viewport.label }
										</span>
									</button>
								);
							} ) }
						</div>
					) }

					{ features.backgrounds && (
						<Backgrounds
							palette={ data.palette }
							value={ state.bg }
							onChange={ ( bg ) => setState( { bg } ) }
						/>
					) }

					{ current.type === 'item' && contexts.length > 1 && (
						<label
							htmlFor="vgtpk-toolbar-field-1"
							className="vgtpk-select"
						>
							<span className="screen-reader-text">
								{ __( 'Layout', 'viget-parts-kit' ) }
							</span>
							<select
								id="vgtpk-toolbar-field-1"
								value={ state.ctx }
								onChange={ ( event ) =>
									setState( { ctx: event.target.value } )
								}
							>
								{ contexts.map( ( context ) => (
									<option
										key={ context.slug }
										value={ context.slug }
									>
										{ context.label }
									</option>
								) ) }
							</select>
						</label>
					) }

					{ current.type === 'item' && features.labels && (
						<button
							type="button"
							className={ `vgtpk-tool${ state.labels ? ' is-pressed' : '' }` }
							aria-pressed={ state.labels }
							onClick={ () =>
								setState( { labels: ! state.labels } )
							}
							title={ __( 'Sample labels', 'viget-parts-kit' ) }
						>
							<LabelIcon />
							<span className="screen-reader-text">
								{ __( 'Sample labels', 'viget-parts-kit' ) }
							</span>
						</button>
					) }

					<span className="vgtpk-toolbar__divider" />

					{ current.type === 'item' && features.details && (
						<button
							type="button"
							className={ `vgtpk-tool${ infoOpen ? ' is-pressed' : '' }` }
							aria-pressed={ infoOpen }
							onClick={ () => setInfoOpen( ! infoOpen ) }
							title={ __(
								'Details and markup',
								'viget-parts-kit'
							) }
						>
							<CodeIcon />
							<span className="screen-reader-text">
								{ __(
									'Details and markup',
									'viget-parts-kit'
								) }
							</span>
						</button>
					) }

					{ current.type === 'item' &&
						data.can.editPages &&
						features.createPage && (
							<button
								type="button"
								className="vgtpk-tool"
								onClick={ onCreatePage }
								disabled={ creating }
								title={ __(
									'Start a QA page from these samples',
									'viget-parts-kit'
								) }
							>
								<PlusIcon />
								<span className="screen-reader-text">
									{ __(
										'Start a QA page from these samples',
										'viget-parts-kit'
									) }
								</span>
							</button>
						) }

					{ current.type === 'page' && current.editUrl && (
						<a
							className="vgtpk-tool"
							href={ current.editUrl }
							title={ __( 'Edit this page', 'viget-parts-kit' ) }
						>
							<PencilIcon />
							<span className="vgtpk-tool__text">
								{ __( 'Edit', 'viget-parts-kit' ) }
							</span>
						</a>
					) }

					{ features.openInNewTab && (
						<a
							className="vgtpk-tool"
							href={ canvasUrl }
							target="_blank"
							rel="noreferrer"
							title={ __(
								'Open the preview in a new tab',
								'viget-parts-kit'
							) }
						>
							<ExternalIcon />
							<span className="screen-reader-text">
								{ __(
									'Open the preview in a new tab',
									'viget-parts-kit'
								) }
							</span>
						</a>
					) }
				</div>
			) }
		</div>
	);
}
