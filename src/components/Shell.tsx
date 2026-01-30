'use client';

import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Adb, AdbFeature } from '@yume-chan/adb';

interface ShellProps {
    adb: Adb;
}

export default function Shell({ adb }: ShellProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const activeRef = useRef(true);

    useEffect(() => {
        if (!terminalRef.current) return;

        activeRef.current = true;
        const term = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#1e1e1e',
                foreground: '#ffffff',
            },
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: 14,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let shell: any = null;
        let writer: WritableStreamDefaultWriter | null = null;

        const startShell = async () => {
            try {
                if (!activeRef.current) return;

                // Priority: ShellV2 PTY -> Legacy Shell
                if (adb.canUseFeature(AdbFeature.ShellV2) && adb.subprocess.shellProtocol) {
                    shell = await adb.subprocess.shellProtocol.pty();
                } else {
                    shell = await adb.subprocess.noneProtocol.spawn('shell');
                }
                
                if (!activeRef.current) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (shell as any).kill?.();
                    return;
                }

                // Handle property name differences (spawn: stdin/stdout, pty: input/output)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const stdin = (shell as any).input || (shell as any).stdin;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const stdout = (shell as any).output || (shell as any).stdout;

                if (!stdin || !stdout) {
                    throw new Error('Could not find input/output streams on shell object');
                }

                writer = stdin.getWriter();
                const encoder = new TextEncoder();
                
                const { dispose: dataDispose } = term.onData((data) => {
                    if (activeRef.current && writer) {
                        writer.write(encoder.encode(data)).catch(() => {});
                    }
                });

                const { dispose: resizeDispose } = term.onResize(({ cols, rows }) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    if (activeRef.current && (shell as any).resize) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (shell as any).resize(rows, cols);
                    }
                });

                term.writeln('Connected to ADB shell...');

                const reader = stdout.getReader();
                const decoder = new TextDecoder();
                try {
                    while (activeRef.current) {
                        const { done, value } = await reader.read();
                        if (done) {
                            break;
                        }
                        if (value && activeRef.current) {
                            term.write(decoder.decode(value));
                        }
                    }
                } catch (readError: unknown) {
                    if (activeRef.current) {
                        const msg = readError instanceof Error ? readError.message : String(readError);
                        term.writeln('\r\n[Read Error]: ' + msg);
                    }
                } finally {
                    reader.releaseLock();
                    dataDispose();
                    resizeDispose();
                }
            } catch (err: unknown) {
                if (activeRef.current) {
                    const msg = err instanceof Error ? err.message : String(err);
                    term.writeln('\r\nError starting shell: ' + msg);
                }
            }
        };

        startShell();

        const handleResize = () => {
            if (activeRef.current) fitAddon.fit();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            activeRef.current = false;
            window.removeEventListener('resize', handleResize);
            if (writer) {
                try { writer.releaseLock(); } catch { /* ignore */ }
            }
            if (shell) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                try { ((shell as any).kill || (shell as any).close)?.(); } catch { /* ignore */ }
            }
            term.dispose();
        };
    }, [adb]);

    return (
        <div className="w-full h-full bg-[#1e1e1e] rounded-lg overflow-hidden border border-gray-700 shadow-xl min-h-0">
            <div ref={terminalRef} className="w-full h-full p-2" />
        </div>
    );
}