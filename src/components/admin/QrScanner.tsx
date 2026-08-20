'use client';

import jsQR from 'jsqr';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ScanOutcome } from '@/lib/types';
import { ScanResult } from './ScanResult';

/**
 * Camera-based ticket validator.
 *
 * Decoding prefers the native BarcodeDetector where it exists — it is
 * hardware-accelerated and dramatically better in the low light of an actual
 * door — and falls back to jsQR over canvas frames everywhere else.
 */

// BarcodeDetector is not in TypeScript's DOM lib yet.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorCtor {
  new (options?: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

/** Decode attempts per second. Every frame would pin the CPU and cook the battery. */
const DECODE_INTERVAL_MS = 120;
/** A QR sits in frame for many frames; without this each one fires dozens of requests. */
const DUPLICATE_WINDOW_MS = 3000;
/** Frames are downscaled before decoding — 1280px costs ~4x for no gain at door range. */
const MAX_DECODE_EDGE = 640;

type CameraState = 'idle' | 'starting' | 'running' | 'error';

interface EventOption {
  slug: string;
  name: string;
}

export function QrScanner({ events }: { events: EventOption[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const lastDecodeRef = useRef(0);
  const lastPayloadRef = useRef<{ value: string; at: number } | null>(null);
  const inFlightRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const [mode, setMode] = useState<'admit' | 'check'>('admit');
  const [eventSlug, setEventSlug] = useState<string>(events[0]?.slug ?? '');
  const [gate, setGate] = useState('');
  const [muted, setMuted] = useState(false);

  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [flash, setFlash] = useState<'none' | 'ok' | 'warn' | 'bad'>('none');
  const [busy, setBusy] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [tally, setTally] = useState({ scanned: 0, admitted: 0, rejected: 0 });

  // The gate label is set once per shift, so it survives reloads.
  useEffect(() => {
    const saved = window.localStorage.getItem('hov_gate');
    if (saved) setGate(saved);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('hov_gate', gate);
  }, [gate]);

  // ---------------------------------------------------------------------
  // Feedback — the room is loud and dark, so a verdict has to be felt as
  // well as seen.
  // ---------------------------------------------------------------------
  const beep = useCallback(
    (good: boolean) => {
      if (muted) return;
      try {
        audioRef.current ??= new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const ctx = audioRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = good ? 880 : 220;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (good ? 0.14 : 0.32));
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + (good ? 0.15 : 0.34));
      } catch {
        // Audio is a nicety; a blocked AudioContext must not break scanning.
      }
    },
    [muted],
  );

  const buzz = useCallback((good: boolean) => {
    // Safari has no vibrate; the optional-call keeps this a no-op there.
    navigator.vibrate?.(good ? 60 : [80, 60, 80]);
  }, []);

  // ---------------------------------------------------------------------
  // Submit a payload
  // ---------------------------------------------------------------------
  const submit = useCallback(
    async (payload: string) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setBusy(true);

      try {
        const response = await fetch('/api/admin/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload, eventSlug: eventSlug || undefined, gate: gate || undefined, mode }),
        });
        const body = (await response.json()) as { data?: ScanOutcome; error?: string };

        if (!response.ok || !body.data) {
          const failure: ScanOutcome = {
            result: 'not_found',
            ok: false,
            title: 'Scan failed',
            message: body.error ?? 'The server rejected that scan. Try again.',
          };
          setOutcome(failure);
          setFlash('bad');
          beep(false);
          buzz(false);
          setTally((t) => ({ ...t, scanned: t.scanned + 1, rejected: t.rejected + 1 }));
          return;
        }

        const result = body.data;
        setOutcome(result);
        setFlash(result.ok ? 'ok' : result.result === 'duplicate' || result.result === 'wrong_event' ? 'warn' : 'bad');
        beep(result.ok);
        buzz(result.ok);
        setTally((t) => ({
          scanned: t.scanned + 1,
          admitted: t.admitted + (result.ok ? 1 : 0),
          rejected: t.rejected + (result.ok ? 0 : 1),
        }));
      } catch {
        setOutcome({
          result: 'not_found',
          ok: false,
          title: 'Offline',
          message: 'Could not reach the server. Check the connection and scan again.',
        });
        setFlash('bad');
        beep(false);
      } finally {
        inFlightRef.current = false;
        setBusy(false);
        window.setTimeout(() => setFlash('none'), 450);
      }
    },
    [beep, buzz, eventSlug, gate, mode],
  );

  const handleDecoded = useCallback(
    (value: string) => {
      const now = Date.now();
      const last = lastPayloadRef.current;
      if (last && last.value === value && now - last.at < DUPLICATE_WINDOW_MS) return;
      lastPayloadRef.current = { value, at: now };
      void submit(value);
    },
    [submit],
  );

  // ---------------------------------------------------------------------
  // Decode loop
  // ---------------------------------------------------------------------
  const tick = useCallback(() => {
    rafRef.current = requestAnimationFrame(tick);

    const now = Date.now();
    if (now - lastDecodeRef.current < DECODE_INTERVAL_MS) return;
    lastDecodeRef.current = now;

    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return;

    const scale = Math.min(1, MAX_DECODE_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);

    canvasRef.current ??= document.createElement('canvas');
    const canvas = canvasRef.current;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    context.drawImage(video, 0, 0, width, height);

    if (detectorRef.current) {
      void detectorRef.current
        .detect(canvas)
        .then((codes) => {
          if (codes[0]?.rawValue) handleDecoded(codes[0].rawValue);
        })
        .catch(() => {
          // A detector that starts throwing (some Android builds do) falls back
          // to jsQR for the rest of the session rather than failing every frame.
          detectorRef.current = null;
        });
      return;
    }

    const image = context.getImageData(0, 0, width, height);
    // Our QRs are always dark-on-light, so inversion attempts double the work
    // for nothing.
    const found = jsQR(image.data, width, height, { inversionAttempts: 'dontInvert' });
    if (found?.data) handleDecoded(found.data);
  }, [handleDecoded]);

  // ---------------------------------------------------------------------
  // Camera lifecycle
  // ---------------------------------------------------------------------
  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState('idle');
    setTorchOn(false);
    setTorchAvailable(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraState('starting');

    // getUserMedia is unavailable on plain HTTP. This is the failure people hit
    // first when testing on a LAN IP, so it gets an explicit message.
    if (!window.isSecureContext) {
      setCameraState('error');
      setCameraError(
        'The camera needs a secure connection. Open this page over HTTPS (or on localhost) — browsers block camera access on plain http:// addresses.',
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('error');
      setCameraError('This browser does not support camera capture. Try Chrome or Safari.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
      setTorchAvailable(Boolean(capabilities?.torch));

      // Labels are only populated after permission is granted, so enumerate now.
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((device) => device.kind === 'videoinput'));

      const detectorCtor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      if (detectorCtor) {
        try {
          const formats = (await detectorCtor.getSupportedFormats?.()) ?? [];
          if (formats.includes('qr_code')) {
            detectorRef.current = new detectorCtor({ formats: ['qr_code'] });
          }
        } catch {
          detectorRef.current = null;
        }
      }

      setCameraState('running');
      rafRef.current = requestAnimationFrame(tick);
    } catch (error) {
      setCameraState('error');
      const name = error instanceof Error ? error.name : '';
      setCameraError(
        name === 'NotAllowedError'
          ? 'Camera permission was denied. Tap the padlock in the address bar, allow Camera, then reload.'
          : name === 'NotFoundError'
            ? 'No camera found on this device. Use manual entry below.'
            : name === 'NotReadableError'
              ? 'The camera is already in use by another app. Close it and try again.'
              : 'Could not start the camera. Check permissions and try again.',
      );
    }
  }, [deviceId, tick]);

  // Camera left running is the classic scanner-app bug — stop it on unmount.
  useEffect(() => stopCamera, [stopCamera]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      // `torch` is a real constraint on Android Chrome but is not in the DOM
      // typings yet, so it has to be cast in.
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] } as unknown as MediaTrackConstraints);
      setTorchOn((on) => !on);
    } catch {
      setTorchAvailable(false);
    }
  }

  const flashClass =
    flash === 'ok'
      ? 'bg-vybe-500/35'
      : flash === 'warn'
        ? 'bg-amber-400/30'
        : flash === 'bad'
          ? 'bg-red-500/35'
          : 'bg-transparent';

  return (
    <div className="space-y-5">
      {/* Full-bleed verdict flash — visible even when nobody is looking at the panel. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none fixed inset-0 z-50 transition-colors duration-200',
          flashClass,
          flash === 'none' && 'opacity-0',
        )}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-edge bg-black">
            <div className="relative aspect-[4/3] w-full sm:aspect-video">
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                className={cn(
                  'h-full w-full object-cover',
                  cameraState !== 'running' && 'opacity-0',
                )}
              />

              {cameraState === 'running' && (
                <div aria-hidden className="pointer-events-none absolute inset-0">
                  <div className="absolute inset-[12%] rounded-2xl border-2 border-vybe-400/50">
                    <Corner className="left-0 top-0 border-l-2 border-t-2" />
                    <Corner className="right-0 top-0 border-r-2 border-t-2" />
                    <Corner className="bottom-0 left-0 border-b-2 border-l-2" />
                    <Corner className="bottom-0 right-0 border-b-2 border-r-2" />
                    <div className="absolute inset-x-0 top-0 h-full overflow-hidden rounded-2xl">
                      <div className="h-1 w-full animate-breathe bg-gradient-to-r from-transparent via-pulse-400 to-transparent" />
                    </div>
                  </div>
                </div>
              )}

              {cameraState !== 'running' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  {cameraState === 'starting' ? (
                    <p className="text-sm text-slate">Starting camera…</p>
                  ) : cameraState === 'error' ? (
                    <>
                      <p className="max-w-[42ch] text-[13px] leading-relaxed text-red-300">
                        {cameraError}
                      </p>
                      <button type="button" onClick={startCamera} className="btn-outline px-5 py-2.5 text-[13px]">
                        Try again
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="max-w-[36ch] text-sm text-slate">
                        Camera is off. Start it to begin scanning tickets.
                      </p>
                      <button type="button" onClick={startCamera} className="btn-primary px-6 py-3 text-sm">
                        Start camera
                      </button>
                    </>
                  )}
                </div>
              )}

              {busy && (
                <div className="absolute right-3 top-3 rounded-full bg-canvas/80 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-vybe-700">
                  Checking…
                </div>
              )}
            </div>

            {cameraState === 'running' && (
              <div className="flex flex-wrap items-center gap-2 border-t border-edge bg-mist/70 p-3">
                <button type="button" onClick={stopCamera} className="btn-outline btn-sm px-4 py-2 text-[12px]">
                  Stop
                </button>
                {torchAvailable && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    aria-pressed={torchOn}
                    className={cn(
                      'btn px-4 py-2 text-[12px]',
                      torchOn
                        ? 'bg-vybe-500 text-white'
                        : 'border border-edge text-slate hover:text-ink',
                    )}
                  >
                    Torch {torchOn ? 'on' : 'off'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  aria-pressed={muted}
                  className="btn border border-edge px-4 py-2 text-[12px] text-slate hover:text-ink"
                >
                  {muted ? 'Sound off' : 'Sound on'}
                </button>
                {devices.length > 1 && (
                  <select
                    value={deviceId}
                    onChange={(event) => {
                      setDeviceId(event.target.value);
                      stopCamera();
                    }}
                    aria-label="Camera"
                    className="ml-auto rounded-full border border-edge bg-mist px-3 py-2 text-[12px] text-slate"
                  >
                    <option value="">Default camera</option>
                    {devices.map((device, index) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${index + 1}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          <ScanResult outcome={outcome} mode={mode} />
        </div>

        <aside className="space-y-4">
          <div className="panel p-4">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-vybe-600">
              Shift setup
            </p>

            <fieldset className="mb-4">
              <legend className="label">Mode</legend>
              <div className="grid grid-cols-2 gap-2">
                {(['admit', 'check'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMode(option)}
                    aria-pressed={mode === option}
                    className={cn(
                      'rounded-xl border px-3 py-3 text-left transition-colors',
                      mode === option
                        ? 'border-vybe-500 bg-vybe-500/15'
                        : 'border-edge hover:border-vybe-700',
                    )}
                  >
                    <span className="block text-[13px] font-semibold text-ink">
                      {option === 'admit' ? 'Admit' : 'Check'}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                      {option === 'admit' ? 'Uses up the ticket' : 'Preview only'}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mb-4">
              <label htmlFor="scan-event" className="label">
                Event
              </label>
              <select
                id="scan-event"
                value={eventSlug}
                onChange={(event) => setEventSlug(event.target.value)}
                className="field"
              >
                <option value="">Any event</option>
                {events.map((event) => (
                  <option key={event.slug} value={event.slug}>
                    {event.name}
                  </option>
                ))}
              </select>
              <p className="help">Pinning an event rejects passes issued for another night.</p>
            </div>

            <div>
              <label htmlFor="scan-gate" className="label">
                Gate / door
              </label>
              <input
                id="scan-gate"
                value={gate}
                onChange={(event) => setGate(event.target.value)}
                placeholder="Main door"
                maxLength={40}
                className="field"
              />
              <p className="help">Recorded against every scan. Saved on this device.</p>
            </div>
          </div>

          <div className="panel p-4">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-vybe-600">
              This session
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Tally label="Scanned" value={tally.scanned} />
              <Tally label="Admitted" value={tally.admitted} tone="text-vybe-600" />
              <Tally label="Rejected" value={tally.rejected} tone="text-red-300" />
            </div>
          </div>

          <div className="panel p-4">
            <label htmlFor="manual" className="label">
              Manual entry
            </label>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (manualCode.trim()) {
                  void submit(manualCode.trim());
                  setManualCode('');
                }
              }}
              className="flex gap-2"
            >
              <input
                id="manual"
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value.toUpperCase())}
                placeholder="HOV1.HOV-OFFC-…"
                className="field font-mono text-[12px]"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" disabled={!manualCode.trim() || busy} className="btn-outline shrink-0 px-4 py-3 text-[12px]">
                Check
              </button>
            </form>
            <p className="help">
              Paste the full signed value from the guest&apos;s email. A bare ticket code has no
              signature, so the server will reject it — that is deliberate.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Corner({ className }: { className?: string }) {
  return <span className={cn('absolute h-7 w-7 rounded-sm border-pulse-400', className)} />;
}

function Tally({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-edge bg-mist/60 py-3">
      <p className={cn('font-display text-2xl font-bold tabular-nums text-ink', tone)}>{value}</p>
      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}
