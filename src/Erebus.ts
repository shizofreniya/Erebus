import { EventEmitter } from 'events';
import { Node } from './node/Node';
import { Connector } from './connector/Connector';
import { State } from './Utils';

export interface ErebusOptions {
    reconnectTries?: number;
    reconnectInterval?: number;
    restTimeout?: number;
    resume?: boolean;
    sessionId?: string;
    moveOnDisconnect?: boolean;
}

export interface NodeConfig {
    name: string;
    url: string;
    auth: string;
    group?: string;
    isSecure?: boolean;
}

export class Erebus extends EventEmitter {
    public id: string | null;
    public readonly nodes: Map<string, Node>;
    public readonly connector: Connector;

    public readonly options: ErebusOptions;

    constructor(connector: Connector, nodes: NodeConfig[], options: ErebusOptions = {}) {
        super();

        this.id = null;
        this.options = options;
        this.nodes = new Map();
        this.connector = connector.set(this);
        this.connector.setListeners(nodes);
    }

    public getNode(name: string|string[] = 'auto'): Node|undefined {
        if (!this.nodes.size) throw new Error('No nodes available, please add a node first');
        if (Array.isArray(name) || name === 'auto') return this.getIdeal(name);
        const node = this.nodes.get(name);
        if (!node) throw new Error('The node name you specified is not one of my nodes');
        if (node.state !== State.CONNECTED) throw new Error('This node is not yet ready');
        return node;
    }

    public removeNode(name: string, reason = 'Remove node executed'): void {
        const node = this.nodes.get(name);
        if (!node) throw new Error('The node name you specified doesn\'t exist');
        node.disconnect(1000, reason);
    }

    public addNode(options: NodeConfig): void {
        const node = new Node(this, options);
        this.nodes.set(node.name, node);

        node.connect();
    }

    private getIdeal(group: string|string[]): Node | undefined {
        const nodes = [ ...this.nodes.values() ]
            .filter(node => node.state === State.CONNECTED);
        if (group === 'auto') {
            return nodes
                .sort((a, b) => a.penalties - b.penalties)
                .shift();
        }
        return nodes
            .sort((a, b) => a.penalties - b.penalties)
            .shift();
    }
}