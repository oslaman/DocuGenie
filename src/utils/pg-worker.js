import { PGlite } from '@electric-sql/pglite'
import { worker } from '@electric-sql/pglite/worker'
import { pg_trgm, vector } from '@electric-sql/pglite'

worker({
  async init(options) {
    const pg = new PGlite('idb://rag-app', {
      ...options,
      extensions: { pg_trgm, vector },
    })
    return pg
  },
})

console.log('Worker process started')