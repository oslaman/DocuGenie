import { pipeline } from '@huggingface/transformers'

class PipelineSingleton {
  static task = 'feature-extraction'
  static model = 'Supabase/gte-small'
  static instance = null

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = pipeline(this.task, this.model, {
        progress_callback,
        dtype: 'fp32',
        device: navigator.gpu ? 'webgpu' : 'wasm',
      })
    }
    return this.instance
  }
}

class QAPipelineSingleton {
  static task = 'question-answering'
  static model = 'Xenova/distilbert-base-cased-distilled-squad'
  static instance = null

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = pipeline(this.task, this.model, {
        progress_callback,
        dtype: 'fp32',
        device: navigator.gpu ? 'webgpu' : 'wasm',
      })
    }
    return this.instance
  }
}


self.addEventListener('message', async (event) => {
  console.log('Worker received message:', event.data);
  console.log('Worker type:', event.data.type);
  const { type, data } = event.data;
  let classifier = await PipelineSingleton.getInstance((x) => {
    self.postMessage(x)
  })

  switch (type) {
    case 'process_chunks': {
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
      break;
    }
    case 'search': {
      let output = await classifier(data.query, {
        pooling: 'mean',
        normalize: true,
      })

      const embedding = Array.from(output.data)

      self.postMessage({
        status: 'search_complete',
        embedding,
      })
      break;
    };
    case 'qa': {
      console.log('QA data:', data);
      let classifier = await QAPipelineSingleton.getInstance((x) => {
        self.postMessage(x)
      })
      let output = await classifier(data.query, data.context)

      self.postMessage({
        status: 'qa_complete',
        output,
      })
      break;
    }
  }
})