// see https://dexie.org/docs/Tutorial/React
import Dexie, { Table } from 'dexie'
import { AtxTestReport } from './atxReportParser';
// import { useLiveQuery } from 'dexie-react-hooks';

export interface Reference {
    id?: number,
    name: string,
    reportIds: number[]; // we keep the reports in a sep. table to avoid loading all data constantly
}

export interface Report {
    id?: number,
    report: AtxTestReport
}

export class AtxDexie extends Dexie {
    references!: Table<Reference>
    reports!: Table<Report>

    constructor() {
        super('atx-viewer-db')
        this.version(1).stores({
            references: '++id, name', // primary key and indexed props
            reports: '++id'
        })
    }
}

export const db = new AtxDexie()

// some helper functions:
export const addReferenceReport = async (name: string, reports: AtxTestReport[]) => {
    try {
        if (reports.length === 0) return;
        // add the reports: (todo use a full transaction)
        const reportIds: number[] = []
        for (const report of reports) {
            const rid = await db.reports.add({ report })
            console.log(`addReferenceReport added report.id=${rid}`)
            reportIds.push(rid as number)
        }
        const id = await db.references.add({ name, reportIds })
        console.log(`addReferenceReport added reference.id=${id}`)
        return id
    } catch (e) {
        console.error(`addReferenceReport failed with: '${e}'`)
    }
}

//export const getReportsByReferenceId = useLiveQuery