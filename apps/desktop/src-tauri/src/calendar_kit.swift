// EventKit helper — compiled into the Tauri binary by build.rs.
// Runs in-process so it inherits the app's TCC Calendar permission.
import EventKit
import Foundation
import Security

private let gStore = EKEventStore()
private var gGranted = false
private var gInitDone = false
private var gRequestFinished = false
private let gInitLock = NSLock()

@_cdecl("ek_authorization_status")
public func ekAuthorizationStatus() -> Int32 {
    let status = EKEventStore.authorizationStatus(for: .event)
    if #available(macOS 14.0, *) {
        switch status {
        case .notDetermined: return 0
        case .denied: return 1
        case .restricted: return 2
        case .writeOnly: return 3
        case .fullAccess: return 4
        @unknown default: return -1
        }
    }
    switch status {
    case .notDetermined: return 0
    case .denied: return 1
    case .restricted: return 2
    case .authorized: return 4
    default: return -1
    }
}

// Called once. Dispatches access request to main queue so the system dialog
// can appear (EventKit dialogs must be shown from a thread with a run loop).
@_cdecl("ek_init")
public func ekInit() {
    gInitLock.lock()
    if gInitDone { gInitLock.unlock(); return }
    gInitDone = true
    gInitLock.unlock()

    let status = EKEventStore.authorizationStatus(for: .event)
    if #available(macOS 14.0, *) {
        if status == .fullAccess {
            gGranted = true
            gRequestFinished = true
            return
        }
        if status == .writeOnly || status == .denied || status == .restricted {
            gGranted = false
            gRequestFinished = true
            return
        }
    } else {
        if status == .authorized {
            gGranted = true
            gRequestFinished = true
            return
        }
        if status == .denied || status == .restricted {
            gGranted = false
            gRequestFinished = true
            return
        }
    }

    let sema = DispatchSemaphore(value: 0)
    let request: (@escaping (Bool, Error?) -> Void) -> Void
    if #available(macOS 14.0, *) {
        request = { cb in gStore.requestFullAccessToEvents(completion: cb) }
    } else {
        request = { cb in gStore.requestAccess(to: .event, completion: cb) }
    }

    // Run on the main queue so the permission dialog can be presented.
    // Do not block the Rust command while macOS waits for the user's response.
    DispatchQueue.main.async {
        request { granted, _ in
            gGranted = granted
            gRequestFinished = true
            sema.signal()
        }
    }

    // Wait briefly so the first calendar load after enabling does not look empty.
    // The React side still has a timeout, so the app UI remains responsive.
    _ = sema.wait(timeout: .now() + 8)
}

// Returns a malloc'd JSON string. Caller must free with ek_free().
@_cdecl("ek_events_json")
public func ekEventsJson(fromTs: Int64, toTs: Int64) -> UnsafeMutablePointer<CChar>? {
    guard gGranted else { return strdup("[]") }

    let startDate = Date(timeIntervalSince1970: Double(fromTs))
    let endDate   = Date(timeIntervalSince1970: Double(toTs))

    let predicate = gStore.predicateForEvents(withStart: startDate, end: endDate, calendars: nil)
    let events    = gStore.events(matching: predicate)

    var results: [[String: Any]] = []
    let fmt = ISO8601DateFormatter()
    fmt.formatOptions = [.withInternetDateTime, .withDashSeparatorInDate,
                         .withColonSeparatorInTime, .withTimeZone]

    for (i, ev) in events.enumerated() {
        var item: [String: Any] = [:]
        item["id"]       = "ek-\(i)-\(ev.eventIdentifier ?? UUID().uuidString)"
        item["title"]    = ev.title ?? "(No title)"
        item["startISO"] = fmt.string(from: ev.startDate)
        item["endISO"]   = fmt.string(from: ev.endDate ?? ev.startDate)
        item["calendar"] = ev.calendar?.title ?? "Unknown"
        item["isAllDay"] = ev.isAllDay
        if let notes = ev.notes, !notes.isEmpty { item["notes"] = notes }
        results.append(item)
    }

    guard let data = try? JSONSerialization.data(withJSONObject: results),
          let str  = String(data: data, encoding: .utf8) else {
        return strdup("[]")
    }
    return strdup(str)
}

@_cdecl("ek_calendars_json")
public func ekCalendarsJson() -> UnsafeMutablePointer<CChar>? {
    guard gGranted else { return strdup("[]") }

    let calendars = gStore.calendars(for: .event).map { cal in
        [
            "id": cal.calendarIdentifier,
            "title": cal.title,
            "source": cal.source?.title ?? "On My Mac",
            "writable": cal.allowsContentModifications
        ]
    }

    guard let data = try? JSONSerialization.data(withJSONObject: calendars),
          let str = String(data: data, encoding: .utf8) else {
        return strdup("[]")
    }
    return strdup(str)
}

