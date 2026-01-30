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

        let shell: any = null;
        let writer: WritableStreamDefaultWriter | null = null;

        const startShell = async () => {
            console.log('Shell: Starting initialization...');
            try {
                if (!activeRef.current) return;

                // Priority: ShellV2 PTY -> Legacy Shell
                if (adb.canUseFeature(AdbFeature.ShellV2) && adb.subprocess.shellProtocol) {
                    console.log('Shell: Using ShellV2 PTY');
                    shell = await adb.subprocess.shellProtocol.pty();
                } else {
                    console.log('Shell: Falling back to Legacy Shell');
                    shell = await adb.subprocess.noneProtocol.spawn('shell');
                }
                
                if (!activeRef.current) {
                    shell.kill?.();
                    return;
                }

                console.log('Shell: Subprocess spawned successfully');

                // Set initial size if supported
                if (shell.resize) {
                    shell.resize(term.rows, term.cols);
                }

                // Handle property name differences (spawn: stdin/stdout, pty: input/output)
                const stdin = shell.input || shell.stdin;
                const stdout = shell.output || shell.stdout;

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
                    if (activeRef.current && shell.resize) {
                        shell.resize(rows, cols);
                    }
                });

                term.writeln('Connected to ADB shell...');

                const reader = stdout.getReader();
                const decoder = new TextDecoder();
                try {
                    while (activeRef.current) {
                        const { done, value } = await reader.read();
                        if (done) {
                            console.log('Shell: Stream done');
                            break;
                        }
                        if (value && activeRef.current) {
                            term.write(decoder.decode(value));
                        }
                    }
                } catch (readError: any) {
                    if (activeRef.current) {
                        console.error('Shell: Read error:', readError);
                        term.writeln('\r\n[Read Error]: ' + readError.message);
                    }
                } finally {
                    reader.releaseLock();
                    dataDispose();
                    resizeDispose();
                }
            } catch (err: any) {
                if (activeRef.current) {
                    console.error('Shell: Critical error:', err);
                    term.writeln('\r\nError starting shell: ' + err.message);
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
                try { writer.releaseLock(); } catch(e) {}
            }
            if (shell) {
                // pty uses kill(), spawn uses close() or similar
                try { (shell.kill || shell.close)?.(); } catch (e) {}
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
