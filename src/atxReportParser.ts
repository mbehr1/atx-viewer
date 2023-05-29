
type JSONValue = | string | number | boolean | { [x: string]: JSONValue } | Array<JSONValue>;
export type JSONObject = { [x: string]: JSONValue };

/**
 * Contains info about a category ATX_TEST_REPORT report.
 * Contains only the executed tests and not the ones e.g. with repetition 0 
 * from the referenced PLANNED-TEST_CASE.
 */
export interface AtxTestReport {
    shortName: string,
    longName?: string,
    date?: Date, // from ADMIN-DATA/DOC-REVISIONS/DOC-REVISION.DATE
    //testCases: (AtxTestCase | AtxTestCaseFolder)[], // todo clarify how test repetitions are handled
    root: AtxTestCaseFolder, // we add an artificial root "/" folder
    plan: AtxPlannedTestCaseFolder, // the test plan
}

/**
 * Contains info about a TEST-CASE execution
 */
export interface AtxTestCase {
    shortName: string,
    // todo add executedAtDate?
    executionTimeInSec?: number,
    verdict: string, // one of PASSED, FAILED, NONE, INCONCLUSIVE, ERROR // todo how to handle EVALUATED/AGGREGATED?
}

export interface AtxTestCaseFolder {
    shortName: string,
    longName?: string,
    testCases: (AtxTestCase | AtxTestCaseFolder)[], // todo clarify how test repetitions are handled
}

export interface AtxPlannedTestCaseFolder {
    shortName: string,
    plannedTestCases: (AtxPlannedTestCase | AtxPlannedTestCaseFolder)[]
}

export interface AtxPlannedTestCase {
    shortName: string,
    repetition: number,
    testCaseRef: string,
}

export interface SummaryStats {
    passed: number,
    failed: number,
    skipped: number,
    none: number,
    totalExecutionTime: number,
}

export const getFolderStats = (folder: AtxTestCaseFolder): SummaryStats => {
    const stats = {
        passed: 0,
        failed: 0,
        skipped: 0,
        none: 0,
        totalExecutionTime: 0,
    }

    for (const tcOrFolder of folder.testCases) {
        if ('verdict' in tcOrFolder) {
            const tc = tcOrFolder as AtxTestCase
            stats.totalExecutionTime += tc.executionTimeInSec || 0;
            switch (tc.verdict) {
                case 'PASSED': stats.passed += 1; break;
                case 'ERROR': // fallthrough
                case 'FAILED': stats.failed += 1; break;
                case 'NONE': stats.none += 1; break;
                default:
                    console.log(`AtxExecOverview.processTestCases unknown verdict:'${tc.verdict}'`);
                    stats.skipped += 1; break;
            }
        } else {
            const tcFolder = tcOrFolder as AtxTestCaseFolder
            const fStats = getFolderStats(tcFolder)
            stats.passed += fStats.passed
            stats.failed += fStats.failed
            stats.skipped += fStats.skipped
            stats.none += fStats.none
            stats.totalExecutionTime += fStats.totalExecutionTime
        }
    }

    return stats
}

export const getReportTestName = (report: AtxTestReport): string => {
    // use the concated names of the first folders:?
    // sadly not. 
    // todo: get from PLANNED-TEST-CASE-FOLDER.SHORT-NAME...

    const names = [];
    for (const tcOrFolder of report.plan.plannedTestCases) {
        if (!('repetition' in tcOrFolder)) {
            const tcFolder = tcOrFolder as AtxPlannedTestCaseFolder
            names.push(tcFolder.shortName)
        }
    }

    return names.join(',')
}

/**
 * recurively (depth first) get all the test cases from a folder
 * @param folder 
 */
export function* getTestCases(folder: AtxTestCaseFolder): IterableIterator<AtxTestCase> {
    for (const tcOrFolder of folder.testCases) {
        if ('verdict' in tcOrFolder) {
            yield tcOrFolder
        } else {
            yield* getTestCases(tcOrFolder)
        }
    }
}

/**
 * Parse an JSON object into the structured AtxTestReport types.
 * @param atx json object parsed from the xml file via fast-xml-parser... (todo describe mandatory options)
 * @returns the contained test reports if the `atx` doesn't contain any ATX/AR-PACKAGES/AR-PACKAGE/ELEMENTS/TEST-SPEC
 * with category `ATX_TEST_REPORT`.
 */
