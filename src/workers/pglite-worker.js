import { PGlite } from '@electric-sql/pglite'
import { worker } from '@electric-sql/pglite/worker'
import { vector } from "@electric-sql/pglite/vector"
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm"
import { ltree } from '@electric-sql/pglite/contrib/ltree'
import { adminpack } from '@electric-sql/pglite/contrib/adminpack';


worker({
  async init(options) {
    console.log('worker init: options', options)
    const pglite = new PGlite({
      ...options,
      extensions: {
         vector,
         pg_trgm,
         ltree,
         adminpack
      }
    })
    console.log('worker init: pglite', pglite)
    return pglite
  },
})