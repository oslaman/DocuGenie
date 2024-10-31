import { LogicEngine } from 'json-logic-engine'

/**
 * Represents a node in a rule tree structure.
 */
export class RuleNode {
    name: string;
    conditions: any;
    actionValue: number;
    children: RuleNode[];
    salience: number;
    timestamp: number;
    parentId: string | null = null;
    logicEngine: LogicEngine;

    /**
     * Constructs a RuleNode instance.
     * @param name - The name of the rule.
     * @param conditions - The conditions that must be satisfied for the rule.
     * @param actionValue - The action value to execute if the rule is satisfied.
     * @param salience - The priority of the rule (default is 0).
     */
    constructor(
        name: string,
        conditions: any,
        actionValue: number,
        salience: number = 0
    ) {
        this.name = name;
        this.conditions = conditions;
        this.actionValue = actionValue;
        this.children = [];
        this.salience = salience;
        this.timestamp = Date.now();
        this.logicEngine = new LogicEngine();
        this.logicEngine.addMethod("find", ([str, keyword]: [string, string]) => new RegExp(`\\b${keyword}\\b`, 'i').test(str));
    }

    /**
     * Adds a child RuleNode to this node.
     * @param ruleNode - The RuleNode to add as a child.
     */
    addChild(ruleNode: RuleNode): void {
        ruleNode.timestamp = Date.now();
        this.children.push(ruleNode);
    }

    /**
     * Evaluates the rule against the provided facts.
     * @param facts - The facts to evaluate the rule against.
     * @returns The RuleNode if the rule is satisfied, otherwise null.
     */
    evaluate(facts: Record<string, any>): RuleNode | null {
        console.log('Facts:', JSON.stringify(facts));
        const rule = {"and": this.conditions.map((condition: any) => condition)};
        console.table(JSON.stringify(rule));
        const isSatisfied = this.logicEngine.build(rule)(facts);
        console.log(`Evaluating ${this.name}: ${isSatisfied}`);
        return isSatisfied ? this : null;
    }

    /**
     * Evaluates the children of this node against the provided facts.
     * @param facts - The facts to evaluate the children against.
     * @returns An array of satisfied RuleNodes.
     */
    evaluateChildren(facts: Record<string, any>): RuleNode[] {
        const satisfiedChildren: RuleNode[] = [];
        this.children.forEach(child => {
            const result = child.evaluate(facts);
            if (result) {
                satisfiedChildren.push(...result.evaluateChildren(facts));
                satisfiedChildren.push(result);
            }
        });
        return satisfiedChildren;
    }

    /**
     * Generates a unique path for this node.
     * @param parentPath - The path of the parent node.
     * @returns The generated path.
     */
    generatePath(parentPath: string = ''): string {
        return parentPath ? `${parentPath}.${this.name}` : this.name;
    }

    /**
     * Serializes the RuleNode to a JSON string.
     * @returns The JSON string representation of the RuleNode.
     */
    toJSON(): string {
        return JSON.stringify({
            name: this.name,
            conditions: this.conditions,
            action: this.actionValue,
            salience: this.salience
        });
    }

    /**
     * Deserializes a JSON string to a RuleNode.
     * @param json - The JSON string to deserialize.
     * @returns The deserialized RuleNode.
     */
    static fromJSON(json: string): RuleNode {
        const obj = JSON.parse(json);
        return new RuleNode(obj.name, obj.conditions, obj.action, obj.salience);
    }
}

/**
 * Manages a collection of root rules and evaluates them.
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
     * @param ruleNode - The RuleNode to add as a root rule.
     */
    addRootRule(ruleNode: RuleNode): void {
        ruleNode.timestamp = Date.now();
        this.rootRules.push(ruleNode);
    }

    /**
     * Evaluates all root rules against the provided facts.
     * @param facts - The facts to evaluate the rules against.
     * @returns The action value of the most salient satisfied rule, or undefined if no rules are satisfied.
     */
    evaluate(facts: Record<string, any>): number | undefined {
        const satisfiedRules: RuleNode[] = [];

        this.rootRules.forEach(rule => {
            const result = rule.evaluate(facts);
            if (result) {
                satisfiedRules.push(...result.evaluateChildren(facts));
                satisfiedRules.push(result);
            }
        });

        if (satisfiedRules.length > 0) {
            const selectedRule = satisfiedRules.sort((a, b) => {
                if (a.salience === b.salience) {
                    return b.timestamp - a.timestamp;
                }
                return b.salience - a.salience;
            })[0];
            console.log(`Rule ${selectedRule.name} is executed.`);
            return selectedRule.actionValue;
        } else {
            console.log('No rules were satisfied.');
        }
    }
}