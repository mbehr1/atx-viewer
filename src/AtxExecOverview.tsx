import { Pie } from 'react-chartjs-2'

import { useCallback, useEffect, useState } from 'react';
import { AtxTestCase, AtxTestReport, getFolderStats, getReportTestName, getTestCases, SummaryStats } from './atxReportParser.ts';
import { LegendItem } from 'chart.js';

// ChartJS.register(ArcElement);

interface AtxExecOverviewProps {
    reports: AtxTestReport[]
}

export const AtxExecOverview = (props: AtxExecOverviewProps) => {

    // get basic data from atx:
    const [summaryStats, setSummaryStats] = useState<SummaryStats>({ passed: 0, failed: 0, skipped: 1, none: 0, totalExecutionTime: 0 });

    useEffect(() => {
        const sumStats: SummaryStats = { passed: 0, failed: 0, skipped: 0, none: 0, totalExecutionTime: 0 };

        // determine summary stats:
        for (const report of props.reports) {
            const stat = getFolderStats(report.root)
            sumStats.passed += stat.passed
            sumStats.failed += stat.failed
            sumStats.skipped += stat.skipped
            sumStats.none += stat.none
            sumStats.totalExecutionTime += stat.totalExecutionTime
        }
        setSummaryStats(sumStats);
    }, [props.reports])

    const pie = useCallback(() => {
        const detailTcs = props.reports.map(r => Array.from(getTestCases(r.root))).flat() // .filter(tc => tc.verdict !== 'NONE')
        const execTimes = detailTcs.map(tc => tc.executionTimeInSec)
        const detailsColors = detailTcs.map(tc => {
            switch (tc.verdict) {
                case 'PASSED': return 'green'
                case 'FAILED':
                case 'ERROR': return 'red'
                case 'NONE': return 'white'; break; // or count as skipped?
                default:
                    return 'grey'
            }
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
                plugins: {
                    tooltip: {
                        bodyFont: {
                            size: 8
                        },
                        callbacks: {
                            title: () => props.reports.map(r => getReportTestName(r)).join(','),
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
                        title: { text: `${props.reports.map(r => getReportTestName(r)).join(',')}: ${Number(summaryStats.totalExecutionTime / 60).toLocaleString(undefined, { maximumFractionDigits: 1 })}min`, display: true },
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
    }, [summaryStats, props.reports]);

    return (<>{pie()}</>)
}
