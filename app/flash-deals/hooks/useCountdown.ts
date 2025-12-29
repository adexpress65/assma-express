// app/flash-deals/hooks/useCountdown.ts

import { useEffect, useState } from "react";

export default function useCountdown() {
  const [time, setTime] = useState(36000); // 10h

  useEffect(() => {
    const interval = setInterval(() => {
      setTime((t) => (t > 0 ? t - 1 : 36000)); // reset to 10h when finished
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    hours: String(Math.floor(time / 3600)).padStart(2, "0"),
    minutes: String(Math.floor((time % 3600) / 60)).padStart(2, "0"),
    seconds: String(time % 60).padStart(2, "0"),
  };
}