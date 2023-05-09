import { EventEmitter, once } from 'events';
import { State, VoiceState } from '../Constants';
import { VoiceChannelOptions } from '../node/Node';
import { Player } from './Player';
import { LavalinkPlayerVoiceOptions } from '../node/Rest';

export interface StateUpdatePartial {
    channel_id?: string;
    session_id?: string;
    self_deaf: boolean;
    self_mute: boolean;
}

export interface ServerUpdate {
    token: string;
    guild_id: string;
    endpoint: string;
}

export class Connection extends EventEmitter {
    public readonly player: Player;
    public guildId: string;
    public channelId: string | null;
    public shardId: number;
    public sessionId: string | null;
    public region: string | null;
    public muted: boolean;
    public deafened: boolean;
    public state: State;
    public moved: boolean;
    public reconnecting: boolean;
    private serverUpdate: ServerUpdate | null;

    constructor(player: Player, options: VoiceChannelOptions) {
        super();
        this.player = player;
        this.guildId = options.guildId;
        this.channelId = null;
        this.shardId = options.shardId;
        this.sessionId = null;
        this.region = null;
        this.muted = false;
        this.deafened = false;
        this.state = State.DISCONNECTED;
        this.moved = false;
        this.reconnecting = false;
        this.serverUpdate = null;
    }

    public get serverUpdateInfo(): LavalinkPlayerVoiceOptions {
        if (!this.hasRequiredVoiceData) throw new Error('No server update / session id present');
        return {
            token: this.serverUpdate!.token,
            endpoint: this.serverUpdate!.endpoint,
            sessionId: this.sessionId!
        };
    }

    public get hasRequiredVoiceData(): boolean {
        return !!this.serverUpdate;
    }

    public setDeaf(deaf = false): void {
        this.deafened = deaf;
        this.send({ guild_id: this.guildId, channel_id: this.channelId, self_deaf: this.deafened, self_mute: this.muted });
    }

    public setMute(mute = false): void {
        this.muted = mute;
        this.send({ guild_id: this.guildId, channel_id: this.channelId, self_deaf: this.deafened, self_mute: this.muted });
    }

    public async disconnect(destroyRemotePlayer: boolean = true): Promise<void> {
        if (this.state !== State.DISCONNECTED) {
            this.state = State.DISCONNECTING;
            this.send({ guild_id: this.guildId, channel_id: null, self_mute: false, self_deaf: false });
        }

        this.player.node.players.delete(this.guildId);
        this.player.removeAllListeners();
        this.player.track = null;
        this.player.position = 0;
        this.player.filters = {};
        this.state = State.DISCONNECTED;

        if (destroyRemotePlayer)
            await this.destroy();
    }

    public async connect(options: VoiceChannelOptions): Promise<void> {
        this.state = State.CONNECTING;
        this.send({ guild_id: options.guildId, channel_id: options.channelId, self_deaf: options.deaf ?? true, self_mute: options.mute ?? false });

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        try {
            const [ status, error ] = await once(this, 'connectionUpdate', { signal: controller.signal });
            if (status !== VoiceState.SESSION_READY) {
                switch(status) {
                    case VoiceState.SESSION_ID_MISSING:
                        throw new Error('The voice connection is not established due to missing session id');
                    case VoiceState.SESSION_ENDPOINT_MISSING:
                        throw new Error('The voice connection is not established due to missing connection endpoint');
                    case VoiceState.SESSION_FAILED_UPDATE:
                        throw error;
                }
            }
            this.state = State.CONNECTED;
        } catch (error: any) {
            if (error.name === 'AbortError')
                throw new Error('The voice connection is not established in 15 seconds');
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }

    public async destroy(): Promise<void> {
        await this.player.node.rest.destroyPlayer(this.guildId);
    }

    public setStateUpdate(options: StateUpdatePartial): void {
        if (this.channelId && (options.channel_id && this.channelId !== options.channel_id)) {
            this.moved = true;
        }

        this.channelId = options.channel_id || this.channelId;
        if (!options.channel_id) {
            this.state = State.DISCONNECTED;
        }

        this.deafened = options.self_deaf;
        this.muted = options.self_mute;
        this.sessionId = options.session_id || null;
    }

    public setServerUpdate(data: ServerUpdate): void {
        if (!data.endpoint) {
            this.emit('connectionUpdate', VoiceState.SESSION_ENDPOINT_MISSING);
            return;
        }

        if (!this.sessionId) {
            this.emit('connectionUpdate', VoiceState.SESSION_ID_MISSING);
            return;
        }

        if (this.region && !data.endpoint.startsWith(this.region))
            this.moved = true;

        this.region = data.endpoint.split('.').shift()?.replace(/[0-9]/g, '') || null;
        this.serverUpdate = data;

        const playerUpdate = {
            guildId: this.guildId,
            playerOptions: {
                voice: {
                    token: this.serverUpdate!.token,
                    endpoint: this.serverUpdate!.endpoint,
                    sessionId: this.sessionId!
                }
            }
        };

        this.player.node.rest.updatePlayer(playerUpdate)
            .then(() => this.emit('connectionUpdate', VoiceState.SESSION_READY))
            .catch(error => this.listenerCount('connectionUpdate') > 0 ? this.emit('connectionUpdate', VoiceState.SESSION_FAILED_UPDATE, error) : this.player.node.error(error));
    }

    private send(data: any): void {
        this.player.node.manager.connector.sendPacket(this.shardId, { op: 4, d: data }, false);
    }
}