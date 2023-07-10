import { EventEmitter } from 'events';
import { Node, VoiceChannelOptions } from '../node/Node';
import { Connection } from './Connection';
import { Track, UpdatePlayerInfo, UpdatePlayerOptions} from '../node/Rest';
import { State } from '../Constants';

export interface PlayOptions {
    encodedTrack: any;
    identifier?: string;
    options?: {
        paused?: boolean;
        position?: number;
        endTime?: number;
        volume?: number;
        filters?: FilterOptions;
    }
}

export interface PlayerUpdateData {
    guildId: string;
    state: {
        time: number;
        position: number;
        connected: boolean;
        ping: number;
    }
}

export interface FilterOptions {
    volume?: number;
    equalizer?: Band[];
    karaoke?: KaraokeSettings|null;
    timescale?: TimescaleSettings|null;
    tremolo?: FreqSettings|null;
    vibrato?: FreqSettings|null;
    rotation?: RotationSettings|null;
    distortion?: DistortionSettings|null;
    channelMix?: ChannelMixSettings|null;
    lowPass?: LowPassSettings|null;
}

export interface Band {
    band: number;
    gain: number;
}

export interface KaraokeSettings {
    level?: number;
    monoLevel?: number;
    filterBand?: number;
    filterWidth?: number;
}

export interface TimescaleSettings {
    speed?: number;
    pitch?: number;
    rate?: number;
}

export interface FreqSettings {
    frequency?: number;
    depth?: number;
}

export interface RotationSettings {
    rotationHz?: number;
}

export interface ResumeOptions {
    noReplace?: boolean;
    paused?: boolean;
    position?: number;
    endTime?: number;
    volume?: number;
    filters?: FilterOptions;
}

export interface DistortionSettings {
    sinOffset?: number;
    sinScale?: number;
    cosOffset?: number;
    cosScale?: number;
    tanOffset?: number;
    tanScale?: number;
    offset?: number;
    scale?: number;
}

export interface ChannelMixSettings {
    leftToLeft?: number;
    leftToRight?: number;
    rightToLeft?: number;
    rightToRight?: number;
}

export interface LowPassSettings {
    smoothing?: number
}

export class Player extends EventEmitter {
    public node: Node;
    public track: Track | null;
    public paused: boolean;
    public position: number;
    public volume: number;
    public ping: number;
    public filters: FilterOptions;
    public readonly connection: Connection;

    constructor(node: Node, options: VoiceChannelOptions) {
        super();

        this.node = node;
        this.track = null;
        this.paused = false;
        this.position = 0;
        this.volume = 100;
        this.ping = 0;
        this.filters = {};

        this.connection = new Connection(this, options);
    }

    public async playTrack(playable: PlayOptions): Promise<void> {
        const playerOptions: UpdatePlayerOptions = { encodedTrack: playable.encodedTrack, ...playable.options };

        if (this.node.isV3)
            this.node.queue.add({
                op: 'play',
                guildId: this.connection.guildId,
                track: playable.encodedTrack,
                ...playable.options
            });
        else
            await this.node.rest.updatePlayer({
                guildId: this.connection.guildId,
                playerOptions
            });

        if (playerOptions.paused)
            this.paused = playerOptions.paused;
        if (playerOptions.position)
            this.position = playerOptions.position;
        if (playerOptions.volume)
            this.volume = playerOptions.volume;
    }

    public async stopTrack(): Promise<void> {
        if (this.node.isV3)
            this.node.queue.add({ op: 'stop', guildId: this.connection.guildId });
        else
            await this.node.rest.updatePlayer({ guildId: this.connection.guildId, playerOptions: { encodedTrack: null }});
        this.position = 0;
    }

    public async setPaused(paused = true): Promise<void> {
        if (this.node.isV3)
            this.node.queue.add({ op: 'pause', guildId: this.connection.guildId, pause: paused });
        else
            await this.node.rest.updatePlayer({ guildId: this.connection.guildId, playerOptions: { paused }});
        this.paused = paused;
    }

