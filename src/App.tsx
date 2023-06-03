import { useState, useCallback, useEffect } from 'react'

import { Chart as ChartJS, ArcElement, Title, Tooltip, Legend } from 'chart.js'
import { fromEvent } from 'file-selector';

ChartJS.register(ArcElement, Tooltip, Legend, Title);

// import * as d3 from 'd3'

// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import './App.css'
import { XMLParser } from 'fast-xml-parser'
import { AtxExecOverview } from './AtxExecOverview';
import Dropzone, { FileRejection } from 'react-dropzone';
import { AtxTestReport, atxReportParse, getReportTestName } from './atxReportParser';

type JSONValue = | string | number | boolean | { [x: string]: JSONValue } | Array<JSONValue>;
export type JSONObject = { [x: string]: JSONValue };

const isSameFile = (a: File, b: File): boolean => {
  return a.name === b.name && a.type === b.type && a.lastModified === b.lastModified;
}

const includesFile = (a: File[], b: File): boolean => {
  return a.find(f => isSameFile(f, b)) !== undefined
}

function App() {
  const [files, setFiles] = useState<File[]>([])
  const [testReports, setTestReports] = useState<AtxTestReport[]>([])

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: FileRejection[],) => {
    try {
      //const length = event.dataTransfer.files.length;
      console.log(`onDrop acceptedFile length=${acceptedFiles.length} rejectedFiles: ${rejectedFiles.length}`);
      const posXmlFiles = acceptedFiles.filter((f) => { const lowName = f.name.toLowerCase(); return lowName.endsWith('.xml') || lowName.endsWith('.atxml') })
      //for (const file of posXmlFiles) {
      //console.log(` dropped file:${file.name} ${file.type}`, file);
      //}
      setFiles(d => {
        const nonDuplFiles = posXmlFiles.filter(f => !includesFile(d, f));
        return d.concat(nonDuplFiles)
      });
    } catch (err) {
      console.error(`onDrop got err=${err}`);
    }
  }, [])

  // load/open the files as json
  useEffect(() => {
    const parser = new XMLParser({ preserveOrder: true });
    Promise.all(files.map(file => {
      const text = file.text();
      return text
    })).then(fileTexts => fileTexts.map(fileContent => {
      // todo optimize by not parsing again existing files.
      try {
        const jsonDoc = parser.parse(fileContent); // now only arrays
        // try to parse with as AtxTestReport:
        const reports = atxReportParse(jsonDoc)
        return reports
      } catch (e) {
        console.log(`parser.parse failed with: '${e}'`)
    }
      return [];
    }))
      .then(reports => reports.filter(r => r !== undefined && r.length > 0))
      .then(reports => reports.flat())
      .then(reports => { // sort by date
        reports.sort((a, b) => {
          const datA = a && a.date ? a.date.valueOf() : undefined;
          const datB = b && b.date ? b.date.valueOf() : undefined;
          if (datA === datB) { return 0 }
          if (datA === undefined) { return -1 }
          if (datB === undefined) { return 1 }
          if (datA < datB) return -1
          return 1
        })
        return reports
      })
      .then(reports => { if (reports) setTestReports(reports) })
  }, [files])

  const execOverviewTotal = <div className='testSummaryContainer' key={'AtxExecOverview#Total'}><div className='testSummaryItem' ></div><div className='testSummaryItem'>{<AtxExecOverview reports={testReports} />}</div> <div className='testSummaryItem'></div></div>;
  const execOverviews = testReports.map((report, idx) => <AtxExecOverview key={'AtxExecOverview#' + idx} reports={[report]} />);

  return (
    <>
      <h1>ATX viewer{!window.isSecureContext ? ' !no secure context!' : ''}</h1>
      <Dropzone onDrop={onDrop} getFilesFromEvent={fromEvent}>
        {({ getRootProps, getInputProps }) => (
          <section>
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              <p>Drag 'n' drop files here, or click to select files</p>
            </div>
          </section>
        )}
      </Dropzone>
      <div className="card">
        {files.length === 0 && <p>
          Open a asam atx test report file...
        </p>}
        {testReports.length > 0 && execOverviewTotal}
        {testReports.length > 1 &&
          (<div className='testSingleContainer'>
            {execOverviews}
          </div>)}
      </div>
      {false && files.length > 0 &&
        files.map((f: File) => (typeof f.name === 'string' ? f.name : '')).join(',') || ''}
      {testReports.length > 0 && <ol>
        {testReports.map((a, idx) => <li key={'' + idx} >{a.shortName}:{getReportTestName(a)}</li>)}
      </ol>}
    </>
  )
}

export default App
