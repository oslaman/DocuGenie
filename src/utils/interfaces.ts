import { RuleNode } from "@/utils/rete-network";

export interface WorkerMessageEvent extends MessageEvent {
    data: {
        query: any;
        status: string;
        embedding?: any;
        output?: string;
        pages?: number;
    };
}

export interface Rules {
    id: string;
    parent: string | null;
    rule: RuleNode;
}