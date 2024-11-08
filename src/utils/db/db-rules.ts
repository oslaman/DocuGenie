import { RuleNode } from "@/utils/rete-network";
import { PGliteWorker } from "@electric-sql/pglite/worker";
import { initSchema } from "@/utils/db/db-helper";

/**
 * Inserts a root rule node into the database.
 * @param {PGliteWorker} pg - The PGliteWorker instance.
 * @param {RuleNode} ruleNode - The RuleNode to insert.
 * @throws {Error} If there is an error inserting the root rule node.
 */
export async function insertRootRuleNode(pg: PGliteWorker, ruleNode: RuleNode) {
    const jsonRule = JSON.parse(ruleNode.toJSON());
    const conditions = JSON.stringify(jsonRule.conditions);

    await pg.query('BEGIN');
    try {
        const res = await pg.query(
        `INSERT INTO rules (name, conditions, prompt, page, salience) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
            jsonRule.name,
            conditions,
            jsonRule.prompt,
            jsonRule.page,
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

/**
 * Inserts a child rule node into the database.
 * @param {PGliteWorker} pg - The PGliteWorker instance.
 * @param {RuleNode} ruleNode - The RuleNode to insert.
 * @param {string} parentId - The ID of the parent rule node.
 * @throws {Error} If there is an error inserting the child rule node.
 */
export async function insertChildRuleNode(pg: PGliteWorker, ruleNode: RuleNode, parentId: string) {
    const jsonRule = JSON.parse(ruleNode.toJSON());
    const conditions = JSON.stringify(jsonRule.conditions);

    console.log('Inserting rule:', jsonRule);
    console.log('Parent ID: ', parentId);

    await pg.query('BEGIN');
    try {
        await pg.query(
            `INSERT INTO rules (name, conditions, prompt, page, salience, parent_id) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                jsonRule.name,
                conditions,
                jsonRule.prompt,
                jsonRule.page,
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

/**
 * Retrieves all rule nodes from the database.
 * @param {PGliteWorker} pg - The PGliteWorker instance.
 * @returns {Promise<{ id: string, rule: RuleNode, parent: string | null }[]>} An array of RuleNode objects.
 */
export async function getAllRuleNodes(pg: PGliteWorker) {
    const query = `
        WITH RECURSIVE rule_tree AS (
            SELECT id, name, conditions, prompt, page, salience, parent_id
            FROM rules
            WHERE parent_id IS NULL
            UNION ALL
            SELECT r.id, r.name, r.conditions, r.prompt, r.page, r.salience, r.parent_id
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
            row.prompt,
            row.page,
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

/**
 * Retrieves all root rules from the database.
 * @param {PGliteWorker} pg - The PGliteWorker instance.
 * @returns {Promise<{ id: string, rule: RuleNode, parent: string | null }[]>} An array of RuleNode objects.
 */
export async function getRootRules(pg: PGliteWorker) {
    const query = `
        WITH RECURSIVE rule_tree AS (
            SELECT id, name, conditions, prompt, page, salience, parent_id
            FROM rules
            WHERE parent_id IS NULL
            UNION ALL
            SELECT r.id, r.name, r.conditions, r.prompt, r.page, r.salience, r.parent_id
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
            row.prompt,
            row.page,
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

/**
 * Removes a rule node from the database.
 * @param {PGliteWorker} pg - The PGliteWorker instance.
 * @param {string} nodeId - The ID of the rule node to remove.
 * @param {string} parentId - The ID of the parent rule node.
 * @throws {Error} If there is an error removing the rule node.
 */
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

/**
 * Updates a rule node in the database.
 * @param {PGliteWorker} pg - The PGliteWorker instance.
 * @param {string} nodeId - The ID of the rule node to update.
 * @param {RuleNode} updatedFields - The updated fields for the rule node.
 * @param {string} parentId - The ID of the parent rule node.
 * @throws {Error} If there is an error updating the rule node.
 */
export async function updateRuleNode(pg: PGliteWorker, nodeId: string, updatedFields: RuleNode, parentId: string) {
    await pg.query('BEGIN');
    try {
        const conditions = JSON.stringify(updatedFields.conditions);
        let template = `UPDATE rules SET name = $1, conditions = $2, prompt = $3, page = $4, salience = $5`;

        if (parentId) {
            template += `, parent_id = $6`;
            template += ` WHERE id = $7`;
            console.log("Updating parent")
            await pg.query(template, [updatedFields.name, conditions, updatedFields.prompt, updatedFields.page, updatedFields.salience, parentId, nodeId]);
        } else {
            template += `, parent_id = NULL`;
            template += ` WHERE id = $6`;
            console.warn("Updating no parent")
            await pg.query(template, [updatedFields.name, conditions, updatedFields.prompt, updatedFields.page, updatedFields.salience, nodeId]);
        }

        await pg.query('COMMIT');
    } catch (error) {
        await pg.query('ROLLBACK');
        console.error('Error updating rule node:', error);
        throw error;
    } finally {
        console.log("Updated rule node: ", nodeId);
    }
}

/**
 * Retrieves a rule node by its ID from the database.
 * @param {PGliteWorker} pg - The PGliteWorker instance.
 * @param {string} id - The ID of the rule node to retrieve.
 * @returns {Promise<{ id: string, rule: RuleNode, parent: string | null }[]>} An array of RuleNode objects.
 */
export async function getRuleById(pg: PGliteWorker, id: string) {
    const query = `
        WITH RECURSIVE rule_tree AS (
            SELECT id, name, conditions, prompt, page, salience, parent_id
            FROM rules
            WHERE id = $1
            UNION ALL
            SELECT r.id, r.name, r.conditions, r.prompt, r.page, r.salience, r.parent_id
            FROM rules r
            INNER JOIN rule_tree rt ON r.parent_id = rt.id
        )
        SELECT * FROM rule_tree;
    `;
    const res = await pg.query(query, [id]);

    const nodes: { [key: number]: RuleNode } = {};
    res.rows.forEach((row: any) => {
        nodes[row.id] = new RuleNode(row.name, JSON.parse(row.conditions), row.prompt, row.page, row.salience);
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

/**
 * Removes the parent of a rule node from the database.
 * @param {PGliteWorker} pg - The PGliteWorker instance.
 * @throws {Error} If there is an error removing the parent.
 * @param {string} nodeId - The ID of the rule node to remove the parent from.
 */
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

/**
 * Retrieves the total number of rules in the database.
 * @param {PGliteWorker} pg - The PGliteWorker instance.
 * @returns {Promise<number>} The total number of rules.
 */
export const getTotalRules = async (pg: PGliteWorker) => {
    const totalRules: any = await pg.query(`SELECT COUNT(*) FROM rules`);
    return totalRules.rows[0].count;
}