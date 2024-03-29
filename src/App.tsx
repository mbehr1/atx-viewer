import { useState, useCallback, useEffect, useRef, useMemo } from 'react'

import { Chart as ChartJS, ArcElement, BarController, Title, Tooltip, Legend, registerables } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { fromEvent } from 'file-selector'

ChartJS.register(ArcElement, BarController, Tooltip, Legend, Title, ChartDataLabels, ...registerables) // todo optimize/get rid of registerables

import { ThemeProvider, createTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import './App.css'
import { XMLParser } from 'fast-xml-parser'
import { AtxCompareView } from './AtxCompareView'
import { AtxExecOverview } from './AtxExecOverview'
import { AtxTCsList } from './AtxTCsList'
import Dropzone, { FileRejection } from 'react-dropzone'
import { AtxTestCase, AtxTestReport, atxReportParse, getReportTestName } from './atxReportParser'
import * as zipjs from '@zip.js/zip.js'
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip as MuiTooltip,
  Typography,
  alpha,
  styled,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import AddIcon from '@mui/icons-material/Add'
import DifferenceIcon from '@mui/icons-material/Difference'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import { AtxStatsBarChart } from './AtxStatsBarChart'
import { SelectReferenceForm } from './SelectReferenceForm'
import { addReferenceReport, db } from './db'
import { useLiveQuery } from 'dexie-react-hooks'

type JSONValue = string | number | boolean | { [x: string]: JSONValue } | Array<JSONValue>
export type JSONObject = { [x: string]: JSONValue }

const isSameFile = (a: File, b: File): boolean => {
  return a.name === b.name && a.type === b.type && a.lastModified === b.lastModified
}

const includesFile = (a: File[], b: File): boolean => {
  return a.find((f) => isSameFile(f, b)) !== undefined
}

const useLocalStorage = <T,>(storageKey: string, initialState: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [value, setVal] = useState<T>(() => {
    const storedItem = window.localStorage.getItem(storageKey)
    if (storedItem !== null) {
      return JSON.parse(storedItem) as T
    } else {
      return initialState
    }
  })

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(value))
  }, [value, storageKey])

  return [value, setVal]
}

