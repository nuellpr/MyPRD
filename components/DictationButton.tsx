"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// Tipe minimal Web Speech API (tidak ada di lib.dom TS).
interface SpeechResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechResultEventLike {
  resultIndex: number;
  results: SpeechResultLike[];
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition as SpeechRecognitionCtor) ?? (w.webkitSpeechRecognition as SpeechRecognitionCtor) ?? null;
}

export function DictationButton({ onText }: { onText: (text: string) => void }) {
  const supported = useSyncExternalStore(
    () => () => {},
    () => getSpeechRecognition() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const recognizerRef = useRef<SpeechRecognitionLike | null>(null);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  });

  useEffect(() => {
    return () => {
      try {
        recognizerRef.current?.stop();
      } catch {
        // abaikan — recognizer mungkin belum start
      }
    };
  }, []);

  if (!supported) return null;

  function toggle() {
    if (listening) {
      try {
        recognizerRef.current?.stop();
      } finally {
        setListening(false);
      }
      return;
    }
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "id-ID";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (event) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
      }
      const cleaned = finalText.trim();
      if (cleaned) onTextRef.current(cleaned);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognizerRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? "Berhenti mendengarkan" : "Bicara — isi ide dengan suara (Bahasa Indonesia)"}
      aria-label={listening ? "Berhenti mendengarkan" : "Bicara"}
      aria-pressed={listening}
      className={`relative grid h-9 w-9 place-items-center rounded-full border transition ${
        listening
          ? "border-rose-500/70 bg-rose-500/20 text-rose-300"
          : "border-slate-700/80 bg-slate-900/60 text-slate-300 hover:border-[#35d6ff]/60 hover:text-white"
      }`}
    >
      {listening ? (
        <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-rose-500/30" />
      ) : null}
      {listening ? (
        <svg viewBox="0 0 24 24" className="relative h-4 w-4" fill="currentColor" aria-hidden="true">
          <rect x="7" y="7" width="10" height="10" rx="2" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="relative h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
        </svg>
      )}
    </button>
  );
}
