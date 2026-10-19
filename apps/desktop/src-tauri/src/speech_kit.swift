import AVFoundation
import Foundation
import Speech

private let gSpeechLock = NSLock()
private var gAudioEngine: AVAudioEngine?
private var gRecognitionRequest: SFSpeechAudioBufferRecognitionRequest?
private var gRecognitionTask: SFSpeechRecognitionTask?
private var gTranscript = ""
private var gSpeechError = ""
private var gRecording = false

private func requestSpeechPermissions() -> String? {
    var speechStatus = SFSpeechRecognizer.authorizationStatus()
    if speechStatus == .notDetermined {
        let semaphore = DispatchSemaphore(value: 0)
        DispatchQueue.main.async {
            SFSpeechRecognizer.requestAuthorization { status in
                speechStatus = status
                semaphore.signal()
            }
        }
        if semaphore.wait(timeout: .now() + 60) == .timedOut {
            return "Speech recognition permission timed out."
        }
    }

    guard speechStatus == .authorized else {
        return "Speech recognition is not allowed. Enable Manager in System Settings > Privacy & Security > Speech Recognition."
    }

    var microphoneGranted = AVCaptureDevice.authorizationStatus(for: .audio) == .authorized
    if AVCaptureDevice.authorizationStatus(for: .audio) == .notDetermined {
        let semaphore = DispatchSemaphore(value: 0)
        DispatchQueue.main.async {
            AVCaptureDevice.requestAccess(for: .audio) { granted in
                microphoneGranted = granted
                semaphore.signal()
            }
        }
        if semaphore.wait(timeout: .now() + 60) == .timedOut {
            return "Microphone permission timed out."
        }
    }

    guard microphoneGranted else {
        return "Microphone access is not allowed. Enable Manager in System Settings > Privacy & Security > Microphone."
    }
    return nil
}

private func stopAudio() {
    gAudioEngine?.stop()
    gAudioEngine?.inputNode.removeTap(onBus: 0)
    gRecognitionRequest?.endAudio()
    gAudioEngine = nil
    gRecognitionRequest = nil
}

@_cdecl("speech_start")
public func speechStart() -> UnsafeMutablePointer<CChar>? {
    if let permissionError = requestSpeechPermissions() {
        return strdup(permissionError)
    }

    gRecognitionTask?.cancel()
    stopAudio()

    guard let recognizer = SFSpeechRecognizer(locale: Locale.current), recognizer.isAvailable else {
        return strdup("Speech recognition is currently unavailable.")
    }

    let engine = AVAudioEngine()
    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = true
    request.taskHint = .dictation

    let inputNode = engine.inputNode
    let format = inputNode.outputFormat(forBus: 0)
    guard format.sampleRate > 0 else {
        return strdup("Manager could not access a valid microphone input.")
    }

    gSpeechLock.lock()
    gTranscript = ""
    gSpeechError = ""
    gRecording = true
    gSpeechLock.unlock()

    inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
        request.append(buffer)
    }

    gRecognitionTask = recognizer.recognitionTask(with: request) { result, error in
        gSpeechLock.lock()
        if let result {
            gTranscript = result.bestTranscription.formattedString
            if result.isFinal { gRecording = false }
        }
        if let error {
            let nsError = error as NSError
            if nsError.code != 216 && nsError.code != 301 {
                gSpeechError = error.localizedDescription
            }
            gRecording = false
        }
        gSpeechLock.unlock()
    }

    do {
        engine.prepare()
        try engine.start()
        gAudioEngine = engine
        gRecognitionRequest = request
        return strdup("")
    } catch {
        gRecognitionTask?.cancel()
        stopAudio()
        gSpeechLock.lock()
        gRecording = false
        gSpeechLock.unlock()
        return strdup(error.localizedDescription)
    }
}

@_cdecl("speech_status_json")
public func speechStatusJson() -> UnsafeMutablePointer<CChar>? {
    gSpeechLock.lock()
    let snapshot: [String: Any] = [
        "recording": gRecording,
        "transcript": gTranscript,
        "error": gSpeechError,
    ]
    gSpeechLock.unlock()

    guard let data = try? JSONSerialization.data(withJSONObject: snapshot),
          let json = String(data: data, encoding: .utf8) else {
        return strdup("{\"recording\":false,\"transcript\":\"\",\"error\":\"Could not read dictation state.\"}")
    }
    return strdup(json)
}

@_cdecl("speech_stop")
public func speechStop() -> UnsafeMutablePointer<CChar>? {
    stopAudio()
    Thread.sleep(forTimeInterval: 0.35)
    gRecognitionTask?.finish()
    gRecognitionTask = nil

    gSpeechLock.lock()
    gRecording = false
    let transcript = gTranscript
    gSpeechLock.unlock()
    return strdup(transcript)
}

@_cdecl("speech_free")
public func speechFree(_ ptr: UnsafeMutablePointer<CChar>?) {
    free(ptr)
}
