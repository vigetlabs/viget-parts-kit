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
	ChevronIcon,
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

// A toolbar button that opens a list of choices. Closes on a choice, Escape, or a click anywhere else.
function Picker( { label, buttonLabel, swatch, options, value, onChange } ) {
	const [ open, setOpen ] = useState( false );
	const ref = useRef();

	useEffect( () => {
		if ( ! open ) {
			return;
		}

		const close = ( event ) => {
			if (
				event.type === 'blur' ||
				( event.type === 'keydown'
					? event.key === 'Escape'
					: ! ref.current?.contains( event.target ) )
			) {
				setOpen( false );
			}
		};

		document.addEventListener( 'mousedown', close );
		document.addEventListener( 'keydown', close );
		// Clicks inside the preview iframe only blur this window.
		window.addEventListener( 'blur', close );

		return () => {
			document.removeEventListener( 'mousedown', close );
			document.removeEventListener( 'keydown', close );
			window.removeEventListener( 'blur', close );
		};
	}, [ open ] );

	return (
		<div className="vgtpk-popover-wrap" ref={ ref }>
			<button
				type="button"
				className="vgtpk-tool"
				aria-expanded={ open }
				aria-haspopup="true"
				onClick={ () => setOpen( ! open ) }
				data-tooltip={ label }
			>
				{ swatch }
				<span className="vgtpk-tool__text">{ buttonLabel }</span>
				<ChevronIcon />
			</button>
			{ open && (
				<div
					className="vgtpk-popover"
					role="group"
					aria-label={ label }
				>
					<p className="vgtpk-popover__title">{ label }</p>
					<div className="vgtpk-swatches">
						{ options.map( ( option ) => (
							<button
								type="button"
								key={ option.value }
								className={ `vgtpk-swatch-button${ value === option.value ? ' is-active' : '' }` }
								onClick={ () => {
									onChange( option.value );
									setOpen( false );
								} }
								aria-pressed={ value === option.value }
							>
								{ option.swatch }
								{ option.label }
							</button>
						) ) }
					</div>
				</div>
			) }
		</div>
	);
}

const Swatch = ( { color } ) => (
	<span
		className={ `vgtpk-swatch${ color ? '' : ' is-none' }` }
		style={ color ? { background: color } : undefined }
	/>
);

// Background swatch picker.
function Backgrounds( { palette, value, onChange } ) {
	if ( ! palette.length ) {
		return null;
	}

	const current = palette.find( ( color ) => color.slug === value );

	return (
		<Picker
			label={ __( 'Background', 'viget-parts-kit' ) }
			buttonLabel={
				current
					? current.name
					: __( 'No background', 'viget-parts-kit' )
			}
			swatch={ <Swatch color={ current?.color } /> }
			value={ value }
			onChange={ onChange }
			options={ [
				{
					value: '',
					label: __( 'Page default', 'viget-parts-kit' ),
					swatch: <Swatch />,
				},
				...palette.map( ( color ) => ( {
					value: color.slug,
					label: color.name,
					swatch: <Swatch color={ color.color } />,
				} ) ),
			] }
		/>
	);
}

// Layout context picker.
function Contexts( { contexts, value, onChange } ) {
	const current =
		contexts.find( ( context ) => context.slug === value ) || contexts[ 0 ];

	return (
		<Picker
			label={ __( 'Container', 'viget-parts-kit' ) }
			buttonLabel={ sprintf(
				/* translators: %s: container name. */
				__( 'Container: %s', 'viget-parts-kit' ),
				current.label
			) }
			value={ current.slug }
			onChange={ onChange }
			options={ contexts.map( ( context ) => ( {
				value: context.slug,
				label: context.label,
			} ) ) }
		/>
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
	const palette = Array.isArray( features.backgrounds )
		? data.palette.filter( ( color ) =>
				features.backgrounds.includes( color.slug )
			)
		: data.palette;

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
										data-tooltip={
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
							palette={ palette }
							value={ state.bg }
							onChange={ ( bg ) => setState( { bg } ) }
						/>
					) }

					{ current.type === 'item' && contexts.length > 1 && (
						<Contexts
							contexts={ contexts }
							value={ state.ctx }
							onChange={ ( ctx ) => setState( { ctx } ) }
						/>
					) }

					{ current.type === 'item' && features.labels && (
						<button
							type="button"
							className={ `vgtpk-tool${ state.labels ? ' is-pressed' : '' }` }
							aria-pressed={ state.labels }
							onClick={ () =>
								setState( { labels: ! state.labels } )
							}
							data-tooltip={ __(
								'Sample labels',
								'viget-parts-kit'
							) }
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
							data-tooltip={ __(
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
								data-tooltip={ __(
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
							data-tooltip={ __(
								'Edit this page',
								'viget-parts-kit'
							) }
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
							data-tooltip={ __(
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
