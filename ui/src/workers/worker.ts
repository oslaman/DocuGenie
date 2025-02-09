/**
 * Worker for the RAG interface. It handles the embedding and text generation.
 * @packageDocumentation
 */
import { pipeline } from '@huggingface/transformers'
import { CreateMLCEngine, InitProgressCallback } from '@mlc-ai/web-llm';


/**
 * Singleton class for the embedding pipeline.
 * @class
 * @property {string} task - The task to use for the pipeline.
 * @property {string} model - The model to use for the pipeline.
 * @property {any} instance - The instance of the pipeline.
 */
class PipelineSingleton {
  static task: string = 'feature-extraction';
  static model: string = 'Supabase/gte-small';
  static instance: any = null;

  static async getInstance(progress_callback: ((progress: any) => void) | null = null) {
    if (this.instance === null) {
      this.instance = pipeline(this.task as any, this.model, {
        progress_callback: progress_callback as Function | undefined,
        dtype: 'fp32',
        device: 'gpu' in navigator ? 'webgpu' : 'wasm',
      });
    }
    return this.instance;
  }
}

/**
 * Singleton class for the text generation pipeline.
 * @class
 * @property {string} model - The model to use for the text generation.
 * @property {any} instance - The instance of the text generation.
 */
class TextGenerationSingleton {
  static model: string = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';
  static instance: any = null;

  static async getInstance(progress_callback: ((progress: any) => void) | null = null) {
    if (!('gpu' in navigator)) {
      throw new Error('GPU not supported');
    }
    if (this.instance === null) {
      this.instance = await CreateMLCEngine(this.model, {
        initProgressCallback: progress_callback as InitProgressCallback | undefined,
      });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  let classifier: any = await PipelineSingleton.getInstance((x: any) => {
    self.postMessage(x);
  });

  switch (type) {
    case 'process_chunks': {
      const t0 = performance.now();
      if (!data.chunks || !Array.isArray(data.chunks)) {
        self.postMessage({ error: 'Chunks may not be null or undefined and must be an array' });
        return;
      }
      let output = [];
      console.log('Processing chunks:', data.chunks[0].text);
      for (const chunk of data.chunks) {
        let result = await classifier(chunk.text, {
          pooling: 'mean',
          normalize: true,
        });
        let resultArray = Array.from(result.data);
        output.push({ content: chunk, embedding: resultArray });
      }
      self.postMessage({ status: 'embedding_complete', output });
      const t1 = performance.now();
      console.log(`Embedding completed in ${((t1 - t0) / 1000).toFixed(2)} seconds`);
      break;
    }

    case 'search': {
      const t0 = performance.now();

      if (data.page) {
        self.postMessage({
          status: 'search_complete',
          query: data.query,
          prompt: data.prompt,
          page: data.page
        });
      } else {
        let output = await classifier(data.query, {
          pooling: 'mean',
          normalize: true,
        });

        const embedding = Array.from(output.data);
        self.postMessage({
          status: 'search_complete',
          query: data.query,
          embedding,
          prompt: data.prompt,
          page: data.page
        });
      }

      const t1 = performance.now();
      console.log(`Search completed in ${((t1 - t0) / 1000).toFixed(2)} seconds`);
      break;
    }
    case 'generate_text': {
      const t0 = performance.now();
      let generator = await TextGenerationSingleton.getInstance((x) => {
        self.postMessage(x);
      });

      const prompt = data.prompt || "Based on the context, answer the following question.";

      const system_prompt = "Context information is below. The pages are context and the pages are in order respectively, so you can use them to answer the question. Mention the page number in your answer.\n\n" +
        "---------------------\n" +
        data.context + "\n" +
        "---------------------\n" +
        prompt;


      const user_prompt = "Query: " + data.query + "\n Your answer: ";
      const messages = [
        { role: 'system', content: system_prompt },
        { role: 'user', content: user_prompt },
      ];

      console.log(messages);

      const request = {
        stream: true,
        stream_options: { insclude_usage: true },
        messages,
        logprobs: true,
        top_logprobs: 2,
      }

      const asyncChunkGenerator = await generator.chat.completions.create(request);
      let message = "";
      for await (const chunk of asyncChunkGenerator) {
        message += chunk.choices[0]?.delta?.content || "";
        if (chunk.usage) {
          console.log(chunk.usage);
        }
        self.postMessage({
          status: 'text_generation_complete',
          output: message,
          isFinal: false
        });
      }
      self.postMessage({
        status: 'text_generation_complete',
        output: await generator.getMessage(),
        isFinal: true
      });

      const t1 = performance.now();
      console.log(`Text generation completed in ${((t1 - t0) / 1000).toFixed(2)} seconds`);
      break;
    }
    case 'search_with_page': {
      console.log('Search with page:', data.page);
      self.postMessage({
        status: 'search_with_pages_complete',
        query: data.query,
        page: data.page,
      });
      break;
    }
    case 'search_with_prompt': {
      console.log('Search with prompt:', data.prompt);
      break;
    }
    case 'search_basic': {
      console.log('Search basic:', data.query);
      break;
    }
  }
});