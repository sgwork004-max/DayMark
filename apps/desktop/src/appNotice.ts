export type AppNoticeTone = "error" | "info";

export interface AppNoticeDetail {
  message: string;
  tone: AppNoticeTone;
}

export function showAppNotice(message: string, tone: AppNoticeTone = "error"): void {
  window.dispatchEvent(new CustomEvent<AppNoticeDetail>("manager:notice", {
    detail: { message, tone },
  }));
}