function App() {
  const [referenceIdToCompare, setReferenceIdToCompare] = useLocalStorage<number>('referenceIdToCompare', 0) // the db.Reference.id to compare with (seems like 0 is not used...)
  const [files, setFiles] = useState<File[]>([])
  const [testReports, setTestReports] = useState<AtxTestReport[]>([])
  const [showDetailTCs, setShowDetailTCs] = useState<AtxTestCase[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  const referenceReportsToCompare = useLiveQuery(async () => {
    const references = await db.references.get(referenceIdToCompare)
    const reports: AtxTestReport[] = []
    if (references) {
      for (const rid of references.reportIds) {
        const report = await db.reports.get(rid)
        if (report) {
          reports.push(report.report)
        } else {
          console.warn(`referenceReportsToCompare: report with rid=${rid} not found!`)
        }
      }
      return reports
    }
    return undefined
  }, [referenceIdToCompare])

  const compareViewRef = useRef<HTMLDivElement>(null) // todo works only on 2nd click...

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    let didSetFiles = false
    setLoading(true)
    try {
      //const length = event.dataTransfer.files.length;
      console.log(`onDrop acceptedFile length=${acceptedFiles.length} rejectedFiles: ${rejectedFiles.length}`)
      const posXmlFiles = acceptedFiles.filter((f) => {
        const lowName = f.name.toLowerCase()
        return lowName.endsWith('.xml') || lowName.endsWith('.atxml')
      })
      // we do only check for zip files if no xml file was dropped already
      const zipFiles =
        posXmlFiles.length === 0
          ? acceptedFiles.filter((f) => {
              const lowName = f.name.toLowerCase()
              return lowName.endsWith('.zip') || lowName.endsWith('.7z')
            })
          : []
      for (const file of zipFiles) {
        console.log(` dropped zip file:${file.name} ${file.type} size=${file.size}`, file)
        const zipReader = new zipjs.ZipReader(new zipjs.BlobReader(file))
        const zipFileEntries = await zipReader.getEntries({ filenameEncoding: 'utf-8' })
        console.log(` dropped zip file:${file.name} has ${zipFileEntries.length} zipjs entries.`)
        const xmlFilesFromZip = zipFileEntries.filter((e) => {
          const lowName = e.filename.toLowerCase()
          return lowName.endsWith('.xml') || lowName.endsWith('.atxml')
        })
        console.log(` dropped zip file:${file.name} has ${xmlFilesFromZip.length} xml entries`)
        // unzip those:
        const xmlFilesFromZipAsFiles: File[] = []
        for (const fi of xmlFilesFromZip) {
          if (fi.getData) {
            const bits = await fi.getData(new zipjs.BlobWriter())
            xmlFilesFromZipAsFiles.push(new File([bits], fi.filename, { type: 'text/xml', lastModified: fi.lastModDate.valueOf() }))
          }
        }
        console.log(` dropped zip file:${file.name} extracted ${xmlFilesFromZipAsFiles.length} xml entries`, xmlFilesFromZipAsFiles)
        setFiles((d) => {
          const nonDuplFiles = xmlFilesFromZipAsFiles.filter((f) => !includesFile(d, f))
          return d.concat(nonDuplFiles)
        })
        didSetFiles = true
      }
      if (posXmlFiles.length > 0) {
        setFiles((d) => {
          const nonDuplFiles = posXmlFiles.filter((f) => !includesFile(d, f))
          return d.concat(nonDuplFiles)
        })
        didSetFiles = true
      }
    } catch (err) {
      console.error(`onDrop got err=${err}`)
    }
    if (!didSetFiles) {
      setLoading(false)
    }
  }, [])

  // load/open the files as json
  useEffect(() => {
    const parser = new XMLParser({ preserveOrder: true })
    Promise.all(
      files.map((file) => {
        const text = file.text()
        return text
      }),
    )
      .then((fileTexts) =>
        fileTexts.map((fileContent) => {
          // todo optimize by not parsing again existing files.
          try {
            const jsonDoc = parser.parse(fileContent) // now only arrays
            // try to parse with as AtxTestReport:
            const reports = atxReportParse(jsonDoc)
            return reports
          } catch (e) {
            console.log(`parser.parse failed with: '${e}'`)
          }
          setLoading(false)
          return []
        }),
      )
      .then((reports) => reports.filter((r) => r !== undefined && r.length > 0))
      .then((reports) => reports.flat())
      .then((reports) => {
        // sort by date
        reports.sort((a, b) => {
          const datA = a && a.date ? a.date.valueOf() : undefined
          const datB = b && b.date ? b.date.valueOf() : undefined
          if (datA === datB) {
            return 0
          }
          if (datA === undefined) {
            return -1
          }
          if (datB === undefined) {
            return 1
          }
          if (datA < datB) return -1
          return 1
        })
        return reports
      })
      .then((reports) => {
        setLoading(false)
        if (reports) setTestReports(reports)
      })
  }, [files, setTestReports])

  const execOverviewTotal = (
    <div className='testSummaryContainer' key={'AtxExecOverview#Total'}>
      <div className='testSummaryItem'></div>
      <div className='testSummaryItem'>
        {<AtxExecOverview key={'ExecOverview'} onDetails={(tcs) => setShowDetailTCs(tcs)} reports={testReports} />}
      </div>
      <div className='testSummaryItem' style={{ display: 'flex' }}>
        {<AtxStatsBarChart key={'StatsBarChart'} reports={testReports} />}
      </div>
    </div>
  )
  const execOverviews = testReports.map((report, idx) => (
    <AtxExecOverview key={'AtxExecOverview#' + idx} reports={[report]} onDetails={(tcs) => setShowDetailTCs(tcs)} />
  ))
  const compareView =
    referenceReportsToCompare && referenceReportsToCompare.length > 0 ? (
      <AtxCompareView scrollToRef={compareViewRef} a={referenceReportsToCompare} b={testReports} />
    ) : undefined

  const Drop = styled('div')(({ theme }) => ({
    position: 'relative',
    borderRadius: theme.shape.borderRadius,
    backgroundColor: alpha(theme.palette.common.white, 0.15),
    '&:hover': {
      backgroundColor: alpha(theme.palette.common.white, 0.25),
    },
    marginRight: theme.spacing(2),
    marginLeft: 0,
    width: '100%',
    [theme.breakpoints.up('sm')]: {
      marginLeft: theme.spacing(3),
      width: 'auto',
    },
  }))

  const [compareMenuAnchorEl, setCompareMenuAnchorEl] = useState<null | HTMLElement>(null)
  const handleCompareMenu = (event: React.MouseEvent<HTMLElement>) => {
    setCompareMenuAnchorEl(event.currentTarget)
  }
  const handleCompareMenuClose = () => {
    setCompareMenuAnchorEl(null)
  }

  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)')

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: prefersDarkMode ? 'dark' : 'light',
        },
      }),
    [prefersDarkMode],
  )

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position='static' color='primary'>
          <Toolbar>
            <IconButton size='large' edge='start' color='inherit' aria-label='open drawer' sx={{ mr: 2 }}>
              <MenuIcon />
            </IconButton>
            <Typography variant='h6' component='div' sx={{ display: { xs: 'none', sm: 'block' } }}>
              ATX viewer
            </Typography>
            <Drop>
              <Dropzone onDrop={onDrop} getFilesFromEvent={fromEvent}>
                {({ getRootProps, getInputProps }) => (
                  <section>
                    <div {...getRootProps({ className: 'dropZone' })}>
                      {false && (
                        <IconButton size='large' edge='start' color='inherit' aria-label='add files' sx={{ mr: 2 }}>
                          <AddIcon />
                        </IconButton>
                      )}
                      <input {...getInputProps()} />
                      <p>Drag 'n' drop files here, or click to select files</p>
                    </div>
                  </section>
                )}
              </Dropzone>
            </Drop>
            <IconButton
              aria-label='clear reports'
              size='large'
              color='inherit'
              disabled={!(files.length > 0 || testReports.length > 0)}
              onClick={() => {
                setFiles([])
                setTestReports([])
                setReferenceIdToCompare(0)
              }}
            >
              <MuiTooltip title='Clear reports'>
                <DeleteForeverIcon />
              </MuiTooltip>
            </IconButton>
            <div>
              <IconButton size='large' aria-controls='menu-compare' aria-haspopup='true' onClick={handleCompareMenu} color='inherit'>
                <MuiTooltip title='Compare report'>
                  <DifferenceIcon />
                </MuiTooltip>
              </IconButton>
              <Menu
                id='menu-compare'
                anchorEl={compareMenuAnchorEl}
                keepMounted
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                open={!!compareMenuAnchorEl}
                onClose={handleCompareMenuClose}
              >
                {testReports.length > 0 && [
                  // todo and not part of references...
                  <MenuItem
                    key={'menuitem_addref'}
                    onClick={() => {
                      addReferenceReport(`Reference from ${new Date().toLocaleDateString()}`, testReports)
                      handleCompareMenuClose()
                    }}
                  >
                    Add current report as reference...
                  </MenuItem>,
                  <Divider key={'menuitem_divider1'} />,
                ]}
                <MenuItem key={'menuitem_references'}>
                  <SelectReferenceForm
                    referenceId={referenceIdToCompare}
                    onSetRef={(v) => {
                      handleCompareMenuClose()
                      setReferenceIdToCompare(v ? v : 0)
                      if (compareViewRef && compareViewRef.current) {
                        compareViewRef.current.scrollIntoView()
                      }
                    }}
                  />
                </MenuItem>
              </Menu>
            </div>
            <div>
              <IconButton disabled={true || testReports.length === 0} size='large' color='inherit'>
                <MuiTooltip title='Filter test cases...'>
                  <FilterAltIcon />
                </MuiTooltip>
              </IconButton>
            </div>
          </Toolbar>
        </AppBar>
      </Box>
      {loading && (
        <>
          <div id='progress' className='indeterminateProgressBar'>
            <div className='indeterminateProgressBarProgress' />
          </div>
        </>
      )}
      <div className='card'>
        {testReports.length === 0 && compareView === undefined && <p>Open a asam atx test report file...</p>}
        {testReports.length > 0 && execOverviewTotal}
        {testReports.length > 1 && <div className='testSingleContainer'>{execOverviews}</div>}
      </div>
      {showDetailTCs.length > 0 && (
        <div className='card'>
          <AtxTCsList tcs={showDetailTCs} />
        </div>
      )}
      {compareView !== undefined && compareView}
      {(false && files.length > 0 && files.map((f: File) => (typeof f.name === 'string' ? f.name : '')).join(',')) || ''}
      {testReports.length > 0 && (
        <div style={{ textAlign: 'left' }}>
          Loaded test reports:
          <ol>
            {testReports.map((a, idx) => (
              <li key={'' + idx}>
                {a.shortName}:{getReportTestName(a)}
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className='gitSha'>
        build from{' '}
        <a href='https://github.com/mbehr1/atx-viewer' target='_blank'>
          github/mbehr1/atx-viewer
        </a>{' '}
        commit #{__COMMIT_HASH__}
      </div>
    </ThemeProvider>
  )
}

export default App
