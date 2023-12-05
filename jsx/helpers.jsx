import {BehaviorSubject} from "rxjs";
import {getAppLocation, setAppLocation} from "../js/helpers";
import {TodoStore} from "../js/store";
import {useEffect, useState} from "react";
import {uuid} from "@m-ld/m-ld";

/**
 * @template T
 * @param {import("rxjs").Observable<T>} observable
 * @param {T | undefined} [initialValue]
 * @returns {T}
 */
export function useObservableValue(observable, initialValue) {
	const [value, setValue] = useState(initialValue);
	useEffect(() => {
		const subs = observable.subscribe(setValue);
		return () => subs.unsubscribe();
	}, [observable]);
	return value;
}

/**
 * @template T
 * @param {BehaviorSubject<T>} subject
 * @returns T
 */
export function useBehaviour(subject) {
	return useObservableValue(subject, subject.value);
}

/** @param {import("rxjs").Observable} observable */
export function useObservableError(observable) {
	const [error, setError] = useState(null);
	useEffect(() => {
		const subs = observable.subscribe({error: setError});
		return () => subs.unsubscribe();
	}, [error]);
	return error;
}

export function useStore() {
	return useBehaviour(stores);
}

export function useFilter() {
	return useBehaviour(filters);
}

const {documentId, isNew, filter} = processHash();
const stores = new BehaviorSubject(new TodoStore(documentId, isNew));
const filters = new BehaviorSubject(filter);

window.addEventListener("hashchange", () => {
	const {documentId, isNew, filter} = processHash();
	let store = stores.value;
	if (store.id !== documentId) {
		store.close();
		store = new TodoStore(documentId, isNew)
		stores.next(store);
	}
	filters.next(filter);
});

function processHash() {
	let {documentId, filter} = getAppLocation() ?? {};
	const isNew = !documentId;
	if (isNew) {
		documentId = uuid();
		setAppLocation(documentId, filter);
	}
	return {documentId, isNew, filter};
}
