import { EventEmitter } from 'events';
import { Erebus, NodeConfig } from '../Erebus';
import Websocket from 'ws';
import { OPCodes, State } from '../Constants';
import { sleep } from '../Utils';
import { Player } from '../player/Player';
import { Rest } from './Rest';
import { Queue } from './Queue';

export interface VoiceChannelOptions {
    guildId: string;
    shardId: number;
    channelId: string;
    deaf?: boolean;
    mute?: boolean;
}

export interface ResumableHeaders {
    'Authorization': string;
    'User-Id': string;
    'Client-Name': string;
    'Session-Id'?: string;
}

export interface NonResumableHeaders {
    'Authorization': string;
    'User-Id': string;
    'Client-Name': string;
}

export interface NodeStats {
    players: number;
    playingPlayers: number;
    memory: {
        reservable: number;
        used: number;
        free: number;
        allocated: number
    };
    frameStats: {
        sent: number;
        deficit: number;
        nulled: number
    };
    cpu: {
        cores: number;
        systemLoad: number;
        lavalinkLoad: number;
    };
    uptime: number;
}

export class Node extends EventEmitter {
    public readonly manager: Erebus;
    public readonly players: Map<string, Player>;
    public readonly name: string;
    public readonly group?: string;
    public readonly isSecure?: boolean;
    public stats: NodeStats | null;
    public reconnects: number;
    private destroyed: boolean;
    public sessionId: string | null;
    public state: State;

    private readonly url: string;
    private readonly auth: string;
    public ws: Websocket | null;
    public rest: Rest;
    public queue: Queue;
    isV3?: boolean;

    constructor(manager: Erebus, options: NodeConfig) {
        super();

        this.players = new Map();
        this.rest = new Rest(this, options);
        this.queue = new Queue(this);
        this.manager = manager;
        this.name = options.name;
        this.group = options.group;
        this.isSecure = options.isSecure || false;
        this.url = options.url;
        this.auth = options.auth;

        this.ws = null;
        this.stats = null;
        this.state = State.DISCONNECTED;
        this.reconnects = 0;
        this.destroyed = false;
        this.sessionId = null;

        this.isV3 = options.isV3 ?? false;
    }

    get penalties(): number {
        let penalties = 0;
        if (!this.stats) return penalties;

        penalties += this.stats.players;
        penalties += Math.round(Math.pow(1.05, 100 * this.stats.cpu.systemLoad) * 10 - 10);

        if (this.stats.frameStats) {
            penalties += this.stats.frameStats.deficit;
            penalties += this.stats.frameStats.nulled * 2;
        }

        return penalties;
    }

    public async joinChannel(options: VoiceChannelOptions): Promise<Player> {
        if (this.state !== State.CONNECTED) throw new Error('This node is not yet ready');

        let player = this.players.get(options.guildId);
        if (!player) {
            player = new Player(this, options);
            this.players.set(options.guildId, player);
        }

        try {
            await player!.connection.connect(options);
            return player;
        } catch (error) {
            this.players.delete(options.guildId);
            throw error;
        }
    }

    public async leaveChannel(guildId: string): Promise<void> {
        const player = this.players.get(guildId);
        if (!player) return;
        return await player.connection.disconnect();
    }

    public connect() {
        if (!this.manager.id)
            throw new Error('Client not ready');

        this.state = State.CONNECTING;

        let headers: ResumableHeaders | NonResumableHeaders;
        if (this.manager.options.resume) {
            headers = {
                'Authorization': this.auth,
                'User-Id': this.manager!.id,
                'Client-Name': 'Erebus/1.0.0',
                'Session-Id': this.manager.options.sessionId
            };
        } else {
            headers = {
                'Authorization': this.auth,
                'User-Id': this.manager!.id,
                'Client-Name': 'Erebus/1.0.0'
            }
        }

        this.ws = new Websocket(`${this.isSecure ? 'wss' : 'ws'}://${this.url}/${!this.isV3 ? 'v4/websocket' : ''}`, { headers } as any);
        this.ws.on('message', data => this.message(data));
        this.ws.on('error', error => this.error(error));
        this.ws.once('close', (code, reason) => this.close(code, reason));
        this.ws.once('upgrade', () => this.open());
    }

    private destroy() {
        this.ws?.removeAllListeners();
        this.ws?.close();
        this.ws = null;
        this.sessionId = null;
        this.state = State.DISCONNECTED;
        this.destroyed = true;
        this.emit('disconnect');
    }

    private async reconnect(): Promise<void> {
        if (this.state === State.RECONNECTING) return;
        if (this.state !== State.DISCONNECTED) this.destroy();

        this.state = State.RECONNECTING;
        this.reconnects++;

        await sleep((this.manager.options.reconnectInterval || 10000) * 1000);
        this.connect();
    }

    private async message(data: unknown) {
        const json = JSON.parse(data as string);console.log(json);
        if (!json) return;

        switch (json.op) {
            case OPCodes.READY:
                this.sessionId = json.sessionId;
                this.state = State.CONNECTED;

                this.emit('ready', json.resumed);

                if (this.manager.options.resume && this.manager.options.sessionId)
                    await this.rest.updateSession(this.manager.options.resume, this.manager.options.resumeTimeout || 60);
                break;

            case OPCodes.STATS:
                this.stats = json;
                break;

            case OPCodes.EVENT:
            case OPCodes.PLAYER_UPDATE:
                const player = this.players.get(json.guildId);
                if (!player) return;

                if (json.op === OPCodes.EVENT)
                    player.playerEvent(json);
                else
                    player.playerUpdateEvent(json);
                break;

            default:
                break;
        }

        this.emit('raw', json);
    }

    private open(): void {
        if (this.isV3) {
            this.state = State.CONNECTED;
            this.emit('ready');
            return;
        }

        this.reconnects = 0;
        this.state = State.NEARLY;
    }

    private close(code: number, reason: unknown): void {
        this.emit('close', code, reason);

        if (this.destroyed || this.reconnects >= (this.manager.options.reconnectTries || 3))
            this.movePlayers();
        else
            this.reconnect();
    }

    public error(error: Error | unknown): void {
        this.emit('error', error);
    }

    public disconnect(code: number, reason: string) {
        if (this.destroyed) return;

        this.destroyed = true;
        this.state = State.DISCONNECTING;

        if (this.isV3)
            this.queue.clear();

        if (this.ws)
            this.ws.close(code, reason);
        else
            this.movePlayers();
    }

    private async movePlayers(): Promise<void> {
        const move = this.manager.options.moveOnDisconnect && [ ...this.manager.nodes.values() ].length > 1;
        if (!move) return this.destroy();

        const count = this.players.size;
        try {
            const players = [ ...this.players.values() ];
            await Promise.all(players.map(player => player.moveToRecommendedNode()));
        } catch (error) {
            this.error(error);
        } finally {
            this.destroy();
        }
    }

    public raw(packet: any): void {
        const player = this.players.get(packet.d.guild_id);
        if (!player) return;

        if (packet.t === 'VOICE_SERVER_UPDATE')
            return player.connection.setServerUpdate(packet.d);

        if (packet.d.user_id !== this.manager.id)
            return;

        player.connection.setStateUpdate(packet.d);
    }
}