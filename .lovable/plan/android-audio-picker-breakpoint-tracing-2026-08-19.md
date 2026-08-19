# Android audio picker breakpoint tracing

## Goal
Make every pre-upload and post-upload stage observable on the actual APK, then remove the Android-specific picker filter/event gap without changing other features.

## Changes
- Persist `[AUDIO DEBUG]` stage events in browser storage and show the latest trace beside the audio uploader, so logs survive leaving and returning from Android Storage.
- Instrument picker-open, page blur/visibility/focus/return, `input`, `change`, File metadata, detection, validation, upload start/result, state propagation, render, and autosave result.
- Expand the native audio input `accept` value beyond `audio/*` to include supported extensions and generic Android provider MIME, and handle both native `input` and `change` events with duplicate protection.
- Keep Cloudinary, autosave, and all unrelated behavior unchanged.

## Verification
- Exercise the web flow with an Android-like generic-MIME file and verify the complete stage sequence.
- Check the latest preview build result. The actual device breakpoint will be visible in the new trace after the user tests the rebuilt APK.
