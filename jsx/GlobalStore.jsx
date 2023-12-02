import {BehaviorSubject, distinctUntilKeyChanged, filter as where} from "rxjs";
import {getAppLocation, setAppLocation} from "../js/helpers";
import {TodoStore} from "../js/store";
import {useSyncExternalStore} from "react";
import {uuid} from 'https://edge.js.m-ld.org/ext/index.mjs';

const {documentId, isNew, filter} = processHash();
const keys = ["todos", "filter", "error", "ready"];
const states = new BehaviorSubject({
	todos: createTodos(documentId, isNew), filter
});
const nextState = items => states.next({...states.value, ...items});

function createTodos(documentId, isNew) {
	const todos = new TodoStore(documentId, isNew);
	todos.addEventListener("save", () => {
		// Using a proxy to cheat React into thinking the state has changed
		nextState({todos: new Proxy(todos, {}), ready: true});
	});
	todos.addEventListener("error", e => {
		nextState({error: e.error});
	});
	return todos;
}

window.addEventListener("hashchange", () => {
	const {documentId, isNew, filter} = processHash();
	let {todos} = states.value;
	if (todos.id !== documentId) {
		todos.close();
		todos = createTodos(documentId, isNew);
		nextState({todos, filter, ready: false, error: null});
	} else {
		nextState({filter});
	}
});

// Pre-compute the params, so they don't change between calls to use
const params = keys.reduce((params, key) => ({
	...params,
	[key]: [
		cb => {
			const subs = states.pipe(
				distinctUntilKeyChanged(key),
				where(state => state[key] != null)
			).subscribe(() => cb());
			return () => subs.unsubscribe();
		},
		() => states.value[key]
	]
}), {});

/**
 * @returns {{todos: TodoStore, filter: string, error?: any, ready?: boolean}}
 */
export default function use() {
	// noinspection JSValidateTypes
	return keys.reduce((storeItems, key) => ({
		...storeItems,
		[key]: useSyncExternalStore(...params[key])
	}), {});
}

function processHash() {
	let {documentId, filter} = getAppLocation() ?? {};
	const isNew = !documentId;
	if (isNew) {
		documentId = uuid();
		setAppLocation(documentId, filter);
	}
	return {documentId, isNew, filter};
}
