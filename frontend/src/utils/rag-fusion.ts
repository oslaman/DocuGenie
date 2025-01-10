interface SearchResult {
  content: string;
  page_id: number;
  score?: number;
  distance?: number;
  rank?: number;
}

export class RAGFusion {
  private readonly reciprocalRankK: number;

  constructor(reciprocalRankK: number = 60) {
    this.reciprocalRankK = reciprocalRankK;
  }

  /*
   * Reciprocal Rank Fusion scoring
   * @param {number} rank - The rank of the result.
   * @returns {number} The reciprocal rank fusion score.
   */
  private rrf(rank: number): number {
    return 1 / (this.reciprocalRankK + rank);
  }

  /**
   * Generate query variations using the LLM
   * @param {string} query - The original query.
   * @param {any} generator - The LLM generator instance.
   * @returns {Promise<string[]>} The generated query variations.
   */
  private async generateQueryVariations(query: string, generator: any): Promise<string[]> {
    const prompt = `Generate 3 alternative versions of this search query, exploring different aspects. Original query: "${query}"
    Format: Return only the queries, one per line, no numbering or prefixes.`;

    const messages = [
      { role: 'system', content: 'You are a helpful search query expansion assistant.' },
      { role: 'user', content: prompt }
    ];

    const response = await generator.chat.completions.create({
      messages,
      stream: false
    });

    return [
      query, // Include original query
      ...response.choices[0].message.content.split('\n').filter((q: string) => q.trim())
    ];
  }

    /**
   * Combine results from multiple queries using RRF
   * @param {SearchResult[]} results - The results to combine.
   * @returns {SearchResult[]} The combined results.
   */
  fuseResults(results: SearchResult[]): SearchResult[] {
    const resultMap = new Map<string, { result: SearchResult; score: number }>();
    
    results.forEach((result, rank) => {
      const key = `${result.page_id}`;
      if (!resultMap.has(key)) {
        resultMap.set(key, {
          result,
          score: this.rrf(rank)
        });
      } else {
        // Accumulate RRF scores for duplicate results
        resultMap.get(key)!.score += this.rrf(rank);
      }
    });

    return Array.from(resultMap.values())
      .sort((a, b) => b.score - a.score)
      .map(({ result, score }) => ({
        ...result,
        score
      }));
  }
} 