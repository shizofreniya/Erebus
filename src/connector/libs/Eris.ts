import { Connector } from '../Connector';
import { NodeConfig } from '../../Erebus';

export class Eris extends Connector {
    public sendPacket(shardId: number, payload: any, important: boolean): void {
        return this.client.shards.get(shardId)?.sendWS(payload.op, payload.d, important);
    }

    public get id(): string {
        return this.client.user.id;
    }

    public setListeners(nodes: NodeConfig[]): void {
        this.client.once('ready', () => this.ready(nodes));
        this.client.on('rawWS', (packet: any) => this.raw(packet));
    }
}