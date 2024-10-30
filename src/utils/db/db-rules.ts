import { RuleNode } from "@/utils/rete-network";
import { PGliteWorker } from "@electric-sql/pglite/worker";

export async function insertRootRuleNode(pg: PGliteWorker, ruleNode: RuleNode) {
    const jsonRule = JSON.parse(ruleNode.toJSON());
    const conditions = JSON.stringify(jsonRule.conditions);
    console.log("JSON Rule: ", jsonRule);
    console.log("Conditions: ", conditions);
    console.log('Inserting rule:', jsonRule);

    await pg.query('BEGIN');
    try {
        const res = await pg.query(
        `INSERT INTO rules (name, conditions, action, salience) VALUES ($1, $2, $3, $4) RETURNING id`,
        [
            jsonRule.name,
            conditions,
            jsonRule.action,
            jsonRule.salience
        ]
    );

        const id = (res.rows[0] as { id: string }).id;

        for (const child of ruleNode.children) {
            await insertChildRuleNode(pg, child, id);
        }
        await pg.query('COMMIT');
    } catch (error) {
        await pg.query('ROLLBACK');
        console.error('Error inserting root rule node:', error);
        throw error;
    }
}

export async function insertChildRuleNode(pg: PGliteWorker, ruleNode: RuleNode, parentId: string) {
    const jsonRule = JSON.parse(ruleNode.toJSON());
    const conditions = JSON.stringify(jsonRule.conditions);

    console.log('Inserting rule:', jsonRule);
    console.log('Parent ID: ', parentId);

    await pg.query('BEGIN');
    try {
        await pg.query(
            `INSERT INTO rules (name, conditions, action, salience, parent_id) VALUES ($1, $2, $3, $4, $5)`,
            [
                jsonRule.name,
                conditions,
                jsonRule.action,
                jsonRule.salience,
                parentId
            ]
        );

        for (const child of ruleNode.children) {
            await insertChildRuleNode(pg, child, parentId);
        }
        await pg.query('COMMIT');
    } catch (error) {
        await pg.query('ROLLBACK');
        console.error('Error inserting child rule node:', error);
        throw error;
    }
}

export async function getAllRuleNodes(pg: PGliteWorker) {
    const query = `
        WITH RECURSIVE rule_tree AS (
            SELECT id, name, conditions, action, salience, parent_id
            FROM rules
            WHERE parent_id IS NULL
            UNION ALL
            SELECT r.id, r.name, r.conditions, r.action, r.salience, r.parent_id
            FROM rules r
            INNER JOIN rule_tree rt ON r.parent_id = rt.id
        )
        SELECT * FROM rule_tree ORDER BY id;
    `;
    const res = await pg.query(query);

    const nodes: { [key: number]: RuleNode } = {};
    const parentChildMap: { [key: number]: number[] } = {};

    res.rows.forEach((row: any) => {
        const ruleNode = new RuleNode(
            row.name,
            JSON.parse(row.conditions),
            row.action,
            row.salience
        );
        ruleNode.parentId = row.parent_id;
        nodes[row.id] = ruleNode;

        if (row.parent_id) {
            if (!parentChildMap[row.parent_id]) {
                parentChildMap[row.parent_id] = [];
            }
            parentChildMap[row.parent_id].push(row.id);
        }
    });

    Object.entries(parentChildMap).forEach(([parentId, childIds]) => {
        childIds.forEach((childId) => {
            nodes[Number(parentId)].children.push(nodes[childId]);
        });
    });

    return Object.entries(nodes).map(([id, ruleNode]) => ({
        id: id,
        rule: ruleNode,
        parent: ruleNode.parentId
    }));
}

