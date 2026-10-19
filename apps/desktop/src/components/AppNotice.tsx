import { useEffect, useState } from "react";
import { AlertCircle, Info, X } from "lucide-react";
import type { AppNoticeDetail } from "../appNotice.js";

export function AppNotice() {
  const [notice, setNotice] = useState<AppNoticeDetail | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function show(event: Event) {
      const detail = (event as CustomEvent<AppNoticeDetail>).detail;
      if (!detail?.message) return;
      setNotice(detail);
      clearTimeout(timer);
      timer = setTimeout(() => setNotice(null), detail.tone === "error" ? 7_000 : 4_000);
    }
    window.addEventListener("manager:notice", show);
    return () => {
      window.removeEventListener("manager:notice", show);
      clearTimeout(timer);
    };
  }, []);

  if (!notice) return null;
  return (
    <div className={`app-notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
      {notice.tone === "error" ? <AlertCircle size={15} /> : <Info size={15} />}
      <span>{notice.message}</span>
      <button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={13} /></button>
    </div>
  );
}
