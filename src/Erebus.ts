import { EventEmitter } from 'events';
import { Node } from './node/Node';
import { Connector } from './connector/Connector';
import { State } from './Constants';
import { Player } from './player/Player';

export interface ErebusOptions {
    reconnectTries?: number;
    reconnectInterval?: number;
    restTimeout?: number;
    moveOnDisconnect?: boolean;
    resume?: boolean;
    resumeTimeout?: number;
    sessionId?: string;
}

export interface NodeConfig {
    name: string;
    url: string;
    auth: string;
    group?: string;
    isSecure?: boolean;
    isV3?: boolean;
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

    get players(): Map<string, Player> {
        const players = new Map();
        for (const node of this.nodes.values())
            for (const [ id, player ] of node.players)
                players.set(id, player);
        return players;
    }

    public getNode(name: string|string[] = 'auto'): Node | undefined {
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
        node.on('reconnecting', (...args) => this.emit('reconnecting', node.name, ...args));
        node.on('error', (...args) => this.emit('error', node.name, ...args));
        node.on('close', (...args) => this.emit('close', node.name, ...args));
        node.on('ready', (...args) => this.emit('ready', node.name, ...args));
        node.on('raw', (...args) => this.emit('raw', node.name, ...args));
        node.once('disconnect', (...args) => this.nodeDisconnectEvent(node, ...args));
        node.connect();

        this.nodes.set(node.name, node);
    }

    private nodeDisconnectEvent(node: Node, ...args: any[]) {
        node.removeAllListeners();
        this.nodes.delete(node.name);
        this.emit('disconnect', node.name, ...args);
    }

    private getIdeal(group: string|string[]): Node | undefined {
        const nodes = [ ...this.nodes.values() ]
            .filter(node => node.state === State.CONNECTED);

        if (group === 'auto')
            return nodes.sort((a, b) => a.penalties - b.penalties).shift();

        return nodes.filter(node => node.group && group.includes(node.group))
            .sort((a, b) => a.penalties - b.penalties)
            .shift();
    }
}