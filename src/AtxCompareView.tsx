import { RefObject, useMemo } from "react"
import { AtxTestCase, AtxTestReport, getPlannedTestCases, getTestCases } from "./atxReportParser"
import { atxTCsListChilds } from "./AtxTCsList"

import './AtxCompareView.css'
import { AtxExecOverview } from "./AtxExecOverview"

interface AtxCompareViewProps {
    a: AtxTestReport[],
    b: AtxTestReport[],
    scrollToRef: RefObject<HTMLDivElement>,
}

const getDiff = <T,>(a: T[], b: T[], findIndex: (arr: T[], el: T) => number
): [newInB: T[], common: [T, T][], missingInB: T[]] => {
    const newInB: T[] = [...b]
    const common: [T, T][] = []
    const missingInB: T[] = []

    for (const eA of a) {
        const eBIdx = findIndex(newInB, eA)
        if (eBIdx >= 0) {
            // common in A and B:
            const eB = newInB.splice(eBIdx, 1)[0]
            common.push([eA, eB])
        } else {
            missingInB.push(eA)
        }
    }

    return [newInB, common, missingInB]
}

export const AtxCompareView = (props: AtxCompareViewProps) => {
    console.log(`AtxCompareView Comparison of ${props.a.length} <-> ${props.b.length}`)

    // determine common reports:
    // determine new reports:
    // determine missing reports:

    // match by test plan first:
    const findIndexMatchingTPs = useMemo(() => (arr: AtxTestReport[], rep: AtxTestReport) => {
        if (arr.length < 1) return -1
        const plannedTcs = Array.from(getPlannedTestCases(rep.plan))
        const arrOfNrMatchingTcs = arr.map(a => {
            const plannedTcsA = Array.from(getPlannedTestCases(a.plan))
            const nrMatchingTcs = plannedTcs.reduce((prev, cur) => plannedTcsA.findIndex((v) => v.shortName === cur.shortName) >= 0 ? prev + 1 : prev, 0)
            return nrMatchingTcs
        })
        const maxIdx = arrOfNrMatchingTcs.reduce((iMax, cur, curIdx, arr) => cur > arr[iMax] ? curIdx : iMax, 0)
        const maxVal = arrOfNrMatchingTcs[maxIdx]
        return maxVal > 0 ? maxIdx : -1
    }, [])

    const [tpNewInB, tpCommon, tpMissingInB] = useMemo(() => getDiff(props.a, props.b, (arr, el) => findIndexMatchingTPs(arr, el)), [props.a, props.b, findIndexMatchingTPs])
    // now consider only the common test plans:
    // iterate by test plan (pair):
    const regressedImprovedTPTCs = useMemo(() => {
        return tpCommon.map(tp => {
            const [tpA, tpB] = tp
            const allRegressedTcs: [AtxTestCase, AtxTestCase][] = []
            const allImprovedTcs: [AtxTestCase, AtxTestCase][] = []
            // now get diff for those two plans:
            const tcsA = Array.from(getTestCases(tpA.root))
            const tcsB = getTestCases(tpB.root)

            const commonTCs: [AtxTestCase, AtxTestCase][] = []
            for (const tc of tcsB) {
                const aTC = tcsA.find((aTC) => aTC.originRef && aTC.originRef === tc.originRef && aTC.shortName === tc.shortName)
                if (aTC) {
                    commonTCs.push([aTC, tc])
                }
            }
            const [regressed, improved] = commonTCs.filter(([a, b]) => a.verdict !== b.verdict)
                .reduce((acc, cur, i, arr) => (acc[arr[i][0].verdict === 'PASSED' ? 0 : 1].push(cur), acc), [[], []] as [[AtxTestCase, AtxTestCase][], [AtxTestCase, AtxTestCase][]])
            allRegressedTcs.push(...regressed) // todo optimize (push not needed)
            allImprovedTcs.push(...improved.filter(([a, b]) => b.verdict === 'PASSED'))
            return [allRegressedTcs, allImprovedTcs]
        })
    }, [tpCommon])

    // two columns (left A, right b)

    // overall structure:
    // first the common test plans with a two column view
    // then the missing test plans on left side
    // then the new test plans on right side

    // todo or order by sequence of plans in b?

    return (<>
        <div ref={props.scrollToRef}><h3>{`Comparison of ${props.a.length} <-> ${props.b.length} test plans:`}</h3></div>
        {tpCommon.length > 0 && <div>
            <h4>Comparison of common test plans:</h4>
            {tpCommon.map((tpC, idx) => {
                const [tpA, tpB] = tpC
                const regressedTcs = regressedImprovedTPTCs[idx][0]
                const improvedTcs = regressedImprovedTPTCs[idx][1]
                if (regressedTcs.length === 0 && improvedTcs.length === 0) {
                    return <></>
                }
                const regTcChilds = atxTCsListChilds({ tcs: regressedTcs.flat() })
                const impTcChilds = atxTCsListChilds({ tcs: improvedTcs.flat() })
                return <div key={'ccTpCommon' + idx} className="compareContainer">
                    <div>{tpA.shortName}</div>
                    <div>{tpB.shortName}</div>
                    <div><AtxExecOverview reports={[tpA]} /></div>
                    <div><AtxExecOverview reports={[tpB]} /></div>
                    {regressedTcs.length > 0 && [<h5>Passing TCs in reference:</h5>, <h4>Regressed TCs:</h4>, ...regTcChilds]}
                    {improvedTcs.length > 0 && [<h5>Non-passing TCs in reference:</h5>, <h4>Improved TCs:</h4>, ...impTcChilds]}
                </div>
            })}
        </div>}
        {tpMissingInB.length > 0 && <div>
            <h4>Test plans in reference only:</h4>
            {tpMissingInB.map((tpA, idx) => {
                return <div key={'ccTpMissingInB' + idx} className="compareContainer">
                    <div>{tpA.shortName}</div>
                    <div />
                    <AtxExecOverview reports={[tpA]} />
                    <div />
                </div>
            })}
        </div>}
        {tpNewInB.length > 0 && <div>
            <h4>Test plans not in reference:</h4>
            {tpNewInB.map((tpB, idx) => {
                return <div key={'ccTpNewInB' + idx} className="compareContainer">
                    <div />
                    <div>{tpB.shortName}</div>
                    <div />
                    <AtxExecOverview reports={[tpB]} />
                </div>
            })}
        </div>}
    </>)
}