export const atxReportParse = (atx: JSONObject): AtxTestReport[] => {
    const res: AtxTestReport[] = [];
    try {
        const tss = getTestSpecObjs(atx);
        for (const [testPlan, ts] of tss) {
            // mandatory members:
            const shortName = ts['SHORT-NAME'];
            if (typeof shortName !== 'string') {
                console.warn(`atxReportParse skipped report due to wrong SHORT-NAME: ${JSON.stringify(shortName)}`);
                break;
            }
            const tcs = ts['TEST-CASES'];
            if (tcs && typeof tcs === 'object' && Array.isArray(tcs)) {
                const root: AtxTestCaseFolder = {
                    shortName: '', // or /?
                    testCases: parseTestCases(tcs),
                }

                // now test plan:
                if (testPlan && typeof testPlan === 'object' && !Array.isArray(testPlan)) {
                    const planShortName = testPlan['SHORT-NAME']
                    if (typeof planShortName !== 'string') {
                        console.warn(`atxReportParse skipped report due to wrong plan SHORT-NAME: ${JSON.stringify(planShortName)}`);
                        break;
                    }
                    const ptcs = testPlan['PLANNED-TEST-CASES']
                    if (ptcs && typeof ptcs === 'object' && Array.isArray(ptcs)) {
                        const plan: AtxPlannedTestCaseFolder = {
                            shortName: planShortName,
                            plannedTestCases: parsePlannedTestCases(ptcs),
                        }
                        const report: AtxTestReport = {
                            shortName,
                            date: getTestReportDate(ts),
                            root,
                            plan
                        }
                        res.push(report);
                    } else {
                        console.warn(`atxReportParse skipped report due to wrong PLANNED-TEST-CASES: ${JSON.stringify(ptcs)}`);
                    }
                } else {
                    console.warn(`atxReportParse skipped report due to wrong TEST-EXECUTION-PLAN: ${JSON.stringify(testPlan)}`);
                }
            } else {
                console.warn(`atxReportParse skipped report due to wrong TEST-CASES: ${JSON.stringify(tcs)}`);
            }
        }
    } catch (e) {
        console.warn(`atxReportParse got err:${e}`)
    }
    return res;
}

/**
 * 
 * @param atxOrPkg 
 * @returns an array of pairs of test plans and test reports
 */
