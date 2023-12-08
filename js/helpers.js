import {uuid} from "@m-ld/m-ld";

export function getAppLocation(hash = document.location.hash) {
	// Document hash may be the document ID/filter, a login redirect, or nothing
	let match = hash.match(/^#\/(\w*)\/(\w*)$/);
	if (match)
        return {modelId: match[1], filter: match[2]};
}

export function setAppLocation(modelId, filter) {
    setWindowURLFragment(`#/${modelId ?? ''}/${filter ?? ''}`);
}

export function setWindowURLFragment(url) {
	// If `url` is null, remove the fragment by setting the URL to the relative pathname
	history.pushState(null, null, url ?? window.location.pathname);
}

export function processHash() {
    let {modelId, filter} = getAppLocation() ?? {};
    const isNew = !modelId;
    if (isNew) {
        modelId = uuid();
        setAppLocation(modelId, filter);
    }
    return {modelId, isNew, filter};
}

export function matches({completed}, filter) {
    return filter === "active"
        ? !completed
        : filter === "completed"
            ? completed
            : true;
}

export const replaceHTML = (el, html) => {
	el.replaceChildren();
	el.insertAdjacentHTML("afterbegin", html);
};

/**
 * @template T
 * @param {T} root
 * @returns {{[key: string]: Element | T}}
 */
export function keyedElements(root) {
	return new Proxy({self: root}, {
		get(t, p) {
			return t[p] ??= root.querySelector(`[data-key="${p}"]`);
		}
	});
}
