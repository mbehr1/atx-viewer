/**
 * todo
 * [ ] check layout for desc for test step/folder and add folding
 */

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
    const [showDesc, setShowDesc] = useState(showSteps)
    const borderColor = useMemo(() => mapVerdictToColor(tc.verdict), [tc.verdict])

    const descHasMultiLines = useMemo(() => tc.desc && tc.desc.split('\n').length > 1, [tc.desc])
    const descFirstLine = useMemo(() => {
        const firstLine = tc.desc?.split('\n')[0] || '';
        return firstLine.length > 120 ? firstLine.slice(0, 95) + '... <click to show more>' : firstLine
    }, [tc.desc])
    const tcName = useMemo(() => { return tc.longName || tc.shortName }, [tc])
    const tcNameAbbrev = useMemo(() => tcName.length > 100 ? tcName.slice(0, 97) + '...' : tcName, [tcName])

    return (
        <div className="tc" style={{ borderLeft: `1px solid ${borderColor}` }}>
            <div onClick={(e) => {
                if (tc.steps.length > 0) { setShowSteps(v => !v); }
                e.preventDefault()
                e.stopPropagation()
            }} title={(tcName.length !== tcNameAbbrev.length) ? tcName : undefined}>{`${tcNameAbbrev}${tc.executionTimeInSec !== undefined ? `, duration ${tc.executionTimeInSec}s` : ''}${tc.date !== undefined ? ` at ${tc.date.toLocaleString()}` : ''}`}</div>
            {tc.originRef && showSteps && <div>{tc.originRef}</div>}
        {tc.desc && showSteps && (showDesc || !descHasMultiLines) && <pre onClick={(e) => { setShowDesc(v => !v); e.preventDefault(); e.stopPropagation() }} className="tcDesc">{tc.desc}</pre>}
        {tc.desc && showSteps && !(showDesc || !descHasMultiLines) && <pre onClick={(e) => { setShowDesc(v => !v); e.preventDefault(); e.stopPropagation() }} className="tcDesc">{descFirstLine}</pre>}
        <ul style={{ paddingLeft: "10px", borderLeft: `1px solid ${borderColor}` }}>
            {showSteps && tc.steps.map((step, idx) => (<TestStepFolder folder={step} key={step.shortName + idx.toString()} />))}
        </ul>
            {showSteps && tc.testArguments?.length > 0 &&
                <table className="tcArgs" >
                    <thead>
                        <tr><th>Argument Type</th><th>Dir</th><th>Description</th><th>Value</th></tr>
                    </thead>
                    <tbody>
                        {tc.testArguments.map((testArg, idx) =>
                        (<tr key={'ta_' + idx.toString()} >
                            <td>{testArg.argType || ''}</td><td>{testArg.direction || ''}</td><td>{testArg.desc || ''}</td>
                            <td title={testArg.value}>{testArg.value.length > 120 ? '...' + testArg.value.slice(-120) : testArg.value}</td>
                        </tr>)
                        )}
                    </tbody>
                </table>}
    </div>)
}

interface TestStepFolderProps {
    folder: AtxTestStepFolder
}
const TestStepFolder = (props: TestStepFolderProps) => {
    const { folder } = props
    const tsName = useMemo(() => { return folder.longName || folder.shortName }, [folder])
    const tsNameAbbrev = useMemo(() => tsName.length > 100 ? tsName.slice(0, 97) + '...' : tsName, [tsName])
    const borderColor = useMemo(() => mapVerdictToColor(getVerdictForFolder(folder)), [folder])
    const [showSteps, setShowSteps] = useState(folder.steps.length === 0 || !['green', 'white', 'grey'].includes(borderColor))

    return (<div
        onClick={(e) => {
            if (folder.steps.length > 0) {
                setShowSteps(v => !v);
            }
            e.preventDefault();
            e.stopPropagation()
        }}
        className="tcf" style={{ borderLeft: `1px solid ${borderColor}` }}>
        <div>
            <span title={(tsName.length !== tsNameAbbrev.length) ? tsName : undefined}>{`${folder.verdict ? folder.verdict + ': ' : ''}${tsNameAbbrev}${showSteps ? '' : `, steps ${folder.steps.length}`}`}</span>
            {folder.expectedResult && <pre className="tcExpectedResult" >{folder.expectedResult}</pre>}
        </div>
        {showSteps && folder.desc && <pre className="tcDesc">{folder.desc}</pre>}
        {showSteps && folder.steps.length > 0 && <ul>
            {folder.steps.map((step, idx) => (<TestStepFolder folder={step} key={step.shortName + idx.toString()} />))}
        </ul>}
    </div>)
}