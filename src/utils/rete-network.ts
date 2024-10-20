export class RuleNode {
    name: string;
    conditions: ((facts: Record<string, any>) => boolean)[];
    action: (facts: Record<string, any>) => void;
    children: RuleNode[];
    salience: number;
    timestamp: number;
    rule: any;

    constructor(
        name: string,
        conditions: ((facts: Record<string, any>) => boolean)[],
        action: (facts: Record<string, any>) => void,
        salience: number = 0
    ) {
        this.name = name;
        this.conditions = conditions;
        this.action = action;
        this.children = [];
        this.salience = salience;
        this.timestamp = Date.now();
    }

    addChild(ruleNode: RuleNode): void {
        ruleNode.timestamp = Date.now();
        this.children.push(ruleNode);
    }

    evaluate(facts: Record<string, any>): RuleNode | null {
        const isSatisfied = this.conditions.every(condition => condition(facts));
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
            conditions: this.conditions.map(condition => condition.toString()),
            action: this.action.toString(),
            salience: this.salience
        });
    }

    static fromJSON(json: string): RuleNode {
        const obj = JSON.parse(json);
        const conditions = obj.conditions.map((condStr: string) => new Function('facts', `return ${condStr}`) as (facts: Record<string, any>) => boolean);
        const action = new Function('facts', obj.action) as (facts: Record<string, any>) => void;
        return new RuleNode(obj.name, conditions, action, obj.salience);
    }
}

class RulesEngine {
    rootRules: RuleNode[];

    constructor() {
        this.rootRules = [];
    }

    addRootRule(ruleNode: RuleNode): void {
        ruleNode.timestamp = Date.now();
        this.rootRules.push(ruleNode);
    }

    evaluate(facts: Record<string, any>): void {
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

            selectedRule.action(facts);
            console.log(`Rule ${selectedRule.name} is executed.`);
        } else {
            console.log('No rules were satisfied.');
        }
    }
}

const engine = new RulesEngine();

const rule1 = new RuleNode(
    'Rule 1',
    [
        facts => facts['content'] && facts['content'].includes('hot'),
        facts => facts['content'] && facts['content'].includes('low humidity')
    ],
    facts => {
        console.log('Action for Rule 1 executed');
        facts['pages'].push(1);
    },
    1
);

const rule2 = new RuleNode(
    'Rule 2',
    [
        facts => facts['content'] && facts['content'].includes('cold')
    ],
    facts => {
        console.log('Action for Rule 2 executed');
        facts['pages'].push(2);
    },
    2
);

const rule1_1 = new RuleNode(
    'Rule 1.1',
    [
        facts => facts['content'] && facts['content'].includes('high pressure')
    ],
    facts => {
        console.log('Action for Rule 1.1 executed');
        facts['pages'].push(10);
    },
    2
);

const rule1_2 = new RuleNode(
    'Rule 1.2',
    [
        facts => facts['content'] && facts['content'].includes('windy')
    ],
    facts => {
        console.log('Action for Rule 1.2 executed');
        facts['pages'].push(20);
    },
    3
);

const rule1_3 = new RuleNode(
    'Rule 1.3',
    [
        facts => facts['content'] && facts['content'].includes('humid')
    ],
    facts => {
        console.log('Action for Rule 1.3 executed');
        facts['pages'].push(30);
    },
    1
);

const rule1_1_1 = new RuleNode(
    'Rule 1.1.1',
    [
        facts => facts['content'] && facts['content'].includes('extreme')
    ],
    facts => {
        console.log('Action for Rule 1.1.1 executed');
        facts['pages'].push(100);
    },
    3
);

rule1.addChild(rule1_1);
rule1.addChild(rule1_2);
rule1.addChild(rule1_3);

engine.addRootRule(rule1);
engine.addRootRule(rule2);

rule1_1.addChild(rule1_1_1);

const facts = {
    content: 'It is a hot and cold, windy, and humid day with high pressure and low humidity, and extreme conditions',
    pages: []
};

console.log(rule1.toJSON());
console.log("----------------------------------");
console.log(RuleNode.fromJSON(rule1_1.toJSON()));

engine.evaluate(facts);

console.log("Pages: ", facts.pages);
