"use client";

import { useEffect, useRef, useState } from "react";

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
  const [supported] = useState(() => getSpeechRecognition() !== null);
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
      title={listening ? "Berhenti mendengarkan" : "Isi ide dengan suara (Bahasa Indonesia)"}
      aria-pressed={listening}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${
        listening
          ? "animate-pulse border-red-500/60 bg-red-500/15 text-red-300"
          : "border-slate-700 text-slate-300 hover:border-slate-500"
      }`}
    >
      <span aria-hidden>{listening ? "⏹" : "🎙"}</span>
      {listening ? "Mendengarkan... (klik untuk berhenti)" : "Dictation"}
    </button>
  );
}
