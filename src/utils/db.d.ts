export interface Embedding {
    page: number;
    index: number;
    text: string;
    embedding_of_chunk: number[] | string;
  }
  
  export function getDB(): Promise<any>;
  export function initSchema(db: any): Promise<void>;
  export function countRows(db: any, table: string): Promise<number>;
  export function seedDb(db: any, embeddings: Embedding[]): Promise<void>;
  export function search(
    db: any,
    embedding: any,
    query: any,
    match_threshold?: number,
    limit?: number
  ): Promise<any[]>;
  export function clearDb(db: any): Promise<void>;
  export function getDbData(db: any): Promise<any[]>;
  export function seedSingleDb(db: any, embeddings: Embedding[]): Promise<void>;