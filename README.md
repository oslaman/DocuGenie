
# DocuGenie

DocuGenie is a RAG-based AI app to answer document related questions. It uses PGLite to store the documents and embeddings and a local LLM with Transformers.js and WebLLM to answer the questions.

## Features

- Local document embedding and retrieval
- LLM-powered question answering
- Rule-based engine for document processing

## Tech Stack

**Client:** React, TypeScript, Vite, Shadcn/UI, TailwindCSS

**Database:** PGLite

**Machine Learning:** Transformers.js, WebLLM

## Run Locally

Clone the project

```bash
  git clone https://github.com/oslaman/DocuGenie.git
```

Go to the project directory

```bash
  cd DocuGenie
```

Install dependencies

```bash
  npm install
```

Start the server

```bash
  npm run dev
```

## Authors

- [@oslaman](https://www.github.com/oslaman)

## Acknowledgements

- [Transformers.js](https://github.com/huggingface/transformers.js)
- [WebLLM](https://github.com/mlc-ai/web-llm)
- [PGLite](https://github.com/electric-sql/pglite)
- [Shadcn/UI](https://ui.shadcn.com/)

## License

[MIT](https://github.com/oslaman/DocuGenie/blob/mpa/LICENSE)
