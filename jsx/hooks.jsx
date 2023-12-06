import {useEffect, useState, useSyncExternalStore} from "react";

/**
 * @template T
 * @param {Observable<T>} observable
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

export function useDocumentLocationHash() {
    return useSyncExternalStore(subscribeDocumentLocationHash, getDocumentLocationHash);
}

function subscribeDocumentLocationHash(cb) {
    window.addEventListener("hashchange", cb);
    return () => window.removeEventListener("hashchange", cb);
}

function getDocumentLocationHash() {
    return document.location.hash;
}
