import { RuleNode } from "@/utils/rete-network";

export interface WorkerMessageEvent extends MessageEvent {
    data: {
        query: any;
        status: string;
        embedding?: any;
        output?: string;
        page?: number;
        isFinal?: boolean;
        prompt?: string;
    };
}

export interface Rules {
    id: string;
    parent: string | null;
    rule: RuleNode;
}