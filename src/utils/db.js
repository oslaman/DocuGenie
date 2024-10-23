import { PGliteWorker } from "@electric-sql/pglite/worker";
import { RuleNode } from "@/utils/rete-network";
import { RulesEngine } from "@/utils/rete-network";


let dbInstance = null;

export async function getDB() {
    if (dbInstance) {
        return dbInstance;
    }
    const pg = new PGliteWorker(
        new Worker(new URL('./pglite-worker.js', import.meta.url), {
            type: 'module',
        }),
        {
            dataDir: 'idb://rag-app',
        }
    )

    await pg.waitReady;
    dbInstance = pg;

    return pg;
}

export const initSchema = async (pg) => {
    await pg.exec(`
      create extension if not exists vector;
      create extension if not exists pg_trgm; -- Per BM25
      create extension if not exists ltree;
      -- drop table if exists embeddings;
      -- drop table if exists rules;
      drop table if exists foo;

      create table if not exists embeddings (
        id bigint primary key generated always as identity,
        page_id integer,
        chunk_id integer,
        content text not null,
        embedding vector (384)
      );

      create table if not exists rules (
        id serial primary key,
        name text not null,
        conditions text not null,
        action text not null,
        salience integer not null,
        parent_id integer references rules(id),
        created_at timestamp default current_timestamp
      );

      create index on embeddings using hnsw (embedding vector_ip_ops);
      create index on embeddings using gin (content gin_trgm_ops); -- Index per BM25
    `);
};

export const countRows = async (pg, table) => {
    const res = await pg.query(`SELECT COUNT(*) FROM ${table};`);
    return (res.rows[0]).count;
};

export const seedDb = async (db, embeddings, batchSize = 500) => {
    console.log("Seeding DB: ", embeddings);
    for (let i = 0; i < embeddings.length; i += batchSize) {
        const batch = embeddings.slice(i, i + batchSize);
        const values = batch.map((embedding, index) =>
            `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`
        ).join(", ");

        const params = batch.flatMap(embedding => [
            embedding.page,
            embedding.index,
            embedding.text,
            JSON.stringify(embedding.embedding_of_chunk)
        ]);

        await db.query(
            `
            INSERT INTO embeddings (page_id, chunk_id, content, embedding)
            VALUES ${values};
            `,
            params
        );
    }
}

export async function insertRootRuleNode(db, ruleNode) {
    const jsonRule = JSON.parse(ruleNode.toJSON());
    const conditions = JSON.stringify(jsonRule.conditions);
    console.log("JSON Rule: ", jsonRule);
    console.log("Conditions: ", conditions);
    console.log('Inserting rule:', jsonRule);

    const res = await db.query(
        `INSERT INTO rules (name, conditions, action, salience) VALUES ($1, $2, $3, $4) RETURNING id`,
        [
            jsonRule.name,
            conditions,
            jsonRule.action,
            jsonRule.salience
        ]
    );

    const id = res.rows[0].id;

    for (const child of ruleNode.children) {
        await insertChildRuleNode(db, child, id);
    }
}

export async function insertChildRuleNode(db, ruleNode, parentId) {
    const jsonRule = JSON.parse(ruleNode.toJSON());
    const conditions = JSON.stringify(jsonRule.conditions);

    console.log('Inserting rule:', jsonRule);
    console.log('Parent ID: ', parentId);

    await db.query(
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
        await insertChildRuleNode(db, child, parentId);
    }
}

export const seedSingleDb = async (db, embeddings, batchSize = 500) => {
    console.log("Seeding DB: ", embeddings);
    const t1 = performance.now();
    for (let i = 0; i < embeddings.length; i += batchSize) {
        const batch = embeddings.slice(i, i + batchSize);
        const values = batch.map((embedding, index) =>
            `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`
        ).join(", ");

        const params = batch.flatMap(embedding => [embedding.content.page, embedding.content.index, embedding.content.text, JSON.stringify(embedding.embedding)]);

        await db.query(
            `
            INSERT INTO embeddings (page_id, chunk_id, content, embedding)
            VALUES ${values};
            `,
            params
        );
    }
    const t2 = performance.now();
    console.log(`DB seed completed in ${((t2 - t1) / 1000).toFixed(2)} seconds`);
}

