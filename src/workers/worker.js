import { pipeline } from '@huggingface/transformers'
import { CreateMLCEngine } from '@mlc-ai/web-llm';

class PipelineSingleton {
  static task = 'feature-extraction';
  static model = 'Supabase/gte-small';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = pipeline(this.task, this.model, {
        progress_callback,
        dtype: 'fp32',
        device: navigator.gpu ? 'webgpu' : 'wasm',
      });
    }
    return this.instance;
  }
}

class TextGenerationSingleton {
  static model = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (!navigator.gpu) {
      throw new Error('GPU not supported');
    }
    if (this.instance === null) {
      this.instance = await CreateMLCEngine(this.model, {
        initProgressCallback: progress_callback,
      });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  let classifier = await PipelineSingleton.getInstance((x) => {
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
      let output = await classifier(data.query, {
        pooling: 'mean',
        normalize: true,
      });

      const embedding = Array.from(output.data);

      self.postMessage({
        status: 'search_complete',
        query: data.query,
        embedding,
      });
      const t1 = performance.now();
      console.log(`Search completed in ${((t1 - t0) / 1000).toFixed(2)} seconds`);
      break;
    }
    case 'generate_text': {
      const t0 = performance.now();
      let generator = await TextGenerationSingleton.getInstance((x) => {
        self.postMessage(x);
      });
      const system_prompt = "Context information is below.\n\n" +
        "---------------------\n" +
        data.context + "\n" +
        "---------------------\n" +
        "Given the context information and not prior knowledge, answer the query.\n";

      const user_prompt = "Query: " + data.query + "\n Your answer: ";
      const messages = [
        { role: 'system', content: system_prompt },
        { role: 'user', content: user_prompt },
      ];

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
      
      console.log(message);
      self.postMessage({
        status: 'text_generation_complete',
        output: await generator.getMessage(),
        isFinal: true
      });

      const t1 = performance.now();
      console.log(`Text generation completed in ${((t1 - t0) / 1000).toFixed(2)} seconds`);
      break;
    }
  }
});