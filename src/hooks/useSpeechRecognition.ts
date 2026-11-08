import { useCallback, useEffect, useRef, useState } from 'react';

export interface Segment {
  id: number;
  at: number; // seconds since the session started
  text: string;
}

interface Options {
  lang: string;
  onDevice: boolean;
}

/**
 * Live transcription with the browser's SpeechRecognition API.
 * Browsers stop recognition after silence or time limits, so while the user wants it
 * running we restart it automatically.
 */
export function useSpeechRecognition({ lang, onDevice }: Options) {
  const Ctor =
    typeof window !== 'undefined' ? window.SpeechRecognition ?? window.webkitSpeechRecognition : undefined;
  const supported = !!Ctor;

  const [listening, setListening] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognition | null>(null);
  const wantRef = useRef(false);
  const startedAtRef = useRef(0);
  const idRef = useRef(0);
  const optsRef = useRef({ lang, onDevice });
  optsRef.current = { lang, onDevice };

  const create = useCallback((): SpeechRecognition | null => {
    if (!Ctor) return null;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = optsRef.current.lang;
    if (optsRef.current.onDevice) rec.processLocally = true;

    rec.onresult = (e) => {
      let interimText = '';
      const finals: string[] = [];
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          if (transcript.trim()) finals.push(transcript.trim());
        } else {
          interimText += transcript;
        }
      }
      if (finals.length) {
        const at = Math.round((Date.now() - startedAtRef.current) / 1000);
        const added = finals.map((text) => ({ id: ++idRef.current, at, text }));
        setSegments((prev) => [...prev, ...added]);
      }
      setInterim(interimText.trim());
    };

    rec.onerror = (e) => {
      switch (e.error) {
        case 'no-speech':
        case 'aborted':
          return;
        case 'not-allowed':
        case 'service-not-allowed':
          wantRef.current = false;
          setError('Microphone access is blocked. Allow it in your browser’s site settings and try again.');
          return;
        case 'audio-capture':
          wantRef.current = false;
          setError('No microphone was found.');
          return;
        case 'network':
          wantRef.current = false;
          setError(
            'The browser’s speech service could not be reached. Most browsers need an internet connection for speech recognition.'
          );
          return;
        case 'language-not-supported':
          wantRef.current = false;
          setError(
            optsRef.current.onDevice
              ? 'On-device recognition is not available for this language. Turn off on-device mode or install the language pack.'
              : 'Your browser does not support this language.'
          );
          return;
        default:
          setError(`Speech recognition error: ${e.error}`);
      }
    };

    rec.onend = () => {
      setInterim('');
      if (!wantRef.current) {
        setListening(false);
        return;
      }
      window.setTimeout(() => {
        if (!wantRef.current) return;
        try {
          rec.lang = optsRef.current.lang;
          rec.processLocally = optsRef.current.onDevice ? true : undefined;
          rec.start();
        } catch {
          // already started
        }
      }, 300);
    };

    return rec;
  }, [Ctor]);

  const start = useCallback(() => {
    if (!Ctor || wantRef.current) return;
    const rec = create();
    if (!rec) return;
    setError(null);
    if (!startedAtRef.current) startedAtRef.current = Date.now();
    recRef.current = rec;
    wantRef.current = true;
    setListening(true);
    try {
      rec.start();
    } catch {
      wantRef.current = false;
      setListening(false);
      setError('Could not start listening.');
    }
  }, [Ctor, create]);

  const stop = useCallback(() => {
    wantRef.current = false;
    recRef.current?.stop();
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    wantRef.current = false;
    recRef.current?.abort();
    setListening(false);
    setSegments([]);
    setInterim('');
    setError(null);
    startedAtRef.current = 0;
  }, []);

  /** Restores a saved draft so new timestamps continue after it. */
  const loadSegments = useCallback((items: Segment[]) => {
    setSegments(items);
    idRef.current = items.reduce((max, s) => Math.max(max, s.id), 0);
    const last = items.length ? items[items.length - 1].at : 0;
    startedAtRef.current = Date.now() - last * 1000;
  }, []);

  // Changing language (or on-device mode) while listening: stop; onend restarts with the new settings.
  useEffect(() => {
    if (wantRef.current) recRef.current?.stop();
  }, [lang, onDevice]);

  useEffect(
    () => () => {
      wantRef.current = false;
      recRef.current?.abort();
    },
    []
  );

  return { supported, listening, segments, interim, error, start, stop, reset, loadSegments };
}
