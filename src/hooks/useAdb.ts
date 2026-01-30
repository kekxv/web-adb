'use client';

import { useState, useCallback, useRef } from 'react';
import { Adb } from '@yume-chan/adb';
import { AdbDaemonTransport } from '@yume-chan/adb';
import { AdbWebUsbBackendManager } from '@yume-chan/adb-backend-webusb';
import AdbWebCredentialStore from '@yume-chan/adb-credential-web';

export function useAdb() {
    const [adb, setAdb] = useState<Adb | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [isWaitingForAuth, setIsWaitingForAuth] = useState(false);
    const credentialStore = useRef<AdbWebCredentialStore | null>(null);
    const currentAdb = useRef<Adb | null>(null);

    if (typeof window !== 'undefined' && !credentialStore.current) {
        credentialStore.current = new AdbWebCredentialStore('web-adb-tool');
    }

    const connect = useCallback(async () => {
        try {
            setConnecting(true);
            setIsWaitingForAuth(false);
            
            if (currentAdb.current) {
                await currentAdb.current.close().catch(() => {});
                currentAdb.current = null;
                setAdb(null);
            }

            const manager = AdbWebUsbBackendManager.BROWSER;
            if (!manager) return;

            const backend = await manager.requestDevice();
            if (!backend) return;

            const connection = await backend.connect();
            
            // Show auth prompt
            setIsWaitingForAuth(true);
            
            // Authenticate and get transport
            const transport = await AdbDaemonTransport.authenticate({
                serial: backend.serial,
                connection: connection as any,
                credentialStore: credentialStore.current!,
            });

            setIsWaitingForAuth(false);
            const newAdb = new Adb(transport);
            currentAdb.current = newAdb;
            setAdb(newAdb);
            return newAdb;
        } catch (error) {
            setIsWaitingForAuth(false);
            console.error('ADB Error:', error);
            alert('连接失败: ' + (error instanceof Error ? error.message : String(error)));
        } finally {
            setConnecting(false);
        }
    }, []);

    const disconnect = useCallback(async () => {
        if (currentAdb.current) {
            await currentAdb.current.close().catch(() => {});
            currentAdb.current = null;
            setAdb(null);
        }
    }, []);

    return { adb, connecting, isWaitingForAuth, connect, disconnect };
}