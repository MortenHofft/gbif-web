import { useRef, useState } from 'react';
import type { Shot } from '../types';
import { shotUrl } from '../api';

type Mode = 'side' | 'overlay' | 'swipe';

interface Props {
  shot: Shot;
  proposalId: string;
}

export function ScreenshotPair({ shot, proposalId }: Props) {
  const [mode, setMode] = useState<Mode>('side');
  const beforeUrl = shotUrl(proposalId, shot.before);
  const afterUrl = shotUrl(proposalId, shot.after);

  return (
    <div className="shot">
      <div className="shot-header">
        <div>
          <strong>{shot.label}</strong>
          <small className="shot-meta">
            {shot.url} · {shot.viewport.width}×{shot.viewport.height}
            {shot.setup && <em> · setup: {shot.setup}</em>}
          </small>
        </div>
        <div className="shot-modes">
          <button className={mode === 'side' ? 'on' : ''} onClick={() => setMode('side')}>Side</button>
          <button className={mode === 'overlay' ? 'on' : ''} onClick={() => setMode('overlay')}>Overlay</button>
          <button className={mode === 'swipe' ? 'on' : ''} onClick={() => setMode('swipe')}>Swipe</button>
        </div>
      </div>
      {mode === 'side' && (
        <div className="shot-side">
          <figure>
            <figcaption>Before</figcaption>
            <img src={beforeUrl} alt={`${shot.label} before`} />
          </figure>
          <figure>
            <figcaption>After</figcaption>
            <img src={afterUrl} alt={`${shot.label} after`} />
          </figure>
        </div>
      )}
      {mode === 'overlay' && <OverlayView beforeUrl={beforeUrl} afterUrl={afterUrl} />}
      {mode === 'swipe' && <SwipeView beforeUrl={beforeUrl} afterUrl={afterUrl} />}
    </div>
  );
}

function OverlayView({ beforeUrl, afterUrl }: { beforeUrl: string; afterUrl: string }) {
  const [opacity, setOpacity] = useState(0.5);
  return (
    <div className="shot-overlay">
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={opacity}
        onChange={(e) => setOpacity(parseFloat(e.target.value))}
      />
      <div className="overlay-stage">
        <img src={beforeUrl} alt="before" />
        <img src={afterUrl} alt="after" style={{ opacity }} className="after" />
      </div>
    </div>
  );
}

function SwipeView({ beforeUrl, afterUrl }: { beforeUrl: string; afterUrl: string }) {
  const [pos, setPos] = useState(0.5);
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!ref.current) return;
    if (e.buttons !== 1 && e.type === 'mousemove') return;
    const rect = ref.current.getBoundingClientRect();
    setPos(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
  }

  return (
    <div
      className="shot-swipe"
      ref={ref}
      onMouseDown={onMove}
      onMouseMove={onMove}
    >
      <img src={beforeUrl} alt="before" />
      <div className="swipe-after" style={{ width: `${pos * 100}%` }}>
        <img src={afterUrl} alt="after" />
      </div>
      <div className="swipe-handle" style={{ left: `${pos * 100}%` }} />
    </div>
  );
}
