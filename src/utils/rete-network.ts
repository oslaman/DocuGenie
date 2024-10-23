import { LogicEngine } from 'json-logic-engine'

export class RuleNode {
    name: string;
    conditions: any;
    actionValue: number;
    children: RuleNode[];
    salience: number;
    timestamp: number;
    logicEngine: LogicEngine;

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

    addChild(ruleNode: RuleNode): void {
        ruleNode.timestamp = Date.now();
        this.children.push(ruleNode);
    }

    evaluate(facts: Record<string, any>): RuleNode | null {
        console.log('Facts:', JSON.stringify(facts));
        const rule = {"and": this.conditions.map((condition: any) => condition)};
        console.table(JSON.stringify(rule));
        const isSatisfied = this.logicEngine.build(rule)(facts);
        console.log(`Evaluating ${this.name}: ${isSatisfied}`);
        return isSatisfied ? this : null;
    }

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

    generatePath(parentPath: string = ''): string {
        return parentPath ? `${parentPath}.${this.name}` : this.name;
    }

    toJSON(): string {
        return JSON.stringify({
            name: this.name,
            conditions: this.conditions,
            action: this.actionValue,
            salience: this.salience
        });
    }

    static fromJSON(json: string): RuleNode {
        const obj = JSON.parse(json);
        return new RuleNode(obj.name, obj.conditions, obj.action, obj.salience);
    }
}

export class RulesEngine {
    rootRules: RuleNode[];

    constructor() {
        this.rootRules = [];
    }

    addRootRule(ruleNode: RuleNode): void {
        ruleNode.timestamp = Date.now();
        this.rootRules.push(ruleNode);
    }

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