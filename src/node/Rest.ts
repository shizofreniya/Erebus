import { Node, NodeStats } from './Node';
import { NodeConfig } from '../Erebus';
import { FilterOptions } from '../player/Player';

export type LoadType = 'track' | 'playlist' | 'search' | 'empty' | 'error';

interface FetchOptions {
    headers?: Record<string, string>;
    params?: Record<string, string>;
    method?: string;
    body?: Record<string, unknown> | unknown[];
    [key: string]: unknown;
}

interface RequestOptions {
    method: string;
    headers: Record<string, string>;
    signal: AbortSignal;
    body?: string;
}

export interface Track {
    encoded: string;
    info: {
        identifier: string;
        isSeekable: boolean;
        author: string;
        length: number;
        isStream: boolean;
        position: number;
        title: string;
        uri?: string;
        artworkUrl?: string;
        isrc?: string;
        sourceName: string;
    },

    pluginInfo: unknown;
}

export interface LavalinkResponse {
    loadType: LoadType;
    data: unknown
}

export interface Address {
    address: string;
    failingTimestamp: number;
    failingTime: string;
}

export interface RoutePlanner {
    class: null | 'RotatingIpRoutePlanner' | 'NanoIpRoutePlanner' | 'RotatingNanoIpRoutePlanner' | 'BalancingIpRoutePlanner';
    details: null | {
        ipBlock: {
            type: string;
            size: string;
        };
        failingAddresses: Address[];
        rotateIndex: string;
        ipIndex: string;
        currentAddress: string;
        blockIndex: string;
        currentAddressIndex: string;
    };
}

export interface LavalinkPlayerVoice {
    token: string;
    endpoint: string;
    sessionId: string;
    connected?: boolean;
    ping?: number
}

export interface LavalinkPlayerVoiceOptions extends Omit<LavalinkPlayerVoice, 'connected'|'ping'> {}

export interface LavalinkPlayer {
    guildId: string,
    track?: Track,
    volume: number;
    paused: boolean;
    voice: LavalinkPlayerVoice
}

export interface UpdatePlayerOptions {
    encodedTrack?: string|null;
    identifier?: string;
    position?: number;
    endTime?: number;
    volume?: number;
    paused?: boolean;
    filters?: FilterOptions;
    voice?: LavalinkPlayerVoiceOptions;
}

export interface UpdatePlayerInfo {
    guildId: string;
    playerOptions: UpdatePlayerOptions;
    noReplace?: boolean;
}

export interface SessionInfo {
    resumingKey?: string;
    timeout: number;
}

export class Rest {
    protected readonly node: Node;
    protected readonly url: string;
    protected readonly auth: string;
    protected readonly version: string;

    constructor(node: Node, options: NodeConfig) {
        this.node = node;
        this.url = `${options.isSecure ? 'https': 'http'}://${options.url}${!options.isV3 ? '/v4' : ''}`;
        this.version = `/v4`;
        this.auth = options.auth;
    }

    protected get sessionId(): string {
        return this.node.sessionId!;
    }

    public resolve(identifier: string): Promise<LavalinkResponse | undefined> {
        return this.fetch('/loadtracks', { params: { identifier } });
    }

    public decodeTrack(encodedTrack: string): Promise<Track | undefined> {
        return this.fetch<Track>('/decodetrack', { params: { encodedTrack } });
    }

    public decodeTracks(encodedTracks: string[]): Promise<Track[] | undefined> {
        return this.fetch<Track[]>('/decodetracks', { body: encodedTracks });
    }

    public async getPlayers(): Promise<LavalinkPlayer[]> {
        return await this.fetch<LavalinkPlayer[]>(`/sessions/${this.sessionId}/players`) ?? [];
    }

    public getPlayer(guildId: string): Promise<LavalinkPlayer | undefined> {
        return this.fetch(`/sessions/${this.sessionId}/players/${guildId}`);
    }

    public updatePlayer(data: UpdatePlayerInfo): Promise<LavalinkPlayer | undefined> {
        return this.fetch<LavalinkPlayer>(`/sessions/${this.sessionId}/players/${data.guildId}`, {
            method: 'PATCH',
            params: { noReplace: data.noReplace?.toString() || 'false' },
            body: data.playerOptions as Record<string, unknown>
        });
    }

    public async destroyPlayer(guildId: string): Promise<void> {
        await this.fetch(`/sessions/${this.sessionId}/players/${guildId}`, { method: 'DELETE' });
    }

    public updateSession(resuming: boolean, timeout: number): Promise<SessionInfo | undefined> {
        return this.fetch(`/sessions/${this.sessionId}`, { method: 'PATCH', body: { resuming, timeout }});
    }

    public stats(): Promise<NodeStats | undefined> {
        return this.fetch('/stats');
    }

    public getRoutePlannerStatus(): Promise<RoutePlanner | undefined> {
        return this.fetch('/routeplanner/status');
    }

    public async unmarkFailedAddress(address: string): Promise<void> {
        await this.fetch('/routeplanner/free/address', { method: 'POST', body: { address } });
    }

    public async unmarkAllFailedAddress(): Promise<void> {
        await this.fetch('/routeplanner/free/all', { method: 'POST' });
    }

    protected async fetch<T = unknown>(endpoint: string, options: FetchOptions = {}) {
        const url = new URL(`${this.url}${endpoint}`);
        if (options.params) url.search = new URLSearchParams(options.params).toString();

        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), (this.node.manager.options.restTimeout || 15000) * 1000);

        const requestOptions: RequestOptions = {
            method: options.method?.toUpperCase() || 'GET',
            headers: {
                'Authorization': this.auth,
                'User-Agent': 'Erebus/1.0.0',
                'Content-Type': 'application/json'
            },

            signal: abortController.signal
        }

        if (options.body && !['GET', 'HEAD'].includes(requestOptions.method))
            requestOptions.body = JSON.stringify(options.body || []);

        const request = await fetch(url.toString(), requestOptions).finally(() => clearTimeout(timeout));

        if (!request.ok) {
            const response = await request.json().catch(() => {});

            if (!response?.message)
                throw new Error(`Rest request failed with response code: ${request.status}`);
            else
                throw new Error(`Rest request failed with response code: ${request.status} | message: ${response.message}`);
        }
        try {
            return await request.json() as T;
        } catch {
            return;
        }
    }
}