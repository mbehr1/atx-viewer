import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { useState } from 'react'

interface SelectReferenceFormProps {
    referenceId: number,
    onSetRef: (referenceId: number | undefined) => void,
}

export const SelectReferenceForm = (props: SelectReferenceFormProps) => {

    const references = useLiveQuery(
        () => db.references.toArray()
    )

    const [selectedRefId, setSelectedRefId] = useState<number>()

    return (
        <form onSubmit={(e) => {
            console.log(`SelectReferenceForm... ${selectedRefId} called`)
            props.onSetRef(selectedRefId)
            e.preventDefault()
        }}>
            <label>
                Select reference reports for comparision:
                <select value={props.referenceId > 0 ? props.referenceId : undefined} onChange={e => setSelectedRefId(Number(e.target.value))}>
                    {references?.map((r, idx) =>
                        <option key={`${idx}_${r.id}`} value={r.id}>
                            {r.name}
                        </option>)}
                </select>
            </label>
            <input type="submit" value="compare" />
        </form>)
}
