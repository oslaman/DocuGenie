import { describe, it, expect, beforeEach } from 'vitest';
import { RuleNode, RulesEngine } from '@/utils/rete-network';

describe('RuleNode', () => {
    let ruleNode: RuleNode;

    beforeEach(() => {
        ruleNode = new RuleNode('TestRule', [{ "==": [{ "var": "key" }, "value"] }], 10, 5);
    });

    it('should create a RuleNode with correct properties', () => {
        expect(ruleNode.name).toBe('TestRule');
        expect(ruleNode.conditions).toEqual([{ "==": [{ "var": "key" }, "value"] }]);
        expect(ruleNode.actionValue).toBe(10);
        expect(ruleNode.salience).toBe(5);
        expect(ruleNode.children).toEqual([]);
    });

    it('should add a child RuleNode', () => {
        const childNode = new RuleNode('ChildRule', [], 5);
        ruleNode.addChild(childNode);
        expect(ruleNode.children).toContain(childNode);
    });

    it('should evaluate a rule correctly', () => {
        const facts = { key: 'value' };
        const result = ruleNode.evaluate(facts);
        expect(result).toBe(ruleNode);
    });

    it('should not satisfy a rule with incorrect facts', () => {
        const facts = { key: 'wrongValue' };
        const result = ruleNode.evaluate(facts);
        expect(result).toBeNull();
    });

    it('should serialize and deserialize correctly', () => {
        const json = ruleNode.toJSON();
        const deserializedNode = RuleNode.fromJSON(json);
        expect(deserializedNode.name).toBe(ruleNode.name);
        expect(deserializedNode.conditions).toEqual(ruleNode.conditions);
        expect(deserializedNode.actionValue).toBe(ruleNode.actionValue);
        expect(deserializedNode.salience).toBe(ruleNode.salience);
    });
});

describe('RulesEngine', () => {
    let rulesEngine: RulesEngine;
    let ruleNode: RuleNode;

    beforeEach(() => {
        rulesEngine = new RulesEngine();
        ruleNode = new RuleNode('TestRule', [{ "==": [{ "var": "key" }, "value"] }], 10, 5);
    });

    it('should add a root rule', () => {
        rulesEngine.addRootRule(ruleNode);
        expect(rulesEngine.rootRules).toContain(ruleNode);
    });

    it('should evaluate and return the action value of the satisfied rule', () => {
        rulesEngine.addRootRule(ruleNode);
        const facts = { key: 'value' };
        const actionValue = rulesEngine.evaluate(facts);
        expect(actionValue).toBe(10);
    });

    it('should return undefined if no rules are satisfied', () => {
        rulesEngine.addRootRule(ruleNode);
        const facts = { key: 'wrongValue' };
        const actionValue = rulesEngine.evaluate(facts);
        expect(actionValue).toBeUndefined();
    });

    it('should prioritize rules based on salience and timestamp', () => {
        const highSalienceRule = new RuleNode('HighSalienceRule', [{ "==": [{ "var": "key" }, "value"] }], 20, 10);
        const recentRule = new RuleNode('RecentRule', [{ "==": [{ "var": "key" }, "value"] }], 15, 5);

        rulesEngine.addRootRule(ruleNode);
        rulesEngine.addRootRule(highSalienceRule);
        rulesEngine.addRootRule(recentRule);

        const facts = { key: 'value' };
        const actionValue = rulesEngine.evaluate(facts);
        expect(actionValue).toBe(20); // The rule with the highest salience (priority) should be selected
    });
});