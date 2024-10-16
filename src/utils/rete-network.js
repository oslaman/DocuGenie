class Node {
    constructor() {
        this.children = [];
    }

    addChild(node) {
        this.children.push(node);
    }

    propagate(fact) {
        for (const child of this.children) {
            child.propagate(fact);
        }
    }
}

class ConditionNode extends Node {
    constructor(condition) {
        super();
        this.condition = condition;
    }

    propagate(fact) {
        if (this.condition(fact)) {
            super.propagate(fact);
        }
    }
}

class ActionNode extends Node {
    constructor(action) {
        super();
        this.action = action;
    }

    propagate(fact) {
        this.action(fact);
    }
}

export class Rule {
    constructor(conditions, action, description) {
        this.conditions = conditions;
        this.action = action;
        this.description = description;
    }
}

export class ReteNetwork {
    constructor() {
        this.root = new Node();
    }

    addRule(rule) {
        let currentNode = this.root;
        for (const condition of rule.conditions) {
            const conditionNode = new ConditionNode(condition);
            currentNode.addChild(conditionNode);
            currentNode = conditionNode;
        }
        const actionNode = new ActionNode(rule.action);
        currentNode.addChild(actionNode);
    }

    addFact(fact) {
        this.root.propagate(fact);
    }
}