    public async seekTo(position: number): Promise<void> {
        if (this.node.isV3)
            this.node.queue.add({ op: 'seek', guildId: this.connection.guildId, position });
        else
            await this.node.rest.updatePlayer({ guildId: this.connection.guildId, playerOptions: { position }});
        this.position = position;
    }

    public async setVolume(volume: number): Promise<void> {
        if (this.node.isV3)
            this.node.queue.add({ op: 'volume', guildId: this.connection.guildId, volume });
        else
            await this.node.rest.updatePlayer({ guildId: this.connection.guildId, playerOptions: { volume }});
        this.volume = volume;
    }

    public async setEqualizer(equalizer: Band[]): Promise<void> {
        this.filters.equalizer = equalizer;

        if (this.node.isV3)
            this.node.queue.add({ op: 'filters', guildId: this.connection.guildId, ...this.filters });
        else
            await this.node.rest.updatePlayer({ guildId: this.connection.guildId, playerOptions: { filters: { equalizer }}});
    }

    public async setKaraoke(karaoke?: KaraokeSettings): Promise<void> {
        this.filters.karaoke = karaoke || null;

        if (this.node.isV3)
            this.node.queue.add({ op: 'filters', guildId: this.connection.guildId, ...this.filters });
        else
            await this.node.rest.updatePlayer({ guildId: this.connection.guildId, playerOptions: { filters: { karaoke }}});
    }

    public async setTimescale(timescale?: TimescaleSettings): Promise<void> {
        this.filters.timescale = timescale || null;

        if (this.node.isV3)
            this.node.queue.add({ op: 'filters', guildId: this.connection.guildId, ...this.filters });
        else
            await this.node.rest.updatePlayer({ guildId: this.connection.guildId, playerOptions: { filters: { timescale }}});
    }

    public async setTremolo(tremolo?: FreqSettings): Promise<void> {
        this.filters.tremolo = tremolo || null;

        if (this.node.isV3)
            this.node.queue.add({ op: 'filters', guildId: this.connection.guildId, ...this.filters });
        else
            await this.node.rest.updatePlayer({ guildId: this.connection.guildId, playerOptions: { filters: { tremolo }}});
    }

    public async setVibrato(vibrato?: FreqSettings): Promise<void> {
        this.filters.vibrato = vibrato || null;

        if (this.node.isV3)
            this.node.queue.add({ op: 'filters', guildId: this.connection.guildId, ...this.filters });
        else
            await this.node.rest.updatePlayer({ guildId: this.connection.guildId, playerOptions: { filters: { vibrato }}});
    }

    public async setRotation(rotation?: RotationSettings): Promise<void> {
        this.filters.rotation = rotation || null;

        if (this.node.isV3)
            this.node.queue.add({ op: 'filters', guildId: this.connection.guildId, ...this.filters });
        else
            await this.node.rest.updatePlayer({ guildId: this.connection.guildId, playerOptions: { filters: { rotation }}});
    }

    public async setDistortion(distortion: DistortionSettings): Promise<void> {
        this.filters.distortion = distortion || null;

        if (this.node.isV3)
            this.node.queue.add({ op: 'filters', guildId: this.connection.guildId, ...this.filters });
        else
            await this.node.rest.updatePlayer({ guildId: this.connection.guildId, playerOptions: { filters: { distortion }}});
    }

    public async setChannelMix(channelMix: ChannelMixSettings): Promise<void> {
        this.filters.channelMix = channelMix || null;

        if (this.node.isV3)
            this.node.queue.add({ op: 'filters', guildId: this.connection.guildId, ...this.filters });
        else
            await this.node.rest.updatePlayer({ guildId: this.connection.guildId, playerOptions: { filters: { channelMix }}});
    }

    public async setLowPass(lowPass: LowPassSettings): Promise<void> {
        this.filters.lowPass = lowPass || null;

        if (this.node.isV3)
            this.node.queue.add({ op: 'filters', guildId: this.connection.guildId, ...this.filters });
        else
            await this.node.rest.updatePlayer({ guildId: this.connection.guildId, playerOptions: { filters: { lowPass }}});
    }

