import { useState, useRef, useEffect, useCallback } from 'react'
import { getDB, initSchema, countRows, seedDb, search } from './utils/db'

import './App.css'

function App() {
  const [searchInput, setSearchInput] = useState('');
  const [dbRows, setDbRows] = useState(0);
  const [documentContext, setDocumentContext] = useState('');
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
      setDbRows(count);
      console.log(`Found ${count} rows`);
    };
    if (!db.current && !initailizing.current) {
      setup();
    }
  }, []);

  useEffect(() => {
    const savedFileDetails = localStorage.getItem('fileDetails');
    if (savedFileDetails) {
      setFileDetails(JSON.parse(savedFileDetails));
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
            const searchResults = await search(db.current, e.data.embedding);
            setDocumentContext(searchResults.map(result => result.content).join('\n'));
            let system_prompt = "Using this information from the context, respond to the following query. Use three sentences or less. Clean your response, so no hashtags or other symbols (like '\n'). \n\n" + searchInput;
            // let system_prompt = "Usando queste informazioni dal contesto, rispondi alla seguente query. Usa tre frasi o meno. Pulisci la tua risposta in modo che non ci siano simboli come '#' o altri simboli non necessari. \n\n" + searchInput;
            worker.current.postMessage({
              type: 'generate_text',
              data: {
                query: system_prompt,
                context: searchResults.map(result => result.content).join('\n'),
              },
            });
            break;
          }
        case "embedding_complete": {
          const result = e.data.output;
          await seedDb(db.current, result);
          let count = await countRows(db.current, "embeddings");
          setDbRows(count);
          break;
        }
        case "text_generation_complete": {
          setAnswerResult(e.data.output['content']);
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
      const { title, author, num_pages } = json.metadata;
      const chunks = json.pages.flatMap(page => page.content);
      const fileDetails = {
        author,
        title,
        pages: num_pages,
      };
      setFileDetails(fileDetails);
      localStorage.setItem('fileDetails', JSON.stringify(fileDetails));
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
      <label htmlFor="file-upload">Carica il file</label>
      <input type="file" id="file-upload" onChange={handleFileUpload} /><br />
      {fileDetails.title && (
        <div>
          <p><strong>Autore:</strong> {fileDetails.author}</p>
          <p><strong>Titolo:</strong> {fileDetails.title}</p>
          <p><strong>Numero di pagine:</strong> {fileDetails.pages}</p>
        </div>
      )}
      <p>Righe nel DB: {dbRows}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setDocumentContext('');
          setAnswerResult(null);
          classify(searchInput);
        }}
      >
        <textarea
          placeholder="Cerca qui"
          onInput={(e) => {
            setSearchInput(e.target.value);
          }}
        ></textarea><br></br>
        <button type="submit">Invia</button>
      </form>
      <h2>Contesto</h2>
      <div className="document-context">
      {documentContext}
    </div>
      <h2>Risposta</h2>
      <div style={{ whiteSpace: 'pre-wrap' }}>
        {answerResult}
      </div>
    </>
  )
}

export default App