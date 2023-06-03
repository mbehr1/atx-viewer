import { Pie } from 'react-chartjs-2'

import { useCallback, useEffect, useState } from 'react';
import { AtxTestCase, AtxTestReport, getFolderStats, getReportTestName, getTestCases, mapVerdictToColor, SummaryStats } from './atxReportParser.ts';
import { Chart, LegendItem } from 'chart.js';

// ChartJS.register(ArcElement);

interface AtxExecOverviewProps {
    reports: AtxTestReport[]
    onDetails?: (tcs: AtxTestCase[]) => void
}

export const AtxExecOverview = (props: AtxExecOverviewProps) => {

    const { reports, onDetails } = props;

    // get basic data from atx:
    const [summaryStats, setSummaryStats] = useState<SummaryStats>({ passed: 0, failed: 0, skipped: 1, none: 0, totalExecutionTime: 0 });

    useEffect(() => {
        const sumStats: SummaryStats = { passed: 0, failed: 0, skipped: 0, none: 0, totalExecutionTime: 0 };

        // determine summary stats:
        for (const report of reports) {
            const stat = getFolderStats(report.root)
            sumStats.passed += stat.passed
            sumStats.failed += stat.failed
            sumStats.skipped += stat.skipped
            sumStats.none += stat.none
            sumStats.totalExecutionTime += stat.totalExecutionTime
        }
        setSummaryStats(sumStats);
    }, [reports])

    const pie = useCallback(() => {
        const detailTcs = reports.map(r => Array.from(getTestCases(r.root))).flat() // .filter(tc => tc.verdict !== 'NONE')
        const execTimes = detailTcs.map(tc => tc.executionTimeInSec)
        const detailsColors = detailTcs.map(tc => {
            return mapVerdictToColor(tc.verdict)
        })
        const detailedDataset = {
            label: 'duration',
            data: execTimes,
            backgroundColor: detailsColors,
            borderWidth: 0,
            hoverOffset: 20,
            _privData: detailTcs, 
        }
        return <div >
            <Pie options={{
                onClick: (e) => {
                    try {
                        // console.log(`AtxExecOverview.Pie.onClick...`, e)
                        const chart: Chart | undefined = 'chart' in e ? e.chart as Chart : undefined
                        if (chart && e.x !== null && e.y !== null) {
                            const elem = chart.getElementsAtEventForMode(e as unknown as Event, 'nearest', { intersect: true }, false)
                            // console.log(`AtxExecOverview.Pie.onClick elems=${elem.length}`, elem)
                            if (elem.length > 0) {
                                const { datasetIndex, index } = elem[0]
                                if (datasetIndex === 0) {
                                    const data = detailedDataset._privData[index];
                                    // console.log(`AtxExecOverview.Pie.onClick data=`, data)
                                    if (data) {
                                        if (onDetails) {
                                            onDetails([data])
                                        }
                                    }
                                } else if (datasetIndex === 1) {
                                    let filterVerdict: RegExp;
                                    switch (index) {
                                        case 0: filterVerdict = /^PASSED/; break;
                                        case 1: filterVerdict = /^FAILED|^ERROR/; break;
                                        case 2: filterVerdict = /^SKIPPED/; break;
                                        case 3:
                                        default:
                                            filterVerdict = /^NONE/; break;
                                    }
                                    const data = detailedDataset._privData.filter(t => filterVerdict.test(t.verdict))
                                    if (data.length) {
                                        if (onDetails) {
                                            onDetails(data)
                                        }
                                    }
                                }
                            }
                        }

                    } catch (e) {
                        console.error(`AtxExecOverview.Pie.onClick got e=`, e)
                    }
                },
                plugins: {
                    tooltip: {
                        bodyFont: {
                            size: 8
                        },
                        callbacks: {
                            title: () => reports.map(r => getReportTestName(r)).join(','),
                            label: (ctx) => {
                                let label = ctx.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (ctx.parsed !== null) {
                                    label += new Intl.NumberFormat().format(ctx.parsed);
                                }
                                if (ctx.datasetIndex === 0) {
                                    // detailed dataset
                                    label += 's'
                                    let tcDetails = ''
                                    if ('_privData' in ctx.dataset) {
                                        const pd = ctx.dataset._privData
                                        if (Array.isArray(pd)) {
                                            const tc = pd[ctx.dataIndex] as AtxTestCase
                                            if (tc) {
                                                tcDetails += `TC: ${tc.shortName} ${tc.verdict}`
                                                //if (tc.steps.length) {
                                                //    tcDetails += ` steps: ${tc.steps.length}`
                                                //}
                                            }
                                        }
                                    }
                                    // split after min 30chars at word boundary, after 50 chars hard
                                    const wrappedDetails = tcDetails.split(/(.{30,}?\b)\s/g).map(str => str.split(/(.{50,}?)/g)).flat().filter(str => str.length > 0)
                                    //console.log(`wrappedDetails: ${JSON.stringify(wrappedDetails)}`);
                                    return [label, wrappedDetails].flat()
                                } else {
                                    switch (ctx.dataIndex) {
                                        case 0: label += ' passed'; break;
                                        case 1: label += ' failed'; break;
                                        case 2: label += ' skipped'; break;
                                        case 3: label += ' verdict none'; break;
                                    }
                                    return label
                                }
                            },
                        }
                    },
                    legend: {
                        title: { text: `${reports.map(r => getReportTestName(r)).join(',')}: ${Number(summaryStats.totalExecutionTime / 60).toLocaleString(undefined, { maximumFractionDigits: 1 })}min`, display: true },
                        labels: {
                            generateLabels: (() => {
                                return [
                                    summaryStats.passed > 0 ? { text: 'passed', fillStyle: 'green' } : undefined,
                                    summaryStats.failed > 0 ? { text: 'failed', fillStyle: 'red' } : undefined,
                                    summaryStats.skipped > 0 ? { text: 'skipped', fillStyle: 'grey' } : undefined,
                                    summaryStats.none > 0 ? { text: 'none', fillStyle: 'white' } : undefined,
                                ].filter(f => f !== undefined) as LegendItem[]
                            })
                        }
                    }
                }
            }} data={{
                // labels: ['passed', 'failed', 'skipped', 'none'], using generateLabels to assign proper color
                datasets: [detailedDataset,
                    {
                        label: 'Total',
                        data: [summaryStats.passed, summaryStats.failed, summaryStats.skipped, summaryStats.none],
                        backgroundColor: ['green', 'red', 'grey', 'white']
                    },
                ]
            }} />
        </div>
    }, [summaryStats, reports, onDetails]);

    return (<>{pie()}</>)
}
