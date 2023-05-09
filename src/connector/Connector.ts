import { Erebus, NodeConfig } from '../Erebus';

export const AllowedPackets = [ 'VOICE_STATE_UPDATE', 'VOICE_SERVER_UPDATE' ];

export abstract class Connector {
    protected readonly client: any;
    protected manager: Erebus | null;

    constructor(client: any) {
        this.client = client;
        this.manager = null;
    }

    public set(manager: Erebus): Connector {
        this.manager = manager;
        return this;
    }

    protected ready(nodes: NodeConfig[]): void {
        this.manager!.id = this.id;
        for (const node of nodes)
            this.manager!.addNode(node);
    }

    protected raw(packet: any): void {
        if (!AllowedPackets.includes(packet.t)) return;
        for (const node of this.manager!.nodes.values())
            node.raw(packet);
    }

    abstract get id(): string;

    abstract sendPacket(shardId: number, payload: any, important: boolean): void;

    abstract setListeners(nodes: NodeConfig[]): void;
}