@_cdecl("ek_create_event")
public func ekCreateEvent(
    _ titlePtr: UnsafePointer<CChar>?,
    _ startPtr: UnsafePointer<CChar>?,
    _ endPtr: UnsafePointer<CChar>?,
    _ calendarIdPtr: UnsafePointer<CChar>?,
    _ notesPtr: UnsafePointer<CChar>?,
    _ locationPtr: UnsafePointer<CChar>?,
    _ urlPtr: UnsafePointer<CChar>?,
    _ alarmMinutes: Int32
) -> UnsafeMutablePointer<CChar>? {
    guard gGranted else { return strdup("Calendar permission is not granted.") }
    guard let titlePtr, let startPtr, let endPtr else {
        return strdup("Missing calendar event fields.")
    }

    let title = String(cString: titlePtr)
    let startRaw = String(cString: startPtr)
    let endRaw = String(cString: endPtr)
    let calendarId = calendarIdPtr.map { String(cString: $0) } ?? ""
    let notes = notesPtr.map { String(cString: $0) } ?? ""
    let location = locationPtr.map { String(cString: $0) } ?? ""
    let url = urlPtr.map { String(cString: $0) } ?? ""

    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone.current
    formatter.dateFormat = "yyyy-MM-dd'T'HH:mm"

    guard let startDate = formatter.date(from: startRaw),
          let endDate = formatter.date(from: endRaw) else {
        return strdup("Could not parse event date.")
    }

    let event = EKEvent(eventStore: gStore)
    event.title = title
    event.startDate = startDate
    event.endDate = endDate
    if !notes.isEmpty { event.notes = notes }
    if !location.isEmpty { event.location = location }
    if !url.isEmpty { event.url = URL(string: url) }
    if alarmMinutes >= 0 {
        event.addAlarm(EKAlarm(relativeOffset: TimeInterval(-alarmMinutes * 60)))
    }

    let calendars = gStore.calendars(for: .event)
    if let matched = calendars.first(where: { $0.calendarIdentifier == calendarId && $0.allowsContentModifications }) {
        event.calendar = matched
    } else if let writable = calendars.first(where: { $0.allowsContentModifications }) {
        event.calendar = writable
    } else if let fallback = gStore.defaultCalendarForNewEvents {
        event.calendar = fallback
    } else {
        return strdup("No writable calendar found.")
    }

    do {
        try gStore.save(event, span: .thisEvent, commit: true)
        return strdup("")
    } catch {
        return strdup(error.localizedDescription)
    }
}

@_cdecl("ek_free")
public func ekFree(_ ptr: UnsafeMutablePointer<CChar>?) {
    free(ptr)
}

// MARK: - Keychain

private let keychainService = "co.daymark.desktop"

@_cdecl("keychain_set")
public func keychainSet(
    _ accountPtr: UnsafePointer<CChar>?,
    _ valuePtr: UnsafePointer<CChar>?
) -> Int32 {
    guard let accountPtr, let valuePtr else { return Int32(errSecParam) }
    let account = String(cString: accountPtr)
    let value = Data(String(cString: valuePtr).utf8)
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: keychainService,
        kSecAttrAccount as String: account,
    ]
    let attributes: [String: Any] = [kSecValueData as String: value]
    let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
    if updateStatus == errSecSuccess { return Int32(updateStatus) }
    if updateStatus != errSecItemNotFound { return Int32(updateStatus) }

    var item = query
    item[kSecValueData as String] = value
    return Int32(SecItemAdd(item as CFDictionary, nil))
}

@_cdecl("keychain_get")
public func keychainGet(_ accountPtr: UnsafePointer<CChar>?) -> UnsafeMutablePointer<CChar>? {
    guard let accountPtr else { return nil }
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: keychainService,
        kSecAttrAccount as String: String(cString: accountPtr),
        kSecReturnData as String: true,
        kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var result: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
          let data = result as? Data,
          let value = String(data: data, encoding: .utf8) else {
        return nil
    }
    return strdup(value)
}

@_cdecl("keychain_delete")
public func keychainDelete(_ accountPtr: UnsafePointer<CChar>?) -> Int32 {
    guard let accountPtr else { return Int32(errSecParam) }
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: keychainService,
        kSecAttrAccount as String: String(cString: accountPtr),
    ]
    let status = SecItemDelete(query as CFDictionary)
    return Int32(status == errSecItemNotFound ? errSecSuccess : status)
}
