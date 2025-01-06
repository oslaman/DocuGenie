import { LogicEngine } from 'json-logic-engine'

/**
 * Represents a node in a rule tree structure.
 * @class RuleNode
 * @property {string} name - The name of the rule.
 * @property {any} conditions - The conditions that must be satisfied for the rule.
 * @property {string} prompt - The prompt to execute if the rule is satisfied.
 * @property {number} page - The page to return if the rule is satisfied.
 * @property {number} salience - The priority of the rule (default is 0).
 * @property {number} timestamp - The timestamp of the rule.
 * @property {string | null} parentId - The ID of the parent rule node.
 * @property {LogicEngine} logicEngine - The logic engine instance.
 */
export class RuleNode {
    name: string;
    conditions: any;
    prompt: string = 'Based on the context, answer the following question.';
    page: number = 0;
    children: RuleNode[];
    salience: number;
    timestamp: number;
    parentId: string | null = null;
    logicEngine: LogicEngine;

    /**
     * Constructs a RuleNode instance.
     * @param {string} name - The name of the rule.
     * @param {any} conditions - The conditions that must be satisfied for the rule.
     * @param {string} prompt - The prompt to execute if the rule is satisfied.
     * @param {number} page - The page to return if the rule is satisfied.
     * @param {number} salience - The priority of the rule (default is 0).
     */
    constructor(
        name: string,
        conditions: any,
        prompt: string,
        page: number,
        salience: number = 0
    ) {
        this.name = name;
        this.conditions = conditions;
        this.prompt = prompt;
        this.page = page;
        this.children = [];
        this.salience = salience;
        this.timestamp = Date.now();
        this.logicEngine = new LogicEngine();
        this.logicEngine.addMethod("find", ([str, keyword]: [string, string]) => new RegExp(`\\b${keyword}\\b`, 'i').test(str));
    }

    /**
     * Adds a child RuleNode to this node.
     * @param {RuleNode} ruleNode - The RuleNode to add as a child.
     */
    addChild(ruleNode: RuleNode): void {
        // Set the timestamp of the child node to the current timestamp for LIFO evaluation
        ruleNode.timestamp = Date.now();
        this.children.push(ruleNode);
    }

    /**
     * Evaluates the rule against the provided facts.
     * @param {Record<string, any>} facts - The facts to evaluate the rule against.
     * @returns {RuleNode | null} The RuleNode if the rule is satisfied, otherwise null.
     */
    evaluate(facts: Record<string, any>): RuleNode | null {
        console.log('Facts:', JSON.stringify(facts));
        const rule = {"and": this.conditions.map((condition: any) => condition)};
        console.table(JSON.stringify(rule));
        const isSatisfied = this.logicEngine.build(rule)(facts);
        console.log(`Evaluating ${this.name}: ${isSatisfied}`);
        return isSatisfied && typeof isSatisfied === 'boolean' ? this : null;
    }

    /**
     * Evaluates the children of this node against the provided facts.
     * @param {Record<string, any>} facts - The facts to evaluate the children against.
     * @returns {RuleNode[]} An array of satisfied RuleNodes.
     */
    evaluateChildren(facts: Record<string, any>): RuleNode[] {
        const satisfiedChildren: RuleNode[] = [];
        this.children.forEach(child => {
            const result = child.evaluate(facts);

            // If the child is satisfied, evaluate its children and add it to the satisfied children array
            if (result) {
                satisfiedChildren.push(...result.evaluateChildren(facts));
                satisfiedChildren.push(result);
            }
        });
        return satisfiedChildren;
    }

    /**
     * Generates a unique path for this node.
     * @param {string} parentPath - The path of the parent node.
     * @returns {string} The generated path.
     */
    generatePath(parentPath: string = ''): string {
        return parentPath ? `${parentPath}.${this.name}` : this.name;
    }

    /**
     * Serializes the RuleNode to a JSON string.
     * @returns {string} The JSON string representation of the RuleNode.
     */
    toJSON(): string {
        return JSON.stringify({
            name: this.name,
            conditions: this.conditions,
            prompt: this.prompt,
            page: this.page,
            salience: this.salience
        });
    }

    /**
     * Deserializes a JSON string to a RuleNode.
     * @param {string} json - The JSON string to deserialize.
     * @returns {RuleNode} The deserialized RuleNode.
     */
    static fromJSON(json: string): RuleNode {
        const obj = JSON.parse(json);
        return new RuleNode(obj.name, obj.conditions, obj.prompt, obj.page, obj.salience);
    }
}

/**
 * Manages a collection of root rules and evaluates them.
 * @class RulesEngine
 * @property {RuleNode[]} rootRules - The root rules of the network.
 */
export class RulesEngine {
    rootRules: RuleNode[];

    /**
     * Constructs a RulesEngine instance.
     */
    constructor() {
        this.rootRules = [];
    }

    /**
     * Adds a root rule to the engine.
     * @param {RuleNode} ruleNode - The RuleNode to add as a root rule.
     */
    addRootRule(ruleNode: RuleNode): void {
        ruleNode.timestamp = Date.now();
        this.rootRules.push(ruleNode);
    }

    /**
     * Evaluates all root rules against the provided facts.
     * @param {Record<string, any>} facts - The facts to evaluate the rules against.
     * @returns {{prompt: string, page: number} | undefined} The prompt and action value (page) of the most salient satisfied rule, or undefined if no rules are satisfied.
     */
    evaluate(facts: Record<string, any>): {prompt: string, page: number} | undefined {
        const satisfiedRules: RuleNode[] = [];

        this.rootRules.forEach(rule => {
            const result = rule.evaluate(facts);
            if (result) {
                satisfiedRules.push(...result.evaluateChildren(facts));
                satisfiedRules.push(result);
            }
        });


        if (satisfiedRules.length > 0) {
            // Sort the satisfied rules by salience and timestamp for LIFO evaluation
            const selectedRule = satisfiedRules.sort((a, b) => {
                // If the salience is the same, sort by timestamp
                if (a.salience === b.salience) {
                    return b.timestamp - a.timestamp;
                }
                // Otherwise, sort by salience
                return b.salience - a.salience;
            })[0];
            console.log(`Rule ${selectedRule.name} is executed.`);
            return {prompt: selectedRule.prompt, page: selectedRule.page};
        } else {
            console.log('No rules were satisfied.');
        }
    }
}