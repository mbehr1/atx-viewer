/**
 * todo
 * [ ] - show single report name as label/title for tooltip is detail tc is selected
 */

import { Pie } from 'react-chartjs-2'

import { useCallback, useEffect, useMemo, useState, SVGProps } from 'react';
import { AtxTestCase, AtxTestReport, getFolderStats, getReportTestName, getTestCases, mapVerdictToColor, SummaryStats } from './atxReportParser.ts';
import { Chart, LegendItem } from 'chart.js';

import './AtxExecOverview.css'


// icon:card-list | Bootstrap https://icons.getbootstrap.com/ | Bootstrap
// https://reactsvgicons.com/search?q=list license MIT
function IconCardList(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            fill="currentColor"
            viewBox="0 0 16 16"
            height="1em"
            width="1em"
            {...props}
        >
            <path d="M14.5 3a.5.5 0 01.5.5v9a.5.5 0 01-.5.5h-13a.5.5 0 01-.5-.5v-9a.5.5 0 01.5-.5h13zm-13-1A1.5 1.5 0 000 3.5v9A1.5 1.5 0 001.5 14h13a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0014.5 2h-13z" />
            <path d="M5 8a.5.5 0 01.5-.5h7a.5.5 0 010 1h-7A.5.5 0 015 8zm0-2.5a.5.5 0 01.5-.5h7a.5.5 0 010 1h-7a.5.5 0 01-.5-.5zm0 5a.5.5 0 01.5-.5h7a.5.5 0 010 1h-7a.5.5 0 01-.5-.5zm-1-5a.5.5 0 11-1 0 .5.5 0 011 0zM4 8a.5.5 0 11-1 0 .5.5 0 011 0zm0 2.5a.5.5 0 11-1 0 .5.5 0 011 0z" />
        </svg>
    );
}

//export default IconCardList;


// ChartJS.register(ArcElement);

interface AtxExecOverviewProps {
    reports: AtxTestReport[]
    onDetails?: (tcs: AtxTestCase[]) => void
}

const longestCommonPrefix = (strs: string[]): string => {
    if (!strs || strs.length === 0) return ""
    const sortedStrs = strs.sort((a, b) => a.length - b.length)
    let shortestStr = sortedStrs[0]
    while (!strs.every((str) => str.startsWith(shortestStr))) {
        if (shortestStr.length === 0) return ""
        shortestStr = shortestStr.slice(0, -1)
    }
    return shortestStr
}

export const AtxExecOverview = (props: AtxExecOverviewProps) => {

    const { reports, onDetails } = props;

    // get basic data from atx:
    const [summaryStats, setSummaryStats] = useState<SummaryStats>({ passed: 0, failed: 0, inconclusive: 0, skipped: 1, none: 0, totalExecutionTime: 0 });

    const reportTitle = useMemo(() => {
        const names = reports.map(r => getReportTestName(r))
        if (names.length === 1) { return names[0] }
        const comPrefix = longestCommonPrefix(names)
        if (comPrefix.length) {
            return comPrefix + '.. ' + names.map(n => '-' + n.slice(comPrefix.length)).join(', ')
        } else {
            return names.join(', ')
        }
    }, [reports])
    const detailTcs = useMemo(() => reports.map(r => Array.from(getTestCases(r.root))).flat(), [reports]) // .filter(tc => tc.verdict !== 'NONE')

    const isColorModeDark = useMemo(() => window.matchMedia("(prefers-color-scheme: dark)").matches, [])

    useEffect(() => {
        const sumStats: SummaryStats = { passed: 0, failed: 0, inconclusive: 0, skipped: 0, none: 0, totalExecutionTime: 0 };

        // determine summary stats:
        for (const report of reports) {
            const stat = getFolderStats(report.root)
            sumStats.passed += stat.passed
            sumStats.failed += stat.failed
            sumStats.inconclusive += stat.inconclusive
            sumStats.skipped += stat.skipped
            sumStats.none += stat.none
            sumStats.totalExecutionTime += stat.totalExecutionTime
        }
        setSummaryStats(sumStats);
    }, [reports])

    const pie = useCallback(() => {
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
                                        case 2: filterVerdict = /^INCONCLUSIVE/; break;
                                        case 3: filterVerdict = /^SKIPPED/; break;
                                        case 4:
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
                            size: 10
                        },
                        titleFont: {
                            size: 8
                        },
                        callbacks: {
                            title: () => reportTitle,
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
                                        case 2: label += ' inconclusive'; break;
                                        case 3: label += ' skipped'; break;
                                        case 4: label += ' verdict none'; break;
                                    }
                                    return label
                                }
                            },
                        }
                    },
                    legend: {
                        title: { color: isColorModeDark ? 'white' : 'black', text: `duration: ${Number(summaryStats.totalExecutionTime / 60).toLocaleString(undefined, { maximumFractionDigits: 1 })}min`, display: true },
                        labels: {
                            boxWidth: 16,
                            generateLabels: (() => {
                                return [
                                    summaryStats.passed > 0 ? { text: `passed:${summaryStats.passed}`, fillStyle: 'green', fontColor: isColorModeDark ? 'white' : 'black' } : undefined,
                                    summaryStats.failed > 0 ? { text: `failed:${summaryStats.failed}`, fillStyle: 'red', fontColor: isColorModeDark ? 'white' : 'black' } : undefined,
                                    summaryStats.inconclusive > 0 ? { text: `inconclusive:${summaryStats.inconclusive}`, fillStyle: 'yellow', fontColor: isColorModeDark ? 'white' : 'black' } : undefined,
                                    summaryStats.skipped > 0 ? { text: `skipped:${summaryStats.skipped}`, fillStyle: 'grey', fontColor: isColorModeDark ? 'white' : 'black' } : undefined,
                                    summaryStats.none > 0 ? { text: 'none', fillStyle: 'white', fontColor: isColorModeDark ? 'white' : 'black' } : undefined,
                                ].filter(f => f !== undefined) as LegendItem[]
                            })
                        }
                    }
                }
            }} data={{
                // labels: ['passed', 'failed', 'skipped','inconclusive', 'none'], using generateLabels to assign proper color
                datasets: [detailedDataset,
                    {
                        label: 'Total',
                        data: [summaryStats.passed, summaryStats.failed, summaryStats.inconclusive, summaryStats.skipped, summaryStats.none],
                        backgroundColor: [mapVerdictToColor('PASSED'), mapVerdictToColor('FAILED'), mapVerdictToColor('INCONCLUSIVE'), mapVerdictToColor('SKIPPED'), mapVerdictToColor('NONE')]
                    },
                ]
            }} />
        </div>
    }, [summaryStats, onDetails, reportTitle, detailTcs, isColorModeDark]);

    const onAllTcsClick = useCallback(() => {
        if (onDetails) {
            onDetails(detailTcs)
        }
    }, [onDetails, detailTcs])

    return (
        <div className='execOverview'>
            <div style={{
                display: 'block', position: 'relative',
                maxWidth: '100%'
            }}>
                <div className='execOverviewTitle' title={reportTitle}>{reportTitle.slice(-1000)}</div>
                {pie()}
                <div className='chartIcon' title='show all testcases' onClick={onAllTcsClick}>
                    <IconCardList />
                </div>
            </div>
        </div>
    )
}
