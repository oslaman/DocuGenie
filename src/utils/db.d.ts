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
  export function getAllRuleNodes(db: any): Promise<RuleNode[]>;
  export function insertRootRuleNode(db: any, ruleNode: RuleNode): Promise<void>;
  export function insertChildRuleNode(db: any, ruleNode: RuleNode, parentId: string): Promise<void>;
  export function removeRuleNode(db: any, nodeId: string): Promise<void>;
  export function updateRuleNode(db: any, nodeId: string, updatedFields: any): Promise<void>;
  export function getRuleById(db: any, id: string): Promise<any[]>;
  export function reassignChildren(db: any, nodeId: string, newParentId: string): Promise<void>;
  export function removeParent(db: any, nodeId: string): Promise<void>;