"use client";

import { useEffect, useState } from "react";

import styles from "./Spinner.module.css";

type Props = {
  /** Optional countdown shown in the centre — matches old-app behaviour. */
  countdownFrom?: number;
  /** Reset the countdown each time this key changes. */
  runKey?: string | number;
};

export default function Spinner({ countdownFrom = 20, runKey }: Props) {
  const [counter, setCounter] = useState(countdownFrom);

  useEffect(() => {
    setCounter(countdownFrom);
    const id = window.setInterval(() => {
      setCounter((n) => (n <= 1 ? 0 : n - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [countdownFrom, runKey]);

  return (
    <div className={styles.ldsSpinner} role="status" aria-label="Loading">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} />
      ))}
      <span className={styles.counter}>{counter}</span>
    </div>
  );
}
