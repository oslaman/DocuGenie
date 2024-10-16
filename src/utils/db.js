import { PGliteWorker } from "@electric-sql/pglite/worker";
import { ReteNetwork, Rule } from './rete-network';

let dbInstance;

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
      -- drop table if exists embeddings;

      create table if not exists embeddings (
        id bigint primary key generated always as identity,
        page_id integer,
        chunk_id integer,
        content text not null,
        embedding vector (384)
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

const rules = [
    new Rule(
        [(fact) => fact.query.includes('integrity') || fact.query.includes('trust')],
        (fact) => {fact.pageNumbers.push(69); console.log("Log effettuato con successo");},
        'Checks if the query contains "integrity" or "trust"'
    ),
    new Rule(
        [(fact) => fact.query.includes('food') || fact.query.includes('delicious')],
        (fact) => fact.pageNumbers.push(2),
        'Checks if the query contains "food" or "delicious"'
    ),
    // Condizione basata su pattern regex
    new Rule(
        [(fact) => /integrity|trust/.test(fact.query)],
        (fact) => fact.pageNumbers.push(27),
        'Checks if the query contains "integrity" or "trust"'
    ),
    // Condizione basata su lunghezza della query
    new Rule(
        [(fact) => fact.query.length > 50],
        (fact) => fact.pageNumbers.push(10),
        'Checks if the query is longer than 50 characters'
    ),
    // Condizione basata su parole chiave multiple
    new Rule(
        [(fact) => fact.query.includes('food') && fact.query.includes('delicious')],
        (fact) => fact.pageNumbers.push(2),
        'Checks if the query contains both "food" and "delicious"'
    ),
    // Condizione basata su valori numerici
    new Rule(
        [(fact) => /\d+/.test(fact.query) && parseInt(fact.query.match(/\d+/)[0], 10) > 100],
        (fact) => fact.pageNumbers.push(15),
        'Checks if the query contains a number greater than 100'
    ),
    // Condizione basata su data e ora
    new Rule(
        [(fact) => /\d{4}-\d{2}-\d{2}/.test(fact.query)],
        (fact) => fact.pageNumbers.push(20),
        'Checks if the query contains a date in the format YYYY-MM-DD'
    ),
    // Condizione basata su presenza di caratteri speciali
    new Rule(
        [(fact) => /[@#$%^&*]/.test(fact.query)],
        (fact) => fact.pageNumbers.push(25),
        'Checks if the query contains special characters'
    ),
    // Condizione basata su sinonimi
    new Rule(
        [(fact) => /happy|joyful|content/.test(fact.query)],
        (fact) => fact.pageNumbers.push(30),
        'Checks if the query contains synonyms for "happy", "joyful", or "content"'
    ),
];

const reteNetwork = new ReteNetwork();
for (const rule of rules) {
    reteNetwork.addRule(rule);
}

export const search = async (
    pg,
    embedding,
    query,
    match_threshold = 0.8,
    limit = 3,
) => {
    const fact = { query, pageNumbers: [] };
    reteNetwork.addFact(fact);
    const { pageNumbers } = fact;

    console.log('Page Numbers:', pageNumbers);
    console.log('Embedding:', embedding);
    console.log('Query:', query);

    let vectorResults;
    if (pageNumbers.length > 0) {
        console.log('Using vector search with page', pageNumbers);
        vectorResults = await pg.query(
            `
          select * from embeddings
          where embeddings.page_id = ANY($1)
          -- order by embeddings.embedding <#> $2
          limit $2;
          `,
            [pageNumbers, Number(limit)],
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

    return combinedResults;
};

export const clearDb = async (pg) => {
    await pg.query(`drop table if exists embeddings;`);
    await initSchema(pg);
};

export const getDbData = async (pg) => {
    const res = await pg.query(`SELECT * FROM embeddings;`);
    return res.rows;
};