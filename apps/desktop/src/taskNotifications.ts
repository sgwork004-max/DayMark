import {
  Schedule,
  cancel,
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

function notificationId(key: string): number {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = ((hash << 5) - hash + key.charCodeAt(index)) | 0;
  }
  return (hash & 0x7fffffff) || 1;
}

function reminderDateTime(noteDate: string | undefined, shortDate: string, time: string): Date | null {
  const match = /^(\d{1,2})\/(\d{1,2})$/.exec(shortDate.trim());
  const clock = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match?.[1] || !match[2] || !clock?.[1] || !clock[2]) return null;
  const year = Number.parseInt(noteDate?.slice(0, 4) ?? String(new Date().getFullYear()), 10);
  const month = Number(match[2]);
  const day = Number(match[1]);
  const hour = Number(clock[1]);
  const minute = Number(clock[2]);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    && date.getHours() === hour
    && date.getMinutes() === minute
    ? date
    : null;
}

export async function cancelNativeTaskReminder(noteId: string, lineIndex: number): Promise<void> {
  await cancel([notificationId(`${noteId}:${lineIndex}`)]).catch(() => {});
}

export async function scheduleNativeTaskReminder(args: {
  noteId: string;
  lineIndex: number;
  title: string;
  noteDate?: string;
  reminderDate: string;
  reminderTime: string;
}): Promise<"scheduled" | "removed" | "invalid" | "denied"> {
  const id = notificationId(`${args.noteId}:${args.lineIndex}`);
  await cancel([id]).catch(() => {});

  if (!args.reminderDate.trim() || !args.reminderTime.trim()) return "removed";
  const at = reminderDateTime(args.noteDate, args.reminderDate, args.reminderTime);
  if (!at || at.getTime() <= Date.now()) return "invalid";

  let granted = await isPermissionGranted();
  if (!granted) granted = await requestPermission() === "granted";
  if (!granted) return "denied";

  await sendNotification({
    id,
    title: "Manager reminder",
    body: args.title,
    schedule: Schedule.at(at),
    sound: "Ping",
  });
  return "scheduled";
}
