import {
    pipeline,
    layer_norm
} from "@xenova/transformers";

const norm_dim = 256;

class EmbedPipeline {
    static task = "feature-extraction";
    static model = "Supabase/gte-small";
    static modelInstance= null;

    static async getInstance(progress_callback = null) {
        if (this.modelInstance !== null) {
            return this.modelInstance;
        }

        this.modelInstance = await pipeline("feature-extraction", this.model, {
            progress_callback,
            quantized: true,
        });

        return this.modelInstance;
    }
}

self.addEventListener("message", async (event) => {
    const data = event.data;

    if (event.data.type === "initiate") {
        await EmbedPipeline.getInstance((progress) => {
          self.postMessage(progress);
        });
        return;
      }
    
      let model = EmbedPipeline.modelInstance;
      if (EmbedPipeline.modelInstance === null) {
        model = await EmbedPipeline.getInstance((progress) => {
          self.postMessage(progress);
        });
      }
    
      if (!model) {
        self.postMessage({ type: "Error", message: "Cannot find Model" });
        return;
      }
    
      let embeddings = null;

      if (Array.isArray(data)) {
        embeddings = await model(data, { pooling: "mean" });
      } else {
        embeddings = await model([data], { pooling: "mean" });
      }
    
      embeddings = layer_norm(embeddings, [embeddings.dims[1]])
        .slice(null, [0, norm_dim])
        .normalize(2, -1);
    
      self.postMessage({
        type: event.data?.type ?? "success",
        message: "Embedding created successfully",
        data: embeddings.tolist(),
        id: event.data.id,
        payload: data,
      });
    
      console.log(embeddings.tolist());
    });