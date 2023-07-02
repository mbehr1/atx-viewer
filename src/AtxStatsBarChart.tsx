/**
* todo
*/

import { Bar } from "react-chartjs-2"
import { AtxTestCase, AtxTestReport, SummaryStats, getFolderStats } from "./atxReportParser"
import { useCallback, useEffect, useState } from "react"

interface AtxStatsBarChartProps {
    reports: AtxTestReport[]
}

export const AtxStatsBarChart = (props: AtxStatsBarChartProps) => {
    const { reports } = props
    // const isColorModeDark = useMemo(() => window.matchMedia("(prefers-color-scheme: dark)").matches, [])

    const [nrTestScripts, setNrTestScripts] = useState<number>(0)
    const [gteq1Stats, setGteq1Stats] = useState<SummaryStats>({ passed: 0, failed: 0, inconclusive: 0, skipped: 0, none: 0, totalExecutionTime: 0 });
    const [allItStats, setAllItStats] = useState<SummaryStats>({ passed: 0, failed: 0, inconclusive: 0, skipped: 0, none: 0, totalExecutionTime: 0 });

    useEffect(() => {
        const allItStats: SummaryStats = { passed: 0, failed: 0, inconclusive: 0, skipped: 0, none: 0, totalExecutionTime: 0 };
        const gtEq1Stats: SummaryStats = { passed: 0, failed: 0, inconclusive: 0, skipped: 0, none: 0, totalExecutionTime: 0 };

        // collect stats per testscript_id:
        const testScriptIds: Map<string, SummaryStats> = new Map()
        const filterFn = (tc: AtxTestCase): boolean => {
            if ('TT_TESTSCRIPT_ID' in tc.testConstants) {
                let stats = testScriptIds.get(tc.testConstants['TT_TESTSCRIPT_ID']);
                if (stats === undefined) {
                    stats = { passed: 0, failed: 0, inconclusive: 0, skipped: 0, none: 0, totalExecutionTime: 0 }
                    testScriptIds.set(tc.testConstants['TT_TESTSCRIPT_ID'], stats)
                }

                stats.totalExecutionTime += tc.executionTimeInSec || 0;
                switch (tc.verdict) {
                    case 'PASSED': stats.passed += 1; break;
                    case 'ERROR': // fallthrough
                    case 'FAILED': stats.failed += 1; break;
                    case 'INCONCLUSIVE': stats.inconclusive += 1; break;
                    case 'NONE': stats.none += 1; break;
                    default:
                        console.log(`AtxExecOverview.processTestCases unknown verdict:'${tc.verdict}'`);
                        stats.skipped += 1; break;
                }
                return true
            }
            return true
        }

        // determine summary stats:
        for (const report of reports) {
            getFolderStats(report.root, filterFn)
        }
        testScriptIds.forEach((stat) => {
            const nrIterations = stat.passed + stat.failed + stat.inconclusive + stat.none + stat.skipped
            const nrIterationsWoSkipped = nrIterations // - stat.skipped

            const allPassed = stat.passed === nrIterationsWoSkipped
            const gtEq1Passed = stat.passed > 0

            const allFailed = stat.failed === nrIterationsWoSkipped
            const gtEq1Failed = stat.failed > 0

            const allNone = stat.none === nrIterationsWoSkipped
            const allSkipped = stat.skipped === nrIterations // - nrIterationsWoSkipped

            const gtEq1None = stat.none > 0
            const gtEq1Incl = stat.inconclusive > 0

            // we give only one vote for all iterations
            // order for "all": passed, failed, none, skipped -> else inconcl.
            if (allPassed) { allItStats.passed += 1 }
            else if (allFailed) { allItStats.failed += 1 }
            else if (allNone) { allItStats.none += 1 }
            else if (allSkipped) { allItStats.skipped += 1 }
            else { allItStats.inconclusive += 1 }
            allItStats.totalExecutionTime += stat.totalExecutionTime

            // order for ">=1": passed, failed, inconcl, none, skipped
            if (gtEq1Passed) { gtEq1Stats.passed += 1 }
            else if (gtEq1Failed) { gtEq1Stats.failed += 1 }
            else if (gtEq1Incl) { gtEq1Stats.inconclusive += 1 }
            else if (gtEq1None) { gtEq1Stats.none += 1 }
            else { gtEq1Stats.skipped += 1 }
            gtEq1Stats.totalExecutionTime += stat.totalExecutionTime

            if (!allPassed && !allFailed && !allNone && !allSkipped) {
                //console.log(`inconcl stat=`, stat)
            }
        })

        setNrTestScripts(testScriptIds.size)
        setAllItStats(allItStats)
        setGteq1Stats(gtEq1Stats)
    }, [reports])

    const bar = useCallback(() => {
        return <div>
            <Bar
                options={{
                    indexAxis: 'y',
                    scales: {
                        x: {
                            stacked: true
                        },
                        y: {
                            stacked: true
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        title: {
                            text: "Status per TT_TESTSCRIPT_ID",
                            display: true
                        }
                    }
                }}
                data={{
                    labels: ['>=1 it. passed', 'all it. same'],
                    datasets: [
                        { label: 'passed', data: [gteq1Stats.passed, allItStats.passed], backgroundColor: ['green'] },
                        { label: 'failed', data: [gteq1Stats.failed, allItStats.failed], backgroundColor: ['red'] },
                        { label: 'inconclusive', data: [gteq1Stats.inconclusive, allItStats.inconclusive], backgroundColor: ['yellow'] },
                        { label: 'none', data: [gteq1Stats.none, allItStats.none], backgroundColor: ['white'] },
                        { label: 'skipped', data: [gteq1Stats.skipped, allItStats.skipped], backgroundColor: ['grey'] }
                    ]
                }} />
        </div>
    }, [gteq1Stats, allItStats])

    if (nrTestScripts === 0) {
        return (<div></div>)
    }

    return (
        <div className='execOverview'>
            <div style={{
                display: 'block', position: 'relative', maxWidth: '100%'
            }}>
                <div className='execOverviewTitle' title={'TEST-CONSTANT.TT_TESTSCRIPT_ID'}>
                    {bar()}
                </div>
            </div>
        </div>
    )
}