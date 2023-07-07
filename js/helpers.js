export const getURLHash = (hash) => {
	const [documentId, filter] = hash.split('/').slice(1); // Remove hash symbol
	return {documentId: documentId ?? '', filter: filter ?? ''};
};

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
