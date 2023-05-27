import { useState, useRef, useCallback } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [files, setFiles] = useState<File[]>([]);
  const inputFile = useRef(null);

  const onFileChange = useCallback((ev: React.ChangeEvent<HTMLInputElement>) => {
    console.log(`onFileChange()...`, ev);
    if (ev.target.files && ev.target.files.length > 0) { // weirdly no array but obj with .length ...
      const files = ev.target.files;
      console.log(`onFileChange() got ${files.length} files`, files);
      for (const file of files) {
        console.log(`File='${file.name}' with size=${file.size} ${file.type}`);
        setFiles(d => [...d, file]);
      }
    } else {
      console.error(`onFileChange()... got no files!`, ev);
    }
  }, []);

  return (
    <>
      <h1>ATX viewer</h1>
      <input type='file' id='inputFile' ref={inputFile} onChange={onFileChange} />
      <div className="card">
        {files.length === 0 && <p>
          Open a asam atx test report file...
        </p>}
        {files.length > 0 && <ol>
          {files.map((f, idx) => <li key={'' + idx + f.name} >{f.name}</li>)}
        </ol>}
      </div>
    </>
  )
}

export default App
