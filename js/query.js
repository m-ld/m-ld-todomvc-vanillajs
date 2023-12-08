import {asapScheduler, Observable, observeOn} from "rxjs";
import {updateSubject} from "@m-ld/m-ld";
import {produceWithPatches, enablePatches} from "immer";

enablePatches();

/** @typedef {import('@m-ld/m-ld').MeldClone} MeldClone */
/** @typedef {import('@m-ld/m-ld').MeldReadState} MeldReadState */
/** @typedef {import('@m-ld/m-ld').MeldUpdate} MeldUpdate */
/** @typedef {import('@m-ld/m-ld').Query} Query */
/** @typedef {import('@m-ld/m-ld').GraphSubject} GraphSubject */

/** @typedef {import('@m-ld/m-ld').Reference} Reference */

/**
 * @template T
 * @param {MeldClone | Promise<MeldClone>} willMeld
 * @param {(state: MeldReadState) => Promise<T>} readValue
 * @param {(update: MeldUpdate, state: MeldReadState) => Promise<T>} updateValue
 * @returns {Observable<T>}
 */
export function watchQuery(
	willMeld,
	readValue,
	updateValue = (update, state) => readValue(state)
) {
	return new Observable(subs => {
		Promise.resolve(willMeld).then(meld => {
			subs.add(meld.status.subscribe({complete: () => subs.complete()}));
			subs.add(meld.read(
				async state => {
					try {
						const value = await readValue(state);
						!subs.closed && value && subs.next(value);
					} catch (e) {
						subs.error(e);
					}
				},
				async (update, state) => {
					try {
						const value = await updateValue(update, state);
						!subs.closed && value && subs.next(value);
					} catch (e) {
						subs.error(e);
					}
				}
			));
		}).catch(err => subs.error(err));
		// TODO: m-ld workaround: live lock throws due to overlapping states
	}).pipe(observeOn(asapScheduler));
}

/**
 * @param {MeldClone | Promise<MeldClone>} willMeld
 * @param {string} id
 * @returns {Observable<GraphSubject>}
 */
export function watchSubject(
	willMeld,
	id
) {
	if (typeof id != 'string')
		throw new RangeError("Subject id must be provided");
	let subject = {"@id": id}, patches = [];
	return watchQuery(
		willMeld,
		async state =>
			subject = await state.get(subject["@id"]),
		update => {
			[subject, patches] = produceWithPatches(subject,
				mutable => updateSubject(mutable, update));
			return patches.length ? subject : undefined;
		}
	);
}
