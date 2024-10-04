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
    if (this.instance === null) {
      this.instance = await CreateMLCEngine(this.model, {
        initProgressCallback: progress_callback,
      });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  console.log('Worker received message:', event.data);
  console.log('Worker type:', event.data.type);
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
      for (const chunk of data.chunks) {
        let result = await classifier(chunk, {
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
        embedding,
      });
      const t1 = performance.now();
      console.log(`Search completed in ${((t1 - t0) / 1000).toFixed(2)} seconds`);
      break;
    }
    case 'generate_text': {
      const t0 = performance.now();
      console.log('Text generation data:', data);
      let generator = await TextGenerationSingleton.getInstance((x) => {
        self.postMessage(x);
      });
      const messages = [
        { role: 'system', content: 'You are a helpful AI assistant.' },
        { role: 'user', content: data.query },
        { role: 'user', content: data.context },
      ];
      let output = await generator.chat.completions.create({
        messages,
      });

      self.postMessage({
        status: 'text_generation_complete',
        output: output.choices[0].message,
      });
      const t1 = performance.now();
      console.log(`Text generation completed in ${((t1 - t0) / 1000).toFixed(2)} seconds`);
      break;
    }
  }
});