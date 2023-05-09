export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export enum State {
    CONNECTING,
    NEARLY,
    CONNECTED,
    RECONNECTING,
    DISCONNECTING,
    DISCONNECTED
}

export enum VoiceState {
    SESSION_READY,
    SESSION_ID_MISSING,
    SESSION_ENDPOINT_MISSING,
    SESSION_FAILED_UPDATE
}

export enum OPCodes {
    PLAYER_UPDATE = 'playerUpdate',
    STATS = 'stats',
    EVENT = 'event',
    READY = 'ready'
}