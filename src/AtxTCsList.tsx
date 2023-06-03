import { useMemo, useState } from "react"
import { AtxTestCase, AtxTestStepFolder, mapVerdictToColor, getVerdictForFolder } from "./atxReportParser"

import './AtxTCsList.css'


interface AtxTCsListProps {
    tcs: AtxTestCase[]
}
export const AtxTCsList = (props: AtxTCsListProps) => {
    return <div>{props.tcs.map((tc, idx, arr) => (<TCNode expandSteps={arr.length === 1} tc={tc} key={tc.shortName + idx.toString()} />))}</div>
}

interface TCNodeProps {
    tc: AtxTestCase,
    expandSteps: boolean,
}

const TCNode = (props: TCNodeProps) => {
    const { tc } = props
    const [showSteps, setShowSteps] = useState(props.expandSteps)
    const borderColor = useMemo(() => mapVerdictToColor(tc.verdict), [tc.verdict])

    return (<div onClick={(e) => { if (tc.steps.length > 0) { setShowSteps(v => !v); } e.preventDefault(); e.stopPropagation() }} className="tc" style={{ borderLeft: `1px solid ${borderColor}` }}>
        <div>{`${tc.longName || tc.shortName}${tc.executionTimeInSec !== undefined ? `, duration ${tc.executionTimeInSec}s` : ''}`}</div>
        <ul style={{ paddingLeft: "10px", borderLeft: `1px solid ${borderColor}` }}>
            {showSteps && tc.steps.map((step, idx) => (<TestStepFolder folder={step} key={step.shortName + idx.toString()} />))}
        </ul>
    </div>)
}

interface TestStepFolderProps {
    folder: AtxTestStepFolder
}
const TestStepFolder = (props: TestStepFolderProps) => {
    const { folder } = props
    const borderColor = useMemo(() => mapVerdictToColor(getVerdictForFolder(folder)), [folder])
    const [showSteps, setShowSteps] = useState(folder.steps.length === 0 || !['green', 'white', 'grey'].includes(borderColor))

    return (<div onClick={(e) => { if (folder.steps.length > 0) { setShowSteps(v => !v); } e.preventDefault(); e.stopPropagation() }} className="tcf" style={{ borderLeft: `1px solid ${borderColor}` }}>
        <div>{`${folder.verdict ? folder.verdict + ': ' : ''}${folder.longName || folder.shortName}${showSteps ? '' : `, steps ${folder.steps.length}`}`}</div>
        {showSteps && folder.steps.length > 0 && <ul>
            {folder.steps.map((step, idx) => (<TestStepFolder folder={step} key={step.shortName + idx.toString()} />))}
        </ul>}
    </div>)
}