const getTestSpecObjs = (atxOrPkg: JSONObject): [JSONObject, JSONObject][] => {
    const res: JSONObject[] = [];
    const plans: JSONObject[] = [];
    try {
        const atx = 'ATX' in atxOrPkg ? atxOrPkg.ATX : atxOrPkg;
        if (atx && typeof atx === 'object' && !Array.isArray(atx)) {
            if ('AR-PACKAGES' in atx) {
                const arPkg = atx['AR-PACKAGES'] as JSONObject[];
                const arPkgs = arPkg[0]['AR-PACKAGE']; // this is the array
                if (Array.isArray(arPkgs)) {
                    for (const pkg of arPkgs) {
                        if (typeof pkg === 'object' && !Array.isArray(pkg)) {
                            const elem = pkg['ELEMENTS'] as JSONObject;
                            if (typeof elem === 'object') {
                                if ('TEST-SPEC' in elem) {
                                    const ts = elem['TEST-SPEC'] as JSONObject;
                                    if (ts.CATEGORY === 'ATX_TEST_REPORT') {
                                        res.push(ts)
                                    }
                                }
                                if ('TEST-EXECUTION-PLAN' in elem) {
                                    plans.push(elem['TEST-EXECUTION-PLAN'] as JSONObject)
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.warn(`getTestSpecObjs got err:${e}`)
    }
    //if (res.length > 1) { console.warn(`getTestSpecObjs returned unexpected length ${res.length}!=1`) }
    if (res.length !== plans.length) { console.warn(`getTestSpecObjs unexpected spec vs plans ${res.length} vs ${plans.length}`) }
    return plans.map((p, idx) => [p, res[idx]])
}

const getTestReportDate = (ts: JSONObject): Date | undefined => {
    try {
        const adminData = ts['ADMIN-DATA']
        const docRevs = adminData && typeof adminData === 'object' && !Array.isArray(adminData) && adminData['DOC-REVISIONS'];
        const docRev = docRevs && Array.isArray(docRevs) && docRevs.length > 0 && (docRevs[0] as JSONObject)['DOC-REVISION'];
        const docDate = docRev && typeof docRev === 'object' && !Array.isArray(docRev) && docRev.DATE;
        //console.log(`getTestReportDate=`, docDate);
        return docDate && typeof docDate === 'string' ? new Date(docDate) : undefined;
    } catch (e) {
        console.warn(`getDate returned err:${e}`)
    }
    return undefined
}

const parsePlannedTestCases = (testCases: JSONValue[]): (AtxPlannedTestCase | AtxPlannedTestCaseFolder)[] => {
    const res: (AtxPlannedTestCase | AtxPlannedTestCaseFolder)[] = []
    if (Array.isArray(testCases)) {
        for (const tc of testCases) {
            if (typeof tc === 'object') {
                for (const [key, value] of Object.entries(tc)) {
                    switch (key) {
                        case 'PLANNED-TEST-CASE-FOLDER': {
                            const f = parsePlannedTestCaseFolder(value as JSONObject[]);
                            if (f.length) { res.push(...f) }
                        } break;
                        case 'PLANNED-TEST-CASE': {
                            //  todo const t = parsePlannedTestCase(value as JSONObject[]); if (t.length) { res.push(...t) }
                        }
                            break;
                        default:
                            console.warn(`parsePlannedTestCases ignored! TEST-CASES.${key}`);
                            break;
                    }
                }
            }
        }
    }
    return res
}
const parsePlannedTestCaseFolder = (folder: JSONObject[]): AtxPlannedTestCaseFolder[] => {
    const res: AtxPlannedTestCaseFolder[] = [];
    try {
        for (const folderContent of folder) {
            // console.log(`parsePlannedTestCaseFolder(${folderContent['SHORT-NAME']})...'`, Object.keys(folderContent));
            if (typeof folderContent === 'object') {
                const shortName = folderContent['SHORT-NAME']
                const testCases = folderContent['PLANNED-TEST-CASES']
                if (testCases && Array.isArray(testCases)) {
                    if (shortName && typeof shortName === 'string') {
                        const f: AtxPlannedTestCaseFolder = {
                            shortName,
                            plannedTestCases: parsePlannedTestCases(testCases),
                        }
                        res.push(f)
                    }
                } else {
                    console.warn(`parsePlannedTestCaseFolder ignoring folder ${JSON.stringify(shortName)} due to wrong TEST-CASES ${JSON.stringify(testCases)}`)
                }
            }
        }
    } catch (e) {
        console.warn(`parsePlannedTestCaseFolder got err=${e}`)
    }
    return res
}

const parseTestCases = (testCases: JSONValue[]): (AtxTestCase | AtxTestCaseFolder)[] => {
    const res: (AtxTestCase | AtxTestCaseFolder)[] = []
    if (Array.isArray(testCases)) {
        for (const tc of testCases) {
            if (typeof tc === 'object') {
                for (const [key, value] of Object.entries(tc)) {
                    switch (key) {
                        case 'TEST-CASE-FOLDER': {
                            const f = parseTestCaseFolder(value as JSONObject[]);
                            if (f.length) { res.push(...f) }
                        } break;
                        case 'TEST-CASE': {
                            const t = parseTestCase(value as JSONObject[]); if (t.length) { res.push(...t) }
                        }
                            break;
                        default:
                            console.warn(`parseTestCases ignored! TEST-CASES.${key}`);
                            break;
                    }
                }
            }
        }
    } else {
        console.warn(`parseTestCases ignored! testCases=${typeof testCases} && isArray=${Array.isArray(testCases)}`);
    }
    return res
}

const parseTestCaseFolder = (folder: JSONObject[]): AtxTestCaseFolder[] => {
    const res: AtxTestCaseFolder[] = [];
    try {
        for (const folderContent of folder) {
            //console.log(`parseTestCaseFolder(${folderContent['SHORT-NAME']})...'`, Object.keys(folderContent));
            if (typeof folderContent === 'object') {
                const shortName = folderContent['SHORT-NAME']
                const testCases = folderContent['TEST-CASES']
                if (testCases && Array.isArray(testCases)) {
                    if (shortName && typeof shortName === 'string') {
                        const f: AtxTestCaseFolder = {
                            shortName,
                            testCases: parseTestCases(testCases),
                        }
                        res.push(f)
                    }
                } else {
                    console.warn(`parseTestCaseFolder ignoring folder ${JSON.stringify(shortName)} due to wrong TEST-CASES ${JSON.stringify(testCases)}`)
                }
            }
        }
    } catch (e) {
        console.warn(`parseTestCaseFolder got err=${e}`)
    }
    return res
}
const parseTestCase = (testCase: JSONObject[]): AtxTestCase[] => {
    const res: AtxTestCase[] = [];
    //console.log(`parseTestCase(#${testCase.length})`);
    for (const tc of testCase) {
        const shortName = tc['SHORT-NAME']
        if (shortName && typeof shortName === 'string') {
            const verdR = tc['VERDICT-RESULT'];
            if (verdR && typeof verdR === 'object' && !Array.isArray(verdR)) {
                const verdict = verdR['VERDICT'];
                if (typeof verdict === 'string') {
                    const testCase: AtxTestCase = {
                        shortName,
                        executionTimeInSec: 'EXECUTION-TIME' in tc ? Number(tc['EXECUTION-TIME']) : undefined,
                        verdict,
                    }
                    res.push(testCase)
                }
            }
        }
    }
    return res
}