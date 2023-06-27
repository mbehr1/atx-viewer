/** 
 * todo:
 * [ ] TEST-CASE-ATTRIBUTES support (e.g. show SDGs in table)
 * [?] TEST-CASE proper name from test-plan not from test-execution (added originRef but staying at the shortName for now)
 * [ ] add support for test arguments download (ARGUMENT-LIST)
*/


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
    longName?: string,
    desc?: string,
    date?: Date,
    executionTimeInSec?: number,
    verdict: string, // one of PASSED, FAILED, NONE, INCONCLUSIVE, ERROR // todo how to handle EVALUATED/AGGREGATED?
    originRef?: string, // from <ORIGIN-REF DEST="TEST-CASE">...
    steps: AtxTestStepFolder[],
    testArguments: AtxTestCaseArgument[], // ARGUMENT-LIST/ARGUMENTS/TEST-ARGUMENT-ELEMENT...
}

export interface AtxTestCaseArgument {
    // todo shortName... (not needed for now?)
    desc?: string,
    argType?: string,
    direction?: string,
    value: string
}

export interface AtxTestCaseFolder {
    shortName: string,
    longName?: string,
    testCases: (AtxTestCase | AtxTestCaseFolder)[], // todo clarify how test repetitions are handled
}

/**
 * Contains info about test step or test steps (folder)
 * For test step the steps array is empty.
 */
export interface AtxTestStepFolder {
    shortName: string,
    longName?: string,
    desc?: string,
    verdict?: string,
    expectedResult?: string,
    steps: AtxTestStepFolder[]
}

/**
 * map verdict string (PASSED/FAILED|ERROR/NONE) to colors (green/red/white/grey)
 * @param verdict 
 * @returns green for PASSED, red for FAILED or ERROR, white for NONE, grey otherwise
 */
export const mapVerdictToColor = (verdict: string | undefined): string => {
    switch (verdict) {
        case 'PASSED': return 'green'
        case 'FAILED':
        case 'ERROR': return 'red'
        case 'INCONCLUSIVE': return 'yellow'
        case 'NONE': return 'white'
    }
    return 'grey'
}

/**
 * Determine the verdict for a test step folder.
 * If the folder contains a verdict return that one.
 * Otherwise query verdict of all the folders steps and return by severity: ERROR or FAILED or PASSED or NONE.
 * E.g. if one step is PASSED and one is FAILED and the folder has no verdict: FAILED is returned.
 * @param folder - test step folder
 * @returns the verdict or undefined
 */