    public async setFilters(filters: FilterOptions): Promise<void> {
        this.filters = filters;

        if (this.node.isV3)
            this.node.queue.add({ op: 'filters', guildId: this.connection.guildId, ...this.filters });
        else
            await this.node.rest.updatePlayer({ guildId: this.connection.guildId, playerOptions: { filters }});
    }

    public clearFilters(): Promise<void> {
        return this.setFilters({ volume: 1, equalizer: [], karaoke: null, timescale: null, tremolo: null, vibrato: null, rotation: null, distortion: null, channelMix: null, lowPass: null });
    }

    public get playerData(): UpdatePlayerInfo {
        return {
            guildId: this.connection.guildId,
            playerOptions: {
                encodedTrack: this.track?.encoded,
                position: this.position,
                paused: this.paused,
                filters: this.filters,
                voice: this.connection.serverUpdateInfo,
                volume: this.volume ?? 100
            }
        };
    }

    public async moveToRecommendedNode(): Promise<void> {
        let name: string|string[] = 'auto';
        if (this.node.group) name = [ this.node.group ];
        const node = this.node.manager.getNode(name);
        if (!node) return await this.connection.disconnect();

        if (!node || node.name === this.node.name) return;
        if (node.state !== State.CONNECTED) throw new Error('The node you specified is not ready');

        try {
            await this.connection.destroy();
            this.node.players.delete(this.connection.guildId);
            this.node = node;
            this.node.players.set(this.connection.guildId, this);
            await this.resume();
        } catch (error) {
            await this.connection.disconnect(false);
            await this.connection.destroy();
            throw error;
        }
    }

    public async resume(options: ResumeOptions = {}): Promise<void> {
        if (!this.track) return;

        if (this.node.isV3) {
            await this.setFilters(options.filters || {});

            if (this.track) {

                await this.playTrack({
                    encodedTrack: this.track,
                    options: {
                        position: this.playerData.playerOptions.position,
                        paused: this.playerData.playerOptions.paused
                    }
                });
            }

            this.emit('resume', this);
            return;
        }

        const data = this.playerData;
        if (options.noReplace) data.noReplace = options.noReplace;
        if (options.position) data.playerOptions.position = options.position;
        if (options.endTime) data.playerOptions.endTime = options.endTime;
        if (options.volume) data.playerOptions.volume = options.volume;
        if (options.paused) data.playerOptions.paused = options.paused;
        if (options.filters) data.playerOptions.filters = options.filters;
        await this.update(data);
        this.emit('resume', this);
    }

    public async update(updatePlayer: UpdatePlayerInfo): Promise<void> {
        const data = { ...updatePlayer, ...{ guildId: this.connection.guildId, sessionId: this.node.sessionId! }};
        await this.node.rest.updatePlayer(data);
        if (updatePlayer.playerOptions) {
            const options = updatePlayer.playerOptions;
            if (options.position) this.position = options.position;
            if (options.paused) this.paused = options.paused;
            if (options.volume) this.volume = options.volume;
            if (options.filters) this.filters = options.filters;
        }
    }

    public playerUpdateEvent(data: PlayerUpdateData) {
        this.emit('update', data);

        this.position = data.state.position;
        this.ping = data.state.ping;
    }

    public playerEvent(data: any) {
        switch (data.type) {
            case 'TrackStartEvent':
                this.track = data.track;
                this.emit('start', data);
                break;

            case 'TrackEndEvent':
                this.emit('end', data);
                break;

            case 'TrackStuckEvent':
                this.emit('stuck', data);
                break;

            case 'TrackExceptionEvent':
                this.emit('exception', data);
                break;

            case 'WebSocketClosedEvent':
                if (!this.connection.reconnecting) {
                    if (!this.connection.moved)
                        this.emit('closed', data);
                    else
                        this.connection.moved = false;
                }

                break;
        }
    }
}