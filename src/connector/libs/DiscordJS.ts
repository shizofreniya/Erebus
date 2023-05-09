import { Connector } from '../Connector';
import { NodeConfig } from '../../Erebus';

export class DiscordJS extends Connector {
    public sendPacket(shardId: number, payload: any, important: boolean): void {
        return this.client.ws.shards.get(shardId)?.send(payload, important);
    }

    public get id(): string {
        return this.client.user.id;
    }

    public setListeners(nodes: NodeConfig[]): void {
        this.client.once('ready', () => this.ready(nodes));
        this.client.on('raw', (packet: any) => this.raw(packet));
    }
}