export async function getRootRules(pg: PGliteWorker) {
    const query = `
        WITH RECURSIVE rule_tree AS (
            SELECT id, name, conditions, action, salience, parent_id
            FROM rules
            WHERE parent_id IS NULL
            UNION ALL
            SELECT r.id, r.name, r.conditions, r.action, r.salience, r.parent_id
            FROM rules r
            INNER JOIN rule_tree rt ON r.parent_id = rt.id
        )
        SELECT * FROM rule_tree ORDER BY id;
    `;
    const res = await pg.query(query);

    const nodes: { [key: number]: RuleNode } = {};
    res.rows.forEach((row: any) => {
        nodes[row.id] = new RuleNode(
            row.name,
            JSON.parse(row.conditions),
            row.action,
            row.salience
        );
        nodes[row.id].parentId = row.parent_id;
    });

    res.rows.forEach((row: any) => {
        if (row.parent_id) {
            nodes[row.parent_id].children.push(nodes[row.id]);
        }
    });

    const rootNodes = Object.values(nodes).filter((node: RuleNode) => node.parentId === null);
    return rootNodes;
}

export async function removeRuleNode(pg: PGliteWorker, nodeId: string, parentId: string) {
    await pg.query('BEGIN');

    try {
        console.log("Parent ID: ", parentId);
        if (parentId && parentId !== "") {
            await pg.query(`UPDATE rules SET parent_id = $1 WHERE parent_id = $2`, [parentId, nodeId]);
        } else {
            console.warn(`Node with ID ${nodeId} has no parent, skipping reassignment`);
            await pg.query(`UPDATE rules SET parent_id = NULL WHERE parent_id = $1`, [nodeId]);
        }

        await pg.query(`DELETE FROM rules WHERE id = $1`, [nodeId]);

        await pg.query('COMMIT');
    } catch (error) {
        await pg.query('ROLLBACK');
        console.error('Error removing rule node:', error);
        throw error;
    } finally {
        console.log("Removed rule node: ", nodeId);
    }
}

export async function updateRuleNode(pg: PGliteWorker, nodeId: string, updatedFields: RuleNode, parentId: string) {
    await pg.query('BEGIN');
    try {
        const conditions = JSON.stringify(updatedFields.conditions);
        let template = `UPDATE rules SET name = $1, conditions = $2, action = $3, salience = $4`;
        if (parentId) {
            template += `, parent_id = $5`;
        }
        template += ` WHERE id = $6`;
        await pg.query(template, [updatedFields.name, conditions, updatedFields.actionValue, updatedFields.salience, parentId, nodeId]);
        await pg.query('COMMIT');
    } catch (error) {
        await pg.query('ROLLBACK');
        console.error('Error updating rule node:', error);
        throw error;
    } finally {
        console.log("Updated rule node: ", nodeId);
    }
}

export async function getRuleById(pg: PGliteWorker, id: string) {
    const query = `
        WITH RECURSIVE rule_tree AS (
            SELECT id, name, conditions, action, salience, parent_id
            FROM rules
            WHERE id = $1
            UNION ALL
            SELECT r.id, r.name, r.conditions, r.action, r.salience, r.parent_id
            FROM rules r
            INNER JOIN rule_tree rt ON r.parent_id = rt.id
        )
        SELECT * FROM rule_tree;
    `;
    const res = await pg.query(query, [id]);

    const nodes: { [key: number]: RuleNode } = {};
    res.rows.forEach((row: any) => {
        nodes[row.id] = new RuleNode(row.name, JSON.parse(row.conditions), row.action, row.salience);
        nodes[row.id].parentId = row.parent_id;
    });

    res.rows.forEach((row: any) => {
        if (row.parent_id && nodes[row.parent_id]) {
            if (!nodes[row.parent_id].children) {
                nodes[row.parent_id].children = [];
            }
            nodes[row.parent_id].children.push(nodes[row.id]);
        } else {
            console.warn(`Parent node not found for child with ID: ${row.id}`);
        }
    });

    console.log("Nodes (getRuleById): ", nodes);

    return Object.entries(nodes).map(([id, ruleNode]) => ({
        id: id,
        rule: ruleNode,
        parent: ruleNode.parentId
    }));
}

export async function removeParent(pg: PGliteWorker, nodeId: string) {
    await pg.query('BEGIN');
    try {
        await pg.query(`UPDATE rules SET parent_id = NULL WHERE id = $1`, [nodeId]);
        await pg.query('COMMIT');
    } catch (error) {
        await pg.query('ROLLBACK');
        console.error('Error removing parent:', error);
        throw error;
    } finally {
        console.log("Removed parent: ", nodeId);
    }
}
