export async function addRuleNode(db, ruleNode, parentId = null) {
    const query = `
        INSERT INTO rules (name, conditions, action, salience, timestamp, parent_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
    `;
    const values = [
        ruleNode.name,
        JSON.stringify(ruleNode.conditions),
        ruleNode.action,
        ruleNode.salience,
        ruleNode.timestamp,
        parentId
    ];
    const result = await db.query(query, values);
    return result.rows[0].id;
}

export async function removeRuleNode(db, nodeId) {
    const query = `
        WITH RECURSIVE descendants AS (
            SELECT id FROM rules WHERE id = $1
            UNION ALL
            SELECT rn.id FROM rules rn
            INNER JOIN descendants d ON rn.parent_id = d.id
        )
        DELETE FROM rules WHERE id IN (SELECT id FROM descendants);
    `;
    await db.query(query, [nodeId]);
}

export async function updateRuleNode(db, nodeId, updatedFields) {
    const setClause = Object.keys(updatedFields).map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = Object.values(updatedFields);
    const query = `
        UPDATE rules
        SET ${setClause}
        WHERE id = $1
    `;
    await db.query(query, [nodeId, ...values]);
}

export async function getTree(db) {
    const query = `
        SELECT * FROM rules
        ORDER BY parent_id, id
    `;
    const result = await db.query(query);
    const nodes = result.rows;
    const nodeMap = new Map();

    nodes.forEach(node => {
        node.children = [];
        nodeMap.set(node.id, node);
    });

    const rootNodes = [];
    nodes.forEach(node => {
        if (node.parent_id) {
            nodeMap.get(node.parent_id).children.push(node);
        } else {
            rootNodes.push(node);
        }
    });

    return rootNodes;
}

export async function findNodeById(db, nodeId) {
    const query = `
        SELECT * FROM rules WHERE id = $1
    `;
    const result = await db.query(query, [nodeId]);
    return result.rows[0];
}