export const getVerdictForFolder = (folder: AtxTestStepFolder): string | undefined => {
    if (folder.verdict) { return folder.verdict } else {
        // folder has no verdict. so lets get verdict from the steps contained
        const verdicts: { [x: string]: boolean } = {}
        for (const step of folder.steps) {
            const verdict = getVerdictForFolder(step)
            if (verdict) { verdicts[verdict] = true }
        }
        if (verdicts.ERROR) return 'ERROR';
        if (verdicts.FAILED) return 'FAILED';
        if (verdicts.INCONCLUSIVE) return 'INCONCLUSIVE';
        if (verdicts.PASSED) return 'PASSED';
        if (verdicts.NONE) return 'NONE';
    }
    return undefined
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

/**
 * recurively (depth first) get all the test cases from a folder
 * @param folder 
 */
export function* getPlannedTestCases(folder: AtxPlannedTestCaseFolder): IterableIterator<AtxPlannedTestCase> {
    for (const tcOrFolder of folder.plannedTestCases) {
        if ('repetition' in tcOrFolder) {
            yield tcOrFolder
        } else {
            yield* getPlannedTestCases(tcOrFolder)
        }
    }
}

export interface SummaryStats {
    passed: number,
    failed: number,
    inconclusive: number,
    skipped: number,
    none: number,
    totalExecutionTime: number,
}

export const getFolderStats = (folder: AtxTestCaseFolder): SummaryStats => {
    const stats = {
        passed: 0,
        failed: 0,
        inconclusive: 0,
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
                case 'INCONCLUSIVE': stats.inconclusive += 1; break;
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
            stats.inconclusive += fStats.inconclusive
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
    names.push(report.plan.shortName)
    for (const tcOrFolder of report.plan.plannedTestCases) {
        if (!('repetition' in tcOrFolder)) {
            const tcFolder = tcOrFolder as AtxPlannedTestCaseFolder
            names.push(tcFolder.shortName)
        }
    }
    // console.log(`getReportTestName returning: '${names.join(',')}' for`, report)
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
 * get a "member" that is expected to be just once in the array
 * @param a - array
 * @param member
 * @returns member or undefined
 */
const getFirstMember = (a: JSONValue, member: string | string[]): JSONValue | undefined => {
    if (typeof member === 'string') {
        if (a && Array.isArray(a)) {
            for (const m of a) {
                if (typeof m === 'object' && !Array.isArray(m) && member in m) {
                    return m[member]
                }
            }
        } else {
            console.error(`getFirstMember(${member}) called on non array!`, a)
        }
    } else { // member is an array, search the full path:
        let toRet: JSONValue | undefined = undefined
        for (const memb of member) {
            toRet = getFirstMember(toRet === undefined ? a : toRet, memb)
            if (toRet === undefined) {
                // console.warn(`getFirstMember(${member.join('/')}) didn't found '${memb}'`)
                return undefined
            }
        }
        return toRet
    }
    return undefined
}

/**
 * get an array of all members with a specific name
 * @param a 
 * @param member 
 * @returns 
 */
const getAllMember = (a: JSONValue, member: string): JSONValue[] => {
    const members: JSONValue[] = []
    if (a && Array.isArray(a)) {
        for (const m of a) {
            if (typeof m === 'object' && !Array.isArray(m) && member in m) {
                members.push(m[member])
            }
        }
    } else {
        console.error(`getAllMember(${member}) called on non array!`, a)
    }
    return members
}

const getInnerText = (val: JSONValue): string | undefined => {
    if (Array.isArray(val)) {
        if (val.length === 1 && typeof val[0] === 'object' && '#text' in val[0]) {
            const t = val[0]['#text']
            if (typeof t === 'string') {
                return t
            } else if (typeof t === 'number') {
                return t.toString()
            }
        } else if (val.length === 0) {
            return undefined // normal, no inner text
        }
    }
    console.warn(`getInnerText wrong type`, val)
    return undefined
}

/**
 * get the text element as string. can be a number as well that gets converted
 * @param a 
 * @param member 
 * @returns text from #text member
 */
const getText = (a: JSONValue, member: string): string | undefined => {
    if (a) {
        if (Array.isArray(a)) {
            for (const m of a) {
                if (typeof m === 'object' && !Array.isArray(m) && member in m) {
                    const val = m[member]
                    return getInnerText(val)
                }
            }
        } else {
            if (typeof a === 'object') {
                if (member in a) {
                    const val = a[member]
                    return getInnerText(val)
                }
            } else {
                console.error(`getText(${member}) called on wrong type '${typeof a}'`, a)
            }
        }
    } else {
        console.error(`getText(${member}) called on nullish`, a)
    }
    return undefined
}

const getLongName = (elem: JSONValue): string | undefined => {
    const lelem = getFirstMember(elem, 'LONG-NAME')
    if (Array.isArray(lelem)) {
        for (const lel of lelem) {
            for (const [key, value] of Object.entries(lel)) {
                switch (key) {
                    case 'L-4': return getInnerText(value)
                    default:
                        console.warn(`getLongName unknown key '${key}'`, value)
                }
            }
        }
    }
    console.warn(`getLongName returning undefined!`, lelem)
    return undefined
}

const getDesc = (elem: JSONValue): string | undefined => {
    const delem = getFirstMember(elem, 'DESC')
    if (Array.isArray(delem)) {
        for (const lel of delem) {
            for (const [key, value] of Object.entries(lel)) {
                switch (key) {
                    case 'L-2': return getInnerText(value)
                    default:
                        console.warn(`getDesc unknown key '${key}'`, value)
                }
            }
        }
        console.warn(`getDesc returning undefined!`, delem)
    }
    // no warning here if DESC doesn't exist
    return undefined
}

const getExpectedResult = (elem: JSONValue): string | undefined => {
    const verdD = getFirstMember(elem, 'VERDICT-DEFINITION')
    if (verdD && Array.isArray(verdD)) {
        const er = getFirstMember(verdD, 'EXPECTED-RESULT')
        if (er && Array.isArray(er)) {
            const p = getFirstMember(er, 'P')
            if (p && Array.isArray(p)) {
                for (const lel of p) {
                    for (const [key, value] of Object.entries(lel)) {
                        switch (key) {
                            case 'L-1':
                                return getInnerText(value)
                            default:
                                console.warn(`getExpectedResult unknown key '${key}'`, value)
                        }
                    }
                }
            }
        }
        console.warn(`getExpectedResult returning undefined!`, verdD)
    }
    return undefined
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
        if (!(atx && typeof atx === 'object' && Array.isArray(atx))) {
            console.error(`atxReportParse ignored due to no array!`, atx)
            return []
        }
        const tss = getTestSpecObjs(atx as JSONValue[]);
        for (const [testPlan, ts] of tss) {
            // mandatory members:
            const shortName = getText(ts, 'SHORT-NAME') //  ts['SHORT-NAME'];
            if (typeof shortName !== 'string') {
                console.warn(`atxReportParse skipped report due to wrong SHORT-NAME: ${JSON.stringify(shortName)}`);
                break;
            }
            const tcs = getFirstMember(ts, 'TEST-CASES');
            if (tcs && typeof tcs === 'object' && Array.isArray(tcs)) {
                const root: AtxTestCaseFolder = {
                    shortName: '', // or /?
                    testCases: parseTestCases(tcs),
                }

                // now test plan:
                if (testPlan && Array.isArray(testPlan)) {
                    const planShortName = getText(testPlan, 'SHORT-NAME')
                    if (typeof planShortName !== 'string') {
                        console.warn(`atxReportParse skipped report due to wrong plan SHORT-NAME: ${JSON.stringify(planShortName)}`);
                        break;
                    }
                    const ptcs = getFirstMember(testPlan, 'PLANNED-TEST-CASES')
                    if (ptcs && Array.isArray(ptcs)) {
                        const plan: AtxPlannedTestCaseFolder = {
                            shortName: planShortName,
                            plannedTestCases: parsePlannedTestCases(ptcs),
                        }
                        const report: AtxTestReport = {
                            shortName,
                            date: getElementDate(ts),
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
const getTestSpecObjs = (atxOrPkg: JSONValue[]): [JSONValue, JSONValue][] => {
    const res: JSONValue[] = [];
    const plans: JSONValue[] = [];
    try {

        const atx = getFirstMember(atxOrPkg, 'ATX')
        if (atx && typeof atx === 'object' && Array.isArray(atx)) {
            const arPackages = getAllMember(atx, 'AR-PACKAGES')
            for (const arPkg of arPackages) {
                if (Array.isArray(arPkg)) {
                    const arPkgs = getAllMember(arPkg, 'AR-PACKAGE')
                if (Array.isArray(arPkgs)) {
                    for (const pkg of arPkgs) {
                        if (Array.isArray(pkg)) {
                            const elem = getFirstMember(pkg, 'ELEMENTS')
                            if (Array.isArray(elem)) {
                                const ts = getAllMember(elem, 'TEST-SPEC')
                                for (const spec of ts) {
                                    if (Array.isArray(spec) && getText(spec, 'CATEGORY') === 'ATX_TEST_REPORT') {
                                        res.push(spec)
                                    }
                                }   
                                for (const plan of getAllMember(elem, 'TEST-EXECUTION-PLAN')) {
                                    plans.push(plan)
                                }
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
    if (res.length !== plans.length) { console.warn(`getTestSpecObjs unexpected spec vs plans ${res.length} vs ${plans.length}`, res, plans) }
    return plans.map((p, idx) => [p, res[idx]])
}

const getElementDate = (ts: JSONValue): Date | undefined => {
    try {
        const adminData = getFirstMember(ts, 'ADMIN-DATA')
        const docRevs = adminData && typeof adminData === 'object' && Array.isArray(adminData) ? getFirstMember(adminData, 'DOC-REVISIONS') : undefined
        const docRev = docRevs && Array.isArray(docRevs) && docRevs.length > 0 ? getFirstMember(docRevs, 'DOC-REVISION') : undefined
        const docDate = docRev && Array.isArray(docRev) ? getText(docRev, 'DATE') : undefined
        //console.log(`getTestReportDate=`, docDate);
        return docDate && typeof docDate === 'string' ? new Date(docDate) : undefined;
    } catch (e) {
        console.warn(`getDate returned err:${e}`)
    }
    return undefined
}

const getTestArguments = (tc: JSONValue): AtxTestCaseArgument[] => {
    const res: AtxTestCaseArgument[] = []
    try {
        const tArgs = getFirstMember(tc, ['ARGUMENT-LIST', 'ARGUMENTS'])
        if (Array.isArray(tArgs)) {
            for (const tArg of tArgs) {
                if (typeof tArg === 'object') {
                    for (const [key, value] of Object.entries(tArg)) {
                        switch (key) {
                            case 'TEST-ARGUMENT-ELEMENT':
                                // console.log(`getTestArguments got`, value)
                                {
                                    const desc = getDesc(value)
                                    const direction = getText(value, 'DIRECTION')
                                    const argType = getText(value, 'TYPE-REF')
                                    const valueO = getFirstMember(value, ['LITERAL-VALUE', 'TEXT-VALUE-SPECIFICATION'])
                                    const value2 = Array.isArray(valueO) ? getText(valueO, 'VALUE') : undefined
                                    if (value2 !== undefined) {
                                        res.push({
                                            desc,
                                            argType,
                                            direction,
                                            value: value2
                                        })
                                    } else {
                                        console.warn(`getTestArguments unknown value`, valueO, value)
                                    }
                                }
                                break;
                            default:
                                console.warn(`getTestArguments unknown key '${key}'`, value)
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.warn(`getTestArguments got err=${e}`)
    }
    return res
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
                            const t = parsePlannedTestCase(value);
                            if (t.length) { res.push(...t) }
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
        if (Array.isArray(folder)) {
            // console.log(`parsePlannedTestCaseFolder(${folderContent['SHORT-NAME']})...'`, Object.keys(folderContent));
            const shortName = getText(folder, 'SHORT-NAME')
            const testCases = getFirstMember(folder, 'PLANNED-TEST-CASES')
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
    } catch (e) {
        console.warn(`parsePlannedTestCaseFolder got err=${e}`)
    }
    return res
}

const parsePlannedTestCase = (testCase: JSONValue): AtxPlannedTestCase[] => {
    const res: AtxPlannedTestCase[] = []
    try {
        if (Array.isArray(testCase)) {
            const shortName = getText(testCase, 'SHORT-NAME')
            const testCaseRef = getText(testCase, 'TEST-CASE-REF')
            const repetition = Number(getText(testCase, 'REPETITION'))
            if (shortName && testCaseRef) {
                const tc: AtxPlannedTestCase = {
                    shortName,
                    repetition,
                    testCaseRef,
                }
                if (tc.repetition !== 1) {
                    console.log(`parsePlannedTestCase with repetition !=1`, tc)
                }
                res.push(tc)
            } else {
                console.warn(`parsePlannedTestCase ignoring test case due to missing values ${JSON.stringify(testCase)}`)
            }
        } else {
            console.warn(`parsePlannedTestCase ignoring due to no array ${JSON.stringify(testCase)}`)
        }
    } catch (e) {
        console.warn(`parsePlannedTestCase got err=${e}`)
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
                            const t = parseTestCase(value as JSONObject[]); if (t) { res.push(t) }
                        }
                            break;
                        default:
                            console.warn(`parseTestCases ignored! TEST-CASES.${key}`);
                            break;
                    }
                }
            } else {
                console.warn(`parseTestCases wrong type`, tc)
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
        if (Array.isArray(folder)) {
            const shortName = getText(folder, 'SHORT-NAME')
            const testCases = getFirstMember(folder, 'TEST-CASES')
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
    } catch (e) {
        console.warn(`parseTestCaseFolder got err=${e}`)
    }
    return res
}

const parseTestCase = (testCase: JSONObject[]): AtxTestCase | undefined => {
    if (Array.isArray(testCase)) {
        const shortName = getText(testCase, 'SHORT-NAME')
        if (shortName) {
            const verdR = getFirstMember(testCase, 'VERDICT-RESULT')
            if (verdR && typeof verdR === 'object' && Array.isArray(verdR)) {
                const verdict = getText(verdR, 'VERDICT')
                if (verdict) {
                    const steps: AtxTestStepFolder[] = []
                    const execTime = getText(testCase, 'EXECUTION-TIME')
                    const desc = getDesc(testCase)
                    const date = getElementDate(testCase)
                    const originRef = getText(testCase, 'ORIGIN-REF')
                    const testArguments: AtxTestCaseArgument[] = getTestArguments(testCase)

                    const testC: AtxTestCase = {
                        shortName,
                        desc,
                        date,
                        verdict,
                        executionTimeInSec: execTime ? Number(execTime) : undefined,
                        originRef,
                        steps,
                        testArguments
                    }
                    {
                        const tsfo = getFirstMember(testCase, 'TEST-SETUP-STEPS')
                        const tsf = tsfo !== undefined && Array.isArray(tsfo) ? parseTestSteps(tsfo, 'TEST-SETUP-STEPS') : undefined
                        if (tsf?.length) { steps.push(...tsf) }
                    }
                    {
                        const tsfo = getFirstMember(testCase, 'TEST-EXECUTION-STEPS')
                        const tsf = tsfo !== undefined && Array.isArray(tsfo) ? parseTestSteps(tsfo, 'TEST-EXECUTION-STEPS') : undefined
                        if (tsf?.length) { steps.push(...tsf) }
                    }
                    {
                        const tsfo = getFirstMember(testCase, 'TEST-TEARDOWN-STEPS')
                        const tsf = tsfo !== undefined && Array.isArray(tsfo) ? parseTestSteps(tsfo, 'TEST-TEARDOWN-STEPS') : undefined
                        if (tsf?.length) { steps.push(...tsf) }
                    }
                    return testC
                } else {
                    console.warn(`parseTestCase: ignored due to missing/wrong VERDICT!`)
                }
            } else {
                console.warn(`parseTestCase: ignored due to missing/wrong VERDICT-RESULT!`)
            }
        } else {
            console.warn(`parseTestCase: ignored due to no shortName`)
        }
    } else {
        console.warn(`parseTestCase: ignored due to !Array`)
    }
    return undefined
}

const parseTestSteps = (folder: JSONValue[], shortName: string): AtxTestStepFolder[] => {
    if (folder === undefined) { return [] }
    const res: AtxTestStepFolder[] = []
    if (typeof folder !== 'object' && !Array.isArray(folder)) {
        console.warn(`parseTestSteps: ignored dues to unexpected type '${typeof folder}'`, folder)
    } else { // is Array
        if (folder.length === 0) {
            // console.warn(`parseTestSteps: ignored due to len=0/empty`, folder)
        } else {
            const steps: AtxTestStepFolder[] = []
            for (const f of folder) {
                if (typeof f === 'object') {
                    for (const [key, value] of Object.entries(f)) {
                        switch (key) {
                            case 'TEST-STEP-FOLDER': {
                                const st = parseTestStepFolders(value)
                                for (const s of st) { steps.push(s) }
                            }
                                break;
                            case 'TEST-STEP': {
                                const st = parseTestStep(value)
                                if (st) { steps.push(st) }
                            }
                                break;
                            default:
                                console.warn(`parseTestSteps unknown key '${key}'`, value)
                        }
                    }
                } else {
                    console.warn(`parseTestSteps: ignored due to wrong type '${typeof f}' f=`, f)
                }
            }
            if (steps.length > 0) {
                res.push({
                    shortName: shortName,
                    steps: steps
                })
            } else {
                console.warn(`parseTestSteps(${shortName}): ignored due to no steps!`)
            }
        }
    }
    return res
}

const parseTestStepFolders = (folder: JSONValue): AtxTestStepFolder[] => {
    const folders: AtxTestStepFolder[] = []
    if (!folder || typeof folder !== 'object' || !Array.isArray(folder)) {
        console.warn(`parseTestStepFolders ignored due to wrong type '${typeof folder}'`, folder)
    } else {
        const shortName = getText(folder, 'SHORT-NAME')
        if (typeof shortName === 'string') {
            const longName = getLongName(folder)
            const verdR = getFirstMember(folder, 'VERDICT-RESULT')
            const verdict = verdR && Array.isArray(verdR) ? getText(verdR, 'VERDICT') : undefined
            const expectedResult = getExpectedResult(folder)
            const desc = getDesc(folder)
            // but now we iterate over all elems to keep test-step and test-step-folder in proper order:
            const steps: AtxTestStepFolder[] = []
            for (const f of folder) {
                for (const [key, value] of Object.entries(f)) {
                    switch (key) {
                        case 'TEST-STEP':
                            {
                                const st = parseTestStep(value)
                                if (st) { steps.push(st) }
                            }
                            break;
                        case 'TEST-STEP-FOLDER':
                            {
                                const st = parseTestStepFolders(value)
                                for (const s of st) { steps.push(s) }
                            } break;
                        case 'VERDICT-DEFINITION': break;
                        case 'SHORT-NAME':
                        case 'VERDICT-RESULT':
                        case 'DESC':
                        case 'LONG-NAME': break;
                        default:
                            console.warn(`parseTestStepFolders unknown key '${key}'`, value, folder)
                            break;
                    }
                }
            }
            folders.push({
                shortName,
                longName,
                desc,
                verdict,
                expectedResult,
                steps,
            })
        } else {
            console.warn(`parseTestStepFolders: ignored f due to wrong shortName '${typeof shortName}'`, shortName)
        }
        if (folders.length === 0) {
            console.warn(`parseTestStepFolders: ignored due to no folders!`, folder)
        }
    }
    return folders
}

const parseTestStep = (step: JSONValue): AtxTestStepFolder | undefined => {
    if (!step || !Array.isArray(step)) {
        console.warn(`parseTestStep ignored due to wrong type '${typeof step}'`, step)
    } else {
        const shortName = getText(step, 'SHORT-NAME')
        const longName = getLongName(step)
        const desc = getDesc(step)
        const verdR = getFirstMember(step, 'VERDICT-RESULT')
        const verdict = verdR && Array.isArray(verdR) ? getText(verdR, 'VERDICT') : undefined
        const expectedResult = getExpectedResult(step)
        if (getFirstMember(step, 'TEST-STEP-FOLDER') || getFirstMember(step, 'TEST-STEP')) {
            console.warn(`parseTestStep with TEST-STEP-FOLDER!`)
        }
        if (typeof shortName === 'string') {
            return {
                shortName,
                longName,
                desc,
                verdict: typeof verdict === 'string' ? verdict : undefined,
                expectedResult,
                steps: []
            }
        }
    }
    return undefined
}
