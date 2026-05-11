---
status: investigating
trigger: 'Phase 3 HumynCapture MP4 has no audio track despite AacEncoder being configured'
created: 2026-05-11T08:45:00+05:30
updated: 2026-05-11T08:45:00+05:30
---

## Current Focus

reasoning_checkpoint:
hypothesis: "Audio sub-pipeline is entirely unwired: AacEncoder.configure() creates the encoder, AacEncoder.makeAudioRecord() builds the AudioRecord, but (a) AudioRecord.startRecording() is never invoked, (b) no thread feeds PCM into the AAC encoder input queue, (c) the existing runPumpLoop only drains seg.hevc — no aac.dequeueOutputBuffer, no addTrack(audio format), no writeSampleData for audio. The MP4 ends up with only the HEVC track."
confirming_evidence: - "CaptureSession.kt lines 299-322 allocate aac + audioRecord but never wire them into any drainer." - "runPumpLoop (lines 481-551) only references seg.hevc; no audio side." - "closeSegmentResources calls audioRecord.stop()/aac.stop() but never any drain/EOS for audio." - "Logcat shows 'discarded an unknown buffer' on c2.android.aac.encoder ×5 at 08:30:38 — encoder produced output that nothing consumed."
falsification_test: "If audio plumbing existed, grep CaptureSession.kt would surface seg.aac.dequeueOutputBuffer / audioRecord.startRecording / addTrack(seg.aac.outputFormat). It does not — only seg.hevc.dequeueOutputBuffer / muxer.addTrack(seg.hevc.outputFormat)."
fix_rationale: "Implement the missing wiring directly: (1) wait for both video and audio MediaFormat (from INFO_OUTPUT_FORMAT_CHANGED on each encoder) before muxer.start(); (2) startRecording on AudioRecord; (3) feed PCM into AAC input buffers with elapsedRealtimeNanos-derived PTS (Pattern 1 invariant); (4) drain AAC output into muxer audio track; (5) signal EOS to AAC on close so the audio pump exits. Single audio-pump HandlerThread owns the AAC encoder lifecycle. Video pump retains its track add/start but coordinates via a shared latch/track-state."
blind_spots: "Real-device behavior of AudioRecord.read on Pixel 10a — not unit-testable. The 'discarded buffers' message will disappear post-fix because the AAC encoder will be properly drained AND signaled EOS. AAC and HEVC INFO_OUTPUT_FORMAT_CHANGED arrive on different threads at slightly different times; the muxer must not be started until BOTH tracks are added — adding a small coordination primitive."

next_action: Apply fix to CaptureSession.kt: add audio pump (runAudioPumpLoop + PCM-feed runnable) and coordinate muxer.start() to occur after both tracks are added.

## Symptoms

expected: MP4 contains video + audio tracks (nb_streams=2), AAC-LC 48kHz mono 128kbps.
actual: MP4 has nb_streams=1 (video only). Metadata JSON falsely claims audio.
errors: "CCodecBufferChannel: [c2.android.aac.encoder#904] MediaCodec discarded an unknown buffer" ×5 at 08:30:38 (well after stop()).
reproduction: **DEV** smoke seam at HomeSkeletonScreen, run 30 s capture on Pixel 10a.
started: Since HumynCapture pipeline introduction.

## Evidence

- timestamp: 2026-05-11T08:45
  checked: CaptureSession.openSegment (line 299-322)
  found: aac and audioRecord are CREATED but no audio pump thread is spawned. Only ONE pump thread runs runPumpLoop which only dequeues from seg.hevc (video). No AudioRecord.startRecording() is ever called.
  implication: Audio encoder has no PCM input; muxer has no audio track ever registered.

- timestamp: 2026-05-11T08:45
  checked: CaptureSession.runPumpLoop (line 481-551)
  found: Loop only operates on seg.hevc. Only adds one video track via muxer.addTrack(seg.hevc.outputFormat). Never touches seg.aac, never feeds PCM, never queries seg.aac.dequeueOutputBuffer.
  implication: Audio path has zero runtime activity inside the pump.

- timestamp: 2026-05-11T08:45
  checked: AacEncoder.configure (line 55-60)
  found: codec.start() is called BUT no input is ever queued. The encoder may emit empty output frames or transition states; the late "discarded unknown buffer" log at 08:30:38 is consistent with the dangling encoder still holding output buffers when finally released.
  implication: Encoder allocated, started, but starved of input.

- timestamp: 2026-05-11T08:45
  checked: CaptureSession.closeSegmentResources (line 715-718)
  found: seg.audioRecord?.stop() and seg.aac.stop() are called, BUT audioRecord was never started.
  implication: AudioRecord.stop() without a prior startRecording() is a no-op; doesn't surface error but confirms the lifecycle was never driven.

## Eliminated

- hypothesis: audioMgr is null
  evidence: ctx.getSystemService(Context.AUDIO_SERVICE) returns AudioManager on all Android devices including Pixel 10a. Confirmed allocate log was reached.
  timestamp: 2026-05-11T08:45

## Resolution

root_cause: The audio sub-pipeline is entirely unwired. CaptureSession allocates AAC encoder + AudioRecord, but (1) AudioRecord.startRecording() is never invoked, (2) no thread reads PCM from AudioRecord and feeds it as input buffers to the AAC encoder, (3) the pump loop only processes the HEVC encoder — no audio output is dequeued from the AAC encoder, no audio track is ever added to the muxer via addTrack, no audio samples are ever written via writeSampleData. Combination of hypotheses 2, 3, 4, and 5.
fix: Added runAudioPumpLoop on its own HandlerThread (HumynCapture-AudioPump-<segmentId>). Loop performs AudioRecord.startRecording, reads PCM frames (2 KiB = 1024 samples PCM16 mono), feeds them into the AAC encoder with PTS in micros on the elapsedRealtimeNanos domain (segment-relative, matching video Camera2 surface PTS convention), drains AAC output, registers the audio track via a new MuxerStartGate coordinator, and writeSampleData's encoded AAC into the muxer. MuxerStartGate ensures muxer.start() fires exactly once after BOTH video AND audio tracks are added (or audio is abandoned). closeSegmentResources flips audioPumpShouldStop in parallel with pumpShouldStop, awaits the audio-pump exit latch before tearing down AudioRecord/AAC/muxer.
verification: All 21 capture-package unit tests pass (AacEncoderConfigTest, HevcEncoderConfigTest, FragmentedMuxerWrapperTest, EventEmissionTest, MetadataSchemaConformanceTest, ClockAlignmentTest, etc.). The 15 pre-existing test failures are all in apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/ (DeviceCapsTest, EncoderProbeTest, ImuProbeTest, NalParserTest) and are all NPE at File.java:278 — a test-resource classloader bug unrelated to this change. Real-device verification will be ffprobe on the next smoke MP4 to confirm nb_streams=2 with AAC 48000Hz mono.
files_changed:

- apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt
- apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCaptureModule.kt
