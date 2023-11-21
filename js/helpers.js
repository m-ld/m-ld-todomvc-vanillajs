export function getAppLocation(hash = document.location.hash) {
	// Document hash may be the document ID/filter, a login redirect, or nothing
	let match = hash.match(/^#\/(\w*)\/(\w*)$/);
	if (match)
		return {documentId: match[1], filter: match[2]};
}

export function setAppLocation(documentId, filter) {
	setWindowURLFragment(`#/${documentId ?? ''}/${filter ?? ''}`);
}

export function setWindowURLFragment(url) {
	// If `url` is null, remove the fragment by setting the URL to the relative pathname
	history.pushState(null, null, url ?? window.location.pathname);
}

export const delegate = (el, selector, event, handler) => {
	el.addEventListener(event, (e) => {
		if (e.target.matches(selector)) handler(e, el);
	});
};

export const insertHTML = (el, html) => el.insertAdjacentHTML("afterbegin", html);

export const replaceHTML = (el, html) => {
	el.replaceChildren();
	insertHTML(el, html);
};

// https://developer.mozilla.org/en-US/docs/Glossary/Base64#the_unicode_problem
export function base64ToBytes(base64) {
    const binString = atob(base64);
	// noinspection JSCheckFunctionSignatures,JSUnresolvedReference
	return Uint8Array.from(binString, m => m.codePointAt(0));
}
