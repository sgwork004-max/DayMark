import React, { useMemo, useState } from "react";
import {
  AlignLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  Clock3,
  Link2,
  MapPin,
  Paperclip,
  X,
} from "lucide-react";

export interface CalendarChoice {
  id: string;
  title: string;
  source: string;
  writable: boolean;
}

export interface EventDraft {
  title: string;
  start: string;
  end: string;
  calendarId: string;
  location: string;
  description: string;
  attachmentUrl: string;
  alarmMinutes: number | null;
}

interface Props {
  initialStart: string;
  initialEnd: string;
  calendars: CalendarChoice[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (draft: EventDraft) => Promise<void>;
}

const DURATION_OPTIONS = [
  { label: "30 min", minutes: 30 },
  { label: "45 min", minutes: 45 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
];

function addMinutes(localDateTime: string, minutes: number): string {
  const date = new Date(localDateTime);
  date.setMinutes(date.getMinutes() + minutes);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatSelectedDate(localDateTime: string): string {
  const [datePart] = localDateTime.split("T");
  if (!datePart) return "";
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(new Date(year, month - 1, day));
}

export function EventComposer({
  initialStart, initialEnd, calendars, saving, error, onClose, onSave,
}: Props) {
  const writable = useMemo(() => calendars.filter((calendar) => calendar.writable), [calendars]);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [calendarId, setCalendarId] = useState(writable[0]?.id ?? "");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [alarmMinutes, setAlarmMinutes] = useState<number | null>(10);
  const [showDetails, setShowDetails] = useState(false);

  const canSave = Boolean(title.trim() && start && end && calendarId && end > start && !saving);
  const selectedDuration = DURATION_OPTIONS.find((option) => addMinutes(start, option.minutes) === end)?.minutes;

  return (
    <div className="event-composer-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="event-composer event-composer-simple" role="dialog" aria-modal="true" aria-label="Create event">
        <header className="event-composer-header">
          <div className="event-composer-heading">
            <span className="event-composer-mark"><CalendarDays size={17} /></span>
            <div>
              <h2>New event</h2>
              <span className="event-composer-date">{formatSelectedDate(start)}</span>
            </div>
          </div>
          <button className="event-composer-close" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </header>

        <div className="event-composer-body">
          <input
            className="event-title-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What is happening?"
            autoFocus
          />

          <section className="event-time-card" aria-label="Event date and time">
            <div className="event-time-card-title"><Clock3 size={15} /> Date and time</div>
            <div className="event-time-fields">
              <label>
                <span>Starts</span>
                <input type="datetime-local" value={start} onChange={(event) => {
                  const nextStart = event.target.value;
                  setStart(nextStart);
                  if (nextStart >= end) setEnd(addMinutes(nextStart, 60));
                }} />
              </label>
              <span className="event-time-arrow"><ArrowRight size={13} /></span>
              <label>
                <span>Ends</span>
                <input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} />
              </label>
            </div>
            <div className="event-duration-options" aria-label="Quick duration">
              {DURATION_OPTIONS.map((option) => (
                <button
                  key={option.minutes}
                  className={selectedDuration === option.minutes ? "active" : ""}
                  onClick={() => setEnd(addMinutes(start, option.minutes))}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <ComposerRow icon={<CalendarDays size={17} />} label="Calendar">
            <select value={calendarId} onChange={(event) => setCalendarId(event.target.value)}>
              {writable.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.source === calendar.title ? calendar.source : `${calendar.source} · ${calendar.title}`}
                </option>
              ))}
            </select>
          </ComposerRow>

          <ComposerRow icon={<MapPin size={17} />} label="Location">
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Add a place or address" />
          </ComposerRow>

          <ComposerRow icon={<Bell size={17} />} label="Reminder">
            <select
              value={alarmMinutes ?? -1}
              onChange={(event) => setAlarmMinutes(Number(event.target.value) < 0 ? null : Number(event.target.value))}
            >
              <option value={-1}>No reminder</option>
              <option value={0}>At event time</option>
              <option value={5}>5 minutes before</option>
              <option value={10}>10 minutes before</option>
              <option value={15}>15 minutes before</option>
              <option value={30}>30 minutes before</option>
              <option value={60}>1 hour before</option>
              <option value={1440}>1 day before</option>
            </select>
          </ComposerRow>

          <ComposerRow icon={<AlignLeft size={17} />} label="Notes" alignTop>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add context or preparation notes"
              rows={3}
            />
          </ComposerRow>

          <button className="event-more-toggle" type="button" onClick={() => setShowDetails((value) => !value)}>
            <Paperclip size={14} />
            {showDetails ? "Hide attachment" : "Add attachment link"}
          </button>

          {showDetails && (
            <ComposerRow icon={<Link2 size={17} />} label="Attachment">
              <input
                type="url"
                value={attachmentUrl}
                onChange={(event) => setAttachmentUrl(event.target.value)}
                placeholder="Paste a document link"
              />
            </ComposerRow>
          )}

          {error && <div className="event-composer-error">{error}</div>}
          {start && end && end <= start && <div className="event-composer-error">End time must be after start time.</div>}
        </div>

        <footer className="event-composer-footer">
          <span><CalendarDays size={13} /> Saves directly to Apple Calendar</span>
          <div>
            <button className="event-secondary" onClick={onClose}>Cancel</button>
            <button
              className="event-primary"
              disabled={!canSave}
              onClick={() => void onSave({
                title: title.trim(),
                start,
                end,
                calendarId,
                location: location.trim(),
                description: description.trim(),
                attachmentUrl: attachmentUrl.trim(),
                alarmMinutes,
              })}
            >
              {saving ? "Creating..." : "Create event"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function ComposerRow({
  icon, label, children, alignTop = false,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  alignTop?: boolean;
}) {
  return (
    <div className={`event-composer-row ${alignTop ? "align-top" : ""}`}>
      <span className="event-composer-row-icon">{icon}</span>
      <label>{label}</label>
      <div className="event-composer-control">{children}</div>
    </div>
  );
}
