import { useState, useRef, useEffect, useCallback } from 'react'
import { getDB, initSchema, countRows, seedDb, search } from './utils/db'


import './App.css'

function App() {
  const [searchInput, setSearchInput] = useState('');
  const [answerResult, setAnswerResult] = useState(null);
  const [fileDetails, setFileDetails] = useState({ author: '', title: '', pages: 0 });
  const initailizing = useRef(false);

  const worker = useRef(null);
  const db = useRef(null);
  
  useEffect(() => {
    const setup = async () => {
      initailizing.current = true;
      db.current = await getDB();
      await initSchema(db.current);
      let count = await countRows(db.current, "embeddings");
      console.log(`Found ${count} rows`);
    };
    if (!db.current && !initailizing.current) {
      setup();
    }
  }, []);

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(new URL("./worker.js", import.meta.url), {
        type: "module",
      });
    }

    const onMessageReceived = async (e) => {
      switch (e.data.status) {
        case "initiate":
          break;
        case "ready":
          break;
        case "search_complete":
          {
            console.log(e.data);
            const searchResults = await search(db.current, e.data.embedding);
            let system_prompt = "You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. If you don't know the answer, say that you don't know. Use three sentences maximum and keep the answer concise. \n\n" + searchInput
            worker.current.postMessage({
              type: 'qa',
              data: {
                query: system_prompt,
                context: searchResults[0].content,
              },
            });
            break;
          }
        case "embedding_complete": {
          const result = e.data.output;
          console.log(result);
          await seedDb(db.current, result);
          break;
        }
        case "qa_complete": {
          setAnswerResult(e.data.output);
          break;
        }
      }
    };

    worker.current.addEventListener("message", onMessageReceived);

    return () =>
      worker.current.removeEventListener("message", onMessageReceived);
  });

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      const json = JSON.parse(e.target.result);
      const chunks = json.pages.flatMap(page => page.content);
      setFileDetails({
        author: json.author,
        title: json.title,
        pages: json.pages.length,
      });
      worker.current.postMessage({
        type: 'process_chunks',
        data: { chunks },
      });
    };
    reader.readAsText(file);
  };

  const classify = useCallback((text) => {
    if (worker.current) {
      worker.current.postMessage({ type: "search", data: { query: text } });
    }
  }, []);

  return (
    <>
      <input type="file" onChange={handleFileUpload} /><br />
      {fileDetails.title && (
        <div>
          <p><strong>Author:</strong> {fileDetails.author}</p>
          <p><strong>Title:</strong> {fileDetails.title}</p>
          <p><strong>Number of Pages:</strong> {fileDetails.pages}</p>
        </div>
      )}
      {/* {ready !== null && (
        <>
          <p className="text-center">Embeddings: </p>
          <pre>{content.join("\n")}</pre>
          <pre>
            {!ready || !embedResult ? "Loading..." : JSON.stringify(embedResult)}
          </pre>
        </>
      )} */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          classify(searchInput);
        }}
      >
        <textarea
          placeholder="Search here"
          onInput={(e) => {
            setSearchInput(e.target.value);
          }}
        ></textarea><br></br>
        <button type="submit">Submit</button>
      </form>
      <h2>Answer</h2>
      <pre>
        {JSON.stringify(answerResult)}
      </pre>
    </>
  )
}

export default App
