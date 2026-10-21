/**
 * The stage: a resizable iframe with a width ruler.
 */

/**
 * WordPress dependencies
 */
import { useEffect, useRef, useState, forwardRef } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */

const MIN_WIDTH = 320;

const Stage = forwardRef( function StageFrame(
	{ src, state, setState, title, onLoad, viewports, resize },
	iframeRef
) {
	const frameRef = useRef();
	const [ loading, setLoading ] = useState( true );
	const [ measured, setMeasured ] = useState( 0 );
	const [ resizing, setResizing ] = useState( false );

	const preset = viewports.find(
		( viewport ) => viewport.slug === state.viewport
	);
	const width = state.viewport === 'custom' ? state.width : preset?.width;

	useEffect( () => setLoading( true ), [ src ] );

	// Track the frame's rendered width for the ruler readout.
	useEffect( () => {
		const node = frameRef.current;

		if ( ! node || ! window.ResizeObserver ) {
			return;
		}

		const observer = new window.ResizeObserver( ( [ entry ] ) =>
			setMeasured( Math.round( entry.contentRect.width ) )
		);
		observer.observe( node );

		return () => observer.disconnect();
	}, [] );

	const startResize = ( event ) => {
		event.preventDefault();

		const startX = event.clientX;
		const startWidth = frameRef.current.getBoundingClientRect().width;
		const max =
			frameRef.current.parentElement.getBoundingClientRect().width;

		setResizing( true );

		const move = ( moveEvent ) => {
			// The frame is centered, so it grows on both sides.
			const next = Math.round(
				Math.min(
					max,
					Math.max(
						MIN_WIDTH,
						startWidth + ( moveEvent.clientX - startX ) * 2
					)
				)
			);
			setState( { viewport: 'custom', width: next } );
		};

		const stop = () => {
			setResizing( false );
			window.removeEventListener( 'pointermove', move );
			window.removeEventListener( 'pointerup', stop );
		};

		window.addEventListener( 'pointermove', move );
		window.addEventListener( 'pointerup', stop );
	};

	const nudge = ( event ) => {
		const step = event.shiftKey ? 100 : 10;
		const current = frameRef.current.getBoundingClientRect().width;

		if ( event.key === 'ArrowLeft' || event.key === 'ArrowRight' ) {
			event.preventDefault();
			const next = Math.max(
				MIN_WIDTH,
				Math.round(
					current + ( event.key === 'ArrowRight' ? step : -step )
				)
			);
			setState( { viewport: 'custom', width: next } );
		}
	};

	return (
		<div className={ `vgtpk-stage${ resizing ? ' is-resizing' : '' }` }>
			<div
				className="vgtpk-stage__frame"
				ref={ frameRef }
				style={ { width: width ? `${ width }px` : '100%' } }
			>
				<div className="vgtpk-ruler" aria-hidden="true">
					<span className="vgtpk-ruler__value">
						{ measured ? `${ measured }px` : '' }
					</span>
				</div>
				<div className="vgtpk-stage__viewport">
					{ loading && (
						<div className="vgtpk-stage__loading">
							{ __( 'Rendering…', 'viget-parts-kit' ) }
						</div>
					) }
					<iframe
						ref={ iframeRef }
						src={ src }
						title={ sprintf(
							/* translators: %s: block or page title. */
							__( 'Preview of %s', 'viget-parts-kit' ),
							title
						) }
						onLoad={ () => {
							setLoading( false );
							onLoad?.();
						} }
					/>
				</div>
				{ resize && (
					<>
						{ /* A focusable separator with a value is an interactive widget per ARIA. */ }
						{ /* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */ }
						<div
							className="vgtpk-stage__handle"
							role="separator"
							aria-orientation="vertical"
							aria-label={ __(
								'Resize preview',
								'viget-parts-kit'
							) }
							aria-valuenow={ measured }
							aria-valuemin={ MIN_WIDTH }
							tabIndex={ 0 }
							onPointerDown={ startResize }
							onKeyDown={ nudge }
						/>
					</>
				) }
			</div>
		</div>
	);
} );

export default Stage;
