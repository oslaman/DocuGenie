import { RuleNode } from "@/utils/rete-network";

/**
 * Interface for the message event from the worker.
 * @interface
 */
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

/**
 * Interface for the rules object.
 * @interface
 */
export interface Rules {
    id: string;
    parent: string | null;
    rule: RuleNode;
}