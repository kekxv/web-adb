# Web ADB Project Notes

## Technical Insights: @yume-chan/adb (Tango v2)

In this project, we successfully implemented a pure web-based ADB client. Here are the key findings regarding the `@yume-chan` libraries as of early 2026:

### Connection Workflow
1. **Backend**: Use `AdbWebUsbBackendManager.BROWSER.requestDevice()` to get a `AdbWebUsbBackend`.
2. **Connection**: Call `backend.connect()` to get a connection object.
3. **Authentication**: Use `AdbDaemonTransport.authenticate` with the connection and a `AdbWebCredentialStore`. This handles the RSA challenge/response.
4. **Initialization**: Wrap the transport in `new Adb(transport)`.

### Phone Mirror (Scrcpy)
- **Library**: `@yume-chan/scrcpy` and `@yume-chan/adb-scrcpy`.
- **Server Version**: Use `v3.3.4` (or latest). Server JAR must match the version string passed to the client exactly.
- **Local Hosting**: Always host `scrcpy-server.jar` in the `public` folder to avoid CORS issues when fetching from GitHub.
- **Decoding**: `WebCodecsVideoDecoder` with `WebGLVideoFrameRenderer` provides the best performance.
- **Touch Interaction**:
  - Requires `AndroidMotionEventAction` for actions (Down, Move, Up).
  - Coordinates must be mapped to the actual video stream dimensions (e.g., `decoder.width` x `decoder.height`).
  - **Important**: The decoder's width/height are only available after the first few frames are processed. Use the `sizeChanged` event to track these.
  - Field names for `injectTouch`: `pointerX`, `pointerY`, `videoWidth`, `videoHeight`.

### File Management (Sync)
- **Service**: Use `const sync = await adb.sync()`.
- **Operations**:
  - `sync.readdir(path)`: Returns entries. Directory check: `(entry.mode & 0x4000) !== 0`.
  - `sync.read(path)`: Returns a `ReadableStream<Uint8Array>`.
  - `sync.write({ filename, file: ReadableStream })`: For uploading files.
- **Cleanup**: Always call `await sync.dispose()` when finished.

### React Integration
- Use `useRef` to track the `Adb` instance across renders to avoid closure traps and "initialization before access" errors.
- Handle React's double-mounting in development by checking a "mounted" flag inside `useEffect`.