export const search = async (
    pg,
    embedding,
    query,
    match_threshold = 0.8,
    limit = 3,
) => {
    const rules = await getRootRules(pg);
    const engine = new RulesEngine();

    rules.forEach(rule => engine.addRootRule(rule));

    let pages;
    try {
        pages = [engine.evaluate({query: query})];
    } catch (error) {
        console.error('Error evaluating rules: ', error);
    }
    console.log(typeof pages, pages);
    console.log('Pages: ', pages);

    let vectorResults;
    if (pages.length > 0) {
        console.log('Using vector search with page', pages);
        vectorResults = await pg.query(
            `
          select * from embeddings
          where embeddings.page_id = ANY($1)
          `,
            [pages],
        );

        console.table(vectorResults.rows);
    } else {
        vectorResults = await pg.query(
            `
          select * from embeddings
          where embeddings.embedding <#> $1 < $2
          order by embeddings.embedding <#> $1
          limit $3;
          `,
            [JSON.stringify(embedding), -Number(match_threshold), Number(limit)],
        );
    }

    const bm25Results = await pg.query(
        `
      select *, ts_rank_cd(to_tsvector(content), plainto_tsquery($1)) as rank
      from embeddings
      where to_tsvector(content) @@ plainto_tsquery($1)
      order by rank desc
      limit $2;
      `,
        [query, Number(limit)],
    );

    const combinedResults = [...vectorResults.rows, ...bm25Results.rows]
        .sort((a, b) => (a.distance || 0) - (b.distance || 0) + (b.rank || 0) - (a.rank || 0))
        .slice(0, limit);

    const formattedChunks = combinedResults.map(result => `- ${result.content}`);

    return formattedChunks;
};

export const clearDb = async (pg) => {
    await pg.query(`drop table if exists embeddings;`);
    await initSchema(pg);
};

export const getDbData = async (pg) => {
    const res = await pg.query(`SELECT * FROM embeddings;`);
    return res.rows;
};

export async function getAllRuleNodes(pg) {
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

    const nodes = {};
    res.rows.forEach(row => {
        nodes[row.id] = new RuleNode(
            row.name,
            JSON.parse(row.conditions),
            row.action,
            row.salience
        );
        nodes[row.id].parentId = row.parent_id;
    });

    res.rows.forEach(row => {
        if (row.parent_id) {
            nodes[row.parent_id].children.push(nodes[row.parent_id]);
        }
    });

    return Object.entries(nodes).map(([id, ruleNode]) => ({
        id: id,
        rule: ruleNode,
        parent: ruleNode.parentId
    }));
}

export async function getRootRules(pg) {
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

    const nodes = {};
    res.rows.forEach(row => {
        nodes[row.id] = new RuleNode(
            row.name,
            JSON.parse(row.conditions),
            row.action,
            row.salience
        );
        nodes[row.id].parentId = row.parent_id;
    });

    res.rows.forEach(row => {
        if (row.parent_id) {
            nodes[row.parent_id].children.push(nodes[row.id]);
        }
    });

    const rootNodes = Object.values(nodes).filter(node => node.parentId === null);
    return rootNodes;
}

export async function removeRuleNode(db, nodeId) {
    await db.query('BEGIN');

    try {
        const childNodes = await db.query(
            `SELECT id FROM rules WHERE parent_id = $1`,
            [nodeId]
        );

        for (const child of childNodes.rows) {
            await removeRuleNode(db, child.id);
        }

        await db.query(
            `DELETE FROM rules WHERE id = $1`,
            [nodeId]
        );

        await db.query('COMMIT');
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error removing rule node:', error);
        throw error;
    }
}

export async function updateRuleNode(db, nodeId, updatedFields) {
    await db.query('UPDATE rules SET $1 WHERE id = $2', [updatedFields, nodeId]);
}