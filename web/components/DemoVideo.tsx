"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { DEMO_VIDEO } from "@/constants/landing";
import styles from "./DemoVideo.module.css";

export default function DemoVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const { src, poster, duration } = DEMO_VIDEO;

  function play() {
    videoRef.current?.play();
  }

  return (
    <div className={styles.frame}>
      {src ? (
        <video
          ref={videoRef}
          className={styles.video}
          src={src}
          poster={poster ?? undefined}
          controls={started}
          playsInline
          preload="metadata"
          onPlay={() => setStarted(true)}
        />
      ) : null}

      {!started && (
        <div className={styles.overlay}>
          <span className={styles.dots} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <button
            type="button"
            className={styles.play}
            onClick={src ? play : undefined}
            aria-disabled={!src}
            aria-label={src ? "Play demo video" : "Demo video coming soon"}
            title={src ? "Play demo video" : "Demo video coming soon"}
          >
            <Play size={18} fill="currentColor" strokeWidth={0} />
          </button>
          <span className={styles.label}>[1-minute demo video]</span>
          <span className={styles.duration}>{duration}</span>
        </div>
      )}
    </div>
